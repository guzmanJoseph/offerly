-- Historical Gmail import: isolated from ongoing scan-gmail sync.
create table if not exists public.gmail_history_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_email text not null,
  lookback_months integer not null default 6 check (lookback_months in (1,3,6,12)),
  next_page_token text,
  completed boolean not null default false,
  checked_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gmail_history_imports_user_idx on public.gmail_history_imports(user_id,created_at desc);
create table if not exists public.gmail_history_candidates (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.gmail_history_imports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id text not null,
  company text not null default '',
  role text not null default '',
  proposed_status text not null default 'Applied',
  applied_date date,
  subject text not null default '',
  confidence numeric not null default 0,
  decision text not null default 'pending' check (decision in ('pending','imported','dismissed','duplicate')),
  created_at timestamptz not null default now(),
  unique(import_id,message_id)
);
create index if not exists gmail_history_candidates_user_idx on public.gmail_history_candidates(user_id,import_id,decision);
alter table public.gmail_history_imports enable row level security;
alter table public.gmail_history_candidates enable row level security;
create policy "Read own Gmail history imports" on public.gmail_history_imports for select to authenticated using (auth.uid()=user_id);
create policy "Read own Gmail history candidates" on public.gmail_history_candidates for select to authenticated using (auth.uid()=user_id);
-- Writes are only performed by authenticated, validating Edge Functions using the service role.
