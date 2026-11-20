-- ============================================================
-- Payment & storage lockdown - prepared 2026-11-09
-- Project: tkovigthghwpwbtjikyp
-- STATUS: APPLIED 2026-11-21. Sections 1-4, 6, 7 as payment_storage_lockdown_part1;
-- section 5 (public.users) as payment_storage_lockdown_part2_users.
--
-- Pairs with the source changes that move public.users writes to the
-- service role (app/actions/auth.ts, app/auth/callback/route.ts).
-- ============================================================

begin;

-- 1) Product image bucket ------------------------------------
-- Permissive policies OR together, so these three defeated the
-- product_images_admin_* policies and let any signed-in customer
-- upload, overwrite or delete product images.
drop policy if exists "Allow authenticated users to upload product images" on storage.objects;
drop policy if exists "Allow authenticated users to update product images" on storage.objects;
drop policy if exists "Allow authenticated users to delete product images" on storage.objects;

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml']
where id = 'product-images';

-- 2) is_admin(): require an actual privileged role -----------
-- Previously any active row in admin_users (whatever its role)
-- satisfied catalog/notification write policies.
create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  return exists (
    select 1
    from public.admin_users
    where id = auth.uid()
      and status = 'active'
      and role::text in ('admin', 'sub_admin')
  );
end;
$function$;

-- 3) Broadcast notifications: signed-in users only -----------
drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_owner_read on public.notifications;
create policy notifications_owner_read on public.notifications
  for select to authenticated
  using (user_id = auth.uid() or user_id is null);

-- 4) Read receipts may only reference a visible notification -
drop policy if exists notification_reads_insert_own on public.notification_reads;
create policy notification_reads_insert_own on public.notification_reads
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.notifications n
      where n.id = notification_id
        and (n.user_id is null or n.user_id = auth.uid())
    )
  );

create index if not exists notification_reads_notification_idx
  on public.notification_reads (notification_id);

-- 5) public.users: server-managed columns --------------------
-- Users may rename themselves; IP, device, activity and email
-- fields are written only by trusted server code.
revoke insert, update, delete, truncate, references, trigger
  on table public.users from anon, authenticated;
revoke select on table public.users from anon;
grant select on table public.users to authenticated;
grant update (name) on table public.users to authenticated;

-- 6) Drop redundant privileges / duplicate index -------------
revoke truncate, references, trigger
  on table public.transactions from anon, authenticated;
-- (duplicate index is owned by a constraint; left in place)

-- 7) Pin function search paths -------------------------------
alter function public.claim_gift_card(text, text, text, text) set search_path to 'public';
alter function public.revoke_all_user_sessions(uuid) set search_path to '';

commit;
