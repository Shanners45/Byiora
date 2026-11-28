-- Admin "Customers & Security" directory, one page at a time.
-- Builds the same customer list the admin page used to build in Node from every user and order
-- (registered users, auth-only accounts and guest buyers, grouped by email), but filters, sorts and
-- pages it in the database so the page loads 10 customers instead of all of them. It also avoids the
-- 1,000-row API cap that would have silently cut off older orders from each customer's totals.
--
-- p_filter: all | registered | unverified | guest | banned | ban_related (customers a ban refers to,
-- for the blacklist tab). Returns { total, counts: {all, registered, unverified, guest, banned}, rows }.
create or replace function public.admin_customer_directory(
  p_search text default '',
  p_filter text default 'all',
  p_limit integer default 10,
  p_offset integer default 0
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with
staff as (
  select lower(btrim(email)) as e from public.admin_users where email is not null
  union
  select lower(btrim(email)) from public.merchants where email is not null
),
bans as (
  select id, type, lower(btrim(value)) as v, value as raw, reason, created_at
  from public.banned_entities
  where expires_at is null or expires_at > now()
),
au as (
  select lower(btrim(a.email)) as e, a.id, a.created_at, a.last_sign_in_at, a.email_confirmed_at,
         coalesce(a.raw_user_meta_data, '{}'::jsonb) as m,
         (a.raw_app_meta_data ->> 'provider' = 'google'
           or coalesce(a.raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'google'
           or exists (select 1 from auth.identities i where i.user_id = a.id and i.provider = 'google')) as google
  from auth.users a
  where a.email is not null and btrim(a.email) <> ''
),
pu as (
  select distinct on (lower(btrim(email))) lower(btrim(email)) as e, id, name, created_at, signup_ip, last_ip,
         last_device_id, last_active_at
  from public.users
  where email is not null and btrim(email) <> ''
  order by lower(btrim(email)), created_at desc
),
agg as (
  select lower(btrim(user_email)) as e,
         count(*) as total_orders,
         count(*) filter (where status in ('Completed', 'Paid')) as ok_orders,
         count(*) filter (where status in ('Payment Failed', 'Cancelled', 'Failed')) as failed_orders,
         coalesce(sum(coalesce(substring(replace(price, ',', '') from '^\s*([0-9]*\.?[0-9]+)')::numeric, 0))
                  filter (where status in ('Completed', 'Paid')), 0) as spent,
         max(created_at) as last_order,
         min(created_at) as first_order,
         (array_agg(guest_user_data ->> 'ip' order by created_at desc)
            filter (where coalesce(guest_user_data ->> 'ip', '') <> ''))[1] as tx_ip,
         (array_agg(guest_user_data ->> 'deviceId' order by created_at desc)
            filter (where coalesce(guest_user_data ->> 'deviceId', '') <> ''))[1] as tx_dev,
         (array_agg(guest_user_data ->> 'name' order by created_at desc))[1] as guest_name,
         (array_agg(user_id order by created_at desc))[1] as latest_user_id
  from public.transactions
  where user_email is not null and btrim(user_email) <> ''
  group by 1
),
emails as (
  select e from pu union select e from au union select e from agg
),
base as (
  select x.e as email,
         case
           when pu.e is not null then coalesce(nullif(pu.name, ''), nullif(au.m ->> 'full_name', ''), split_part(x.e, '@', 1))
           when au.e is not null then coalesce(nullif(au.m ->> 'full_name', ''), nullif(au.m ->> 'name', ''), split_part(x.e, '@', 1))
           else coalesce(nullif(agg.guest_name, ''), split_part(x.e, '@', 1))
         end as name,
         (pu.e is not null or au.e is not null or agg.latest_user_id is not null) as is_registered,
         (au.email_confirmed_at is not null) as email_verified,
         coalesce(au.google, false) as google,
         coalesce(pu.id, au.id, agg.latest_user_id) as user_id,
         coalesce(agg.total_orders, 0) as total_orders,
         coalesce(agg.spent, 0) as spent,
         coalesce(agg.ok_orders, 0) as ok_orders,
         coalesce(agg.failed_orders, 0) as failed_orders,
         agg.last_order,
         -- The newest order's IP / device wins over what the account last recorded.
         coalesce(agg.tx_ip, nullif(pu.last_ip, ''), nullif(pu.signup_ip, ''),
                  nullif(au.m ->> 'last_ip', ''), nullif(au.m ->> 'signup_ip', '')) as last_ip,
         coalesce(agg.tx_dev, nullif(pu.last_device_id, ''), nullif(au.m ->> 'last_device_id', '')) as last_device,
         au.last_sign_in_at,
         pu.last_active_at,
         coalesce(pu.created_at, au.created_at, agg.first_order) as created_at
  from emails x
  left join pu on pu.e = x.e
  left join au on au.e = x.e
  left join agg on agg.e = x.e
  where x.e not in (select e from staff)
),
prof as (
  select b.*,
         eb.id as eb_id, eb.reason as eb_reason,
         db.id as db_id, db.reason as db_reason,
         exists (select 1 from bans d where d.type = 'email_domain' and ltrim(d.v, '@') = split_part(b.email, '@', 2)) as dom_ban
  from base b
  left join lateral (select id, reason from bans where type = 'email' and v = b.email order by created_at limit 1) eb on true
  left join lateral (select id, reason from bans where type = 'device_id' and raw = b.last_device order by created_at limit 1) db on true
),
fin as (
  select p.*,
         (eb_id is not null or db_id is not null or dom_ban) as is_banned,
         coalesce(p.last_order, p.created_at) as sort_at
  from prof p
),
matched as (
  select * from fin f
  where (coalesce(p_search, '') = ''
         or strpos(f.email, lower(p_search)) > 0
         or strpos(lower(f.name), lower(p_search)) > 0)
    and case coalesce(p_filter, 'all')
          when 'registered' then f.is_registered and f.email_verified
          when 'unverified' then f.is_registered and not f.email_verified
          when 'guest' then not f.is_registered
          when 'banned' then f.is_banned
          when 'ban_related' then f.is_banned or exists (
            select 1 from bans x
            where (x.type = 'email' and x.v = f.email)
               or (x.type = 'ip' and x.raw = f.last_ip)
               or (x.type = 'device_id' and x.raw = f.last_device)
               or strpos(lower(coalesce(x.reason, '')), f.email) > 0)
          else true
        end
),
page as (
  select * from matched
  order by sort_at desc nulls last, email
  limit greatest(least(coalesce(p_limit, 10), 1000), 1)
  offset greatest(coalesce(p_offset, 0), 0)
)
select jsonb_build_object(
  'total', (select count(*) from matched),
  'counts', (select jsonb_build_object(
      'all', count(*),
      'registered', count(*) filter (where is_registered and email_verified),
      'unverified', count(*) filter (where is_registered and not email_verified),
      'guest', count(*) filter (where not is_registered),
      'banned', count(*) filter (where is_banned)) from fin),
  'rows', coalesce((select jsonb_agg(jsonb_build_object(
      'email', email,
      'name', name,
      'isRegistered', is_registered,
      'isEmailVerified', email_verified,
      'isGoogleUser', google,
      'provider', case when google then 'google' when is_registered then 'email' end,
      'userId', user_id,
      'totalOrders', total_orders,
      'totalSpent', spent,
      'successfulOrders', ok_orders,
      'failedOrders', failed_orders,
      'lastOrderDate', last_order,
      'lastIp', last_ip,
      'lastDeviceId', last_device,
      'lastSignInAt', last_sign_in_at,
      'lastActiveAt', last_active_at,
      'isBanned', is_banned,
      'banReason', case when not is_banned then null
                        else coalesce(nullif(case when eb_id is not null then eb_reason when db_id is not null then db_reason end, ''),
                                      case when dom_ban then 'Domain blacklisted' else 'Banned by administrator' end) end,
      'banId', coalesce(eb_id, db_id),
      'banVector', case when eb_id is not null then 'email' when db_id is not null then 'device_id' when dom_ban then 'domain' end,
      'createdAt', created_at
    ) order by sort_at desc nulls last, email) from page), '[]'::jsonb)
);
$$;

revoke all on function public.admin_customer_directory(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_customer_directory(text, text, integer, integer) to service_role;
