-- Apply before deploying scan-gmail. Existing application data is preserved.
alter table public.applications add column if not exists gmail_event_at timestamptz;
alter table public.applications add column if not exists gmail_status_updated_at timestamptz;
create table public.gmail_message_results (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_email text not null,
  message_id text not null,
  outcome text not null check (outcome in ('pending', 'ignored', 'needs_review', 'matched')),
  reason text not null,
  classification jsonb,
  subject text not null,
  received_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, account_email, message_id)
);
alter table public.gmail_message_results enable row level security;
revoke all on public.gmail_message_results from anon, authenticated;
grant select on public.gmail_message_results to authenticated;
grant all on public.gmail_message_results to service_role;
create policy "Users can read their own email results" on public.gmail_message_results
  for select to authenticated using (auth.uid() = user_id);
create index gmail_results_review on public.gmail_message_results(user_id, received_at desc)
  where outcome = 'needs_review';
