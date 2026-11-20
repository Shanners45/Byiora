-- ============================================================
-- Least-privilege table grants - prepared 2026-11-20
-- Project: tkovigthghwpwbtjikyp
-- Defense in depth: RLS already denies these, but if a policy is ever
-- loosened by mistake (as happened with promo_codes) the grant still blocks
-- direct PostgREST access with the public anon/user keys.
-- Safe to apply before or after deploying the app: every write below goes
-- through server code using the service role.
-- STATUS: APPLIED 2026-11-20 (with admin_users anon SELECT kept, see section 2).
-- ============================================================

begin;

-- 1) Visitors (anon key) never write anything directly.
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon;

-- 2) Visitors never read private tables.
-- admin_users stays SELECT-able: public-read policies on banners/categories/
-- payment_methods run an inline EXISTS on it. Its RLS returns zero rows to anon.
revoke select on table
  public.banned_entities,
  public.password_reset_tokens,
  public.support_tickets,
  public.transactions,
  public.file_uploads,
  public.payment_credentials,
  public.payment_settings,
  public.promo_codes,
  public.promo_code_usage,
  public.site_config,
  public.gift_card_inventory,
  public.notification_reads
from anon;

-- 3) Signed-in users only write what the browser actually writes:
--    banners / store_announcements / homepage_categories / notifications
--    (admin UI, RLS-gated),
--    notification_reads (own read receipts) and users.name (see lockdown).
revoke insert, update, delete, truncate, references, trigger on table
  public.admin_users,
  public.banned_entities,
  public.password_reset_tokens,
  public.support_tickets,
  public.transactions,
  public.file_uploads,
  public.products,
  public.payment_methods,
  public.payment_credentials,
  public.payment_settings,
  public.promo_codes,
  public.promo_code_usage,
  public.site_config,
  public.gift_card_inventory
from authenticated;

revoke select on table
  public.banned_entities,
  public.password_reset_tokens,
  public.support_tickets,
  public.payment_credentials,
  public.payment_settings,
  public.promo_codes,
  public.promo_code_usage,
  public.site_config,
  public.gift_card_inventory
from authenticated;


commit;
