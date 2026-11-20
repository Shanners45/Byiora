-- ============================================================
-- Admin policies: one source of truth - prepared 2026-11-20
-- Project: tkovigthghwpwbtjikyp
-- STATUS: APPLIED 2026-11-20 (as admin_policies_use_is_admin).
--
-- Policies are OR'ed, so admin policies that inline their own admin_users
-- check (instead of is_admin()) bypass whatever is_admin() enforces — they
-- accepted blocked roles and order_management admins. Point them at is_admin()
-- (active admin / sub_admin only).
--
-- 2FA itself is enforced in the app (getAdminSessionAction) rather than here:
-- "trust this device for 7 days" sessions are aal1 by design, so an aal2 check
-- in is_admin() would block their browser-side admin edits.
-- shortcut: DB writes from the admin browser UI need password only, upgrade by
-- moving banners/categories/announcements writes into server actions.
-- ============================================================

alter policy banners_admin_write on public.banners using (public.is_admin()) with check (public.is_admin());
alter policy homepage_categories_admin_write on public.homepage_categories using (public.is_admin()) with check (public.is_admin());
alter policy file_uploads_admin on public.file_uploads using (public.is_admin()) with check (public.is_admin());
alter policy notifications_admin_all on public.notifications using (public.is_admin()) with check (public.is_admin());
alter policy payment_methods_admin_write on public.payment_methods using (public.is_admin()) with check (public.is_admin());
alter policy store_announcements_admin_write on public.store_announcements using (public.is_admin()) with check (public.is_admin());

alter policy product_images_admin_insert on storage.objects with check (bucket_id = 'product-images' and public.is_admin());
alter policy product_images_admin_update on storage.objects using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());
alter policy product_images_admin_delete on storage.objects using (bucket_id = 'product-images' and public.is_admin());
