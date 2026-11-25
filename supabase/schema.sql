-- Run this in Supabase SQL Editor before enabling payments.
create table if not exists public.payment_orders (
  merchant_reference text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  amount numeric(12,2) not null,
  currency char(3) not null,
  status text not null default 'PENDING' check (status in ('PENDING','COMPLETED','FAILED')),
  pesapal_tracking_id text,
  created_at timestamptz not null default now()
);
create index if not exists payment_orders_user_id_idx on public.payment_orders(user_id);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'trial',
  status text not null default 'trial' check (status in ('trial','active','expired','cancelled')),
  trial_ends_at timestamptz,
  starts_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Automatically give each newly registered account a 3-day trial.
create or replace function public.start_v_analysis_trial()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.subscriptions(user_id, plan, status, trial_ends_at)
  values (new.id, 'trial', 'trial', now() + interval '3 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_v_analysis on auth.users;
create trigger on_auth_user_created_v_analysis
after insert on auth.users
for each row execute procedure public.start_v_analysis_trial();

alter table public.payment_orders enable row level security;
alter table public.subscriptions enable row level security;
-- No client write policies: only trusted server functions use the service-role key.
create policy "users read own orders" on public.payment_orders for select using (auth.uid() = user_id);
create policy "users read own subscription" on public.subscriptions for select using (auth.uid() = user_id);