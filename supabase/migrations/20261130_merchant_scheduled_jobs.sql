-- ============================================================
-- Scheduled jobs run by the database itself (pg_cron), so they work even when
-- QStash, the payment proxy or Vercel are down, and cost nothing on the free plans.
-- Project: tkovigthghwpwbtjikyp
-- STATUS: APPLIED 2026-11-22 (as merchant_scheduled_jobs).
-- ============================================================

-- 1. Fonepay top-ups still unpaid 2 minutes after their 5-minute QR expired are marked failed.
--    The app normally does this within seconds; this is the backstop. Money that arrives
--    later is still credited (merchant_complete_fonepay_topup accepts failed top-ups).
create or replace function public.merchant_expire_fonepay_topups()
returns integer
language sql security definer set search_path = public as $$
  with done as (
    update public.merchant_topups
    set status = 'failed', admin_note = coalesce(admin_note, 'Not paid within 5 minutes')
    where provider = 'fonepay' and status = 'awaiting_payment' and expires_at < now() - interval '2 minutes'
    returning 1
  )
  select count(*)::int from done
$$;
revoke all on function public.merchant_expire_fonepay_topups() from public, anon, authenticated;

-- 2. Retention: merchant activity (audit log) kept 45 days, merchant notifications 2 months.
create index if not exists audit_log_created_idx on public.audit_log (created_at);

select cron.unschedule(jobname) from cron.job where jobname in ('merchant_expire_fonepay_topups', 'merchant_audit_retention', 'merchant_notifications_retention');
select cron.schedule('merchant_expire_fonepay_topups', '* * * * *', $$select public.merchant_expire_fonepay_topups()$$);
select cron.schedule('merchant_audit_retention', '15 0 * * *', $$delete from public.audit_log where created_at < now() - interval '45 days'$$);
select cron.schedule('merchant_notifications_retention', '20 0 * * *', $$delete from public.merchant_notifications where created_at < now() - interval '2 months'$$);

-- 3. Housekeeping for the free plan's 500 MB limit: only logs that grow forever, never business records.
--    The scheduler's own run log (about 1,440 rows a day from job 1), kept 7 days.
--    Merchant webhook delivery attempts, kept 30 days (the portal shows recent ones only).
select cron.unschedule(jobname) from cron.job where jobname in ('cron_run_log_cleanup', 'merchant_webhook_deliveries_retention');
select cron.schedule('cron_run_log_cleanup', '25 0 * * *', $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);
select cron.schedule('merchant_webhook_deliveries_retention', '30 0 * * *', $$delete from public.merchant_webhook_deliveries where created_at < now() - interval '30 days' and status <> 'pending'$$);
