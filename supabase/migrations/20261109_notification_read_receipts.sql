-- Per-user read receipts for notifications.
-- Broadcast notifications (user_id IS NULL) are shared rows, so a single
-- notifications.is_read flag can never represent per-user read state.

create table if not exists public.notification_reads (
  user_id uuid not null references public.users(id) on delete cascade,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);

create index if not exists notification_reads_user_idx on public.notification_reads (user_id);

alter table public.notification_reads enable row level security;
alter table public.notification_reads force row level security;

revoke all on public.notification_reads from anon;
revoke all on public.notification_reads from authenticated;
grant select, insert, delete on public.notification_reads to authenticated;

drop policy if exists notification_reads_select_own on public.notification_reads;
create policy notification_reads_select_own on public.notification_reads
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notification_reads_insert_own on public.notification_reads;
create policy notification_reads_insert_own on public.notification_reads
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists notification_reads_delete_own on public.notification_reads;
create policy notification_reads_delete_own on public.notification_reads
  for delete to authenticated using (user_id = auth.uid());

-- Backfill legacy read state for direct (per-user) notifications
insert into public.notification_reads (user_id, notification_id, read_at)
select n.user_id, n.id, coalesce(n.updated_at, n.created_at, now())
from public.notifications n
where n.user_id is not null and n.is_read = true
on conflict (user_id, notification_id) do nothing;
