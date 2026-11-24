-- ============================================================
-- Live checkout status without polling Vercel.
-- Every change to an order's status (or the "QR Scanned" remark) is pushed by the database
-- itself on a Supabase Realtime channel only that checkout page knows: "checkout:<realtime_key>".
-- The key is random per order and only handed out to the holder of the checkout link, and
-- the message carries just the status, so a listener learns nothing else.
-- Project: tkovigthghwpwbtjikyp
-- STATUS: APPLIED 2026-11-22 (as checkout_realtime).
-- ============================================================

alter table public.transactions add column if not exists realtime_key uuid not null default gen_random_uuid();

create or replace function public.notify_checkout_status()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform realtime.send(jsonb_build_object('status', new.status), 'status', 'checkout:' || new.realtime_key::text, false);
  exception when others then
    -- A Realtime hiccup must never block an order update; the page re-checks on load and on focus.
    null;
  end;
  return new;
end $$;
revoke all on function public.notify_checkout_status() from public, anon, authenticated;

drop trigger if exists transactions_checkout_realtime on public.transactions;
create trigger transactions_checkout_realtime
after update of status, failure_remarks on public.transactions
for each row
when (old.status is distinct from new.status or old.failure_remarks is distinct from new.failure_remarks)
execute function public.notify_checkout_status();

-- ── Hardening: checkout channels are private and listen-only for browsers ──
-- Browsers (guests included) may only LISTEN on checkout:<key> broadcast channels. There is no
-- insert policy on realtime.messages, so no browser can send on them; only this trigger can.
drop policy if exists checkout_status_listen on realtime.messages;
create policy checkout_status_listen on realtime.messages
for select to anon, authenticated
using ((select realtime.topic()) like 'checkout:%' and extension = 'broadcast');

create or replace function public.notify_checkout_status()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform realtime.send(jsonb_build_object('status', new.status), 'status', 'checkout:' || new.realtime_key::text, true);
  exception when others then
    null;
  end;
  return new;
end $$;
