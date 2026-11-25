-- Run this in Supabase SQL Editor before enabling payments.
create table if not exists public.payment_orders (
  merchant_reference text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  amount numeric(12,2) not null,
  currency char(3) not null,
  status text not null default 'PENDING' check (status in ('PENDING','COMPLETED','FAILED','REVERSED')),
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

-- Atomic and idempotent: duplicate Pesapal IPNs cannot grant extra months.
create or replace function public.activate_v_analysis_payment(
  p_reference text, p_tracking_id text, p_amount numeric, p_currency text
) returns void
language plpgsql security definer set search_path = public
as $$
declare payment public.payment_orders%rowtype;
declare now_utc timestamptz := now();
begin
  select * into payment from public.payment_orders
  where merchant_reference = p_reference
  for update;
  if not found then raise exception 'Payment order not found'; end if;
  if payment.pesapal_tracking_id is distinct from p_tracking_id then
    raise exception 'Pesapal tracking ID mismatch';
  end if;
  if payment.amount <> p_amount or upper(payment.currency) <> upper(p_currency) then
    raise exception 'Payment amount or currency mismatch';
  end if;
  if payment.status = 'COMPLETED' then return; end if;
  update public.payment_orders set status='COMPLETED' where merchant_reference=p_reference;
  insert into public.subscriptions(user_id, plan, status, starts_at, expires_at, updated_at)
  values (payment.user_id, 'monthly', 'active', now_utc, now_utc + interval '1 month', now_utc)
  on conflict (user_id) do update set
    plan='monthly',
    status='active',
    starts_at=case when public.subscriptions.status='active'
      and public.subscriptions.expires_at > now_utc then public.subscriptions.starts_at
      else now_utc end,
    expires_at=greatest(coalesce(public.subscriptions.expires_at, now_utc), now_utc) + interval '1 month',
    updated_at=now_utc;
end;
$$;

alter table public.payment_orders enable row level security;
alter table public.subscriptions enable row level security;
drop policy if exists "users read own orders" on public.payment_orders;
drop policy if exists "users read own subscription" on public.subscriptions;
create policy "users read own orders" on public.payment_orders for select using (auth.uid() = user_id);
create policy "users read own subscription" on public.subscriptions for select using (auth.uid() = user_id);

-- Keep the payment-activation RPC private to trusted server code.
revoke all on function public.activate_v_analysis_payment(text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.activate_v_analysis_payment(text, text, numeric, text) to service_role;
