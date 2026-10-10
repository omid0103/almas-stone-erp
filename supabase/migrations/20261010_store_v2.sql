begin;

-- Retail/POS extensions
alter table if exists public.products
  add column if not exists barcode text,
  add column if not exists purchase_price numeric(18,2) not null default 0,
  add column if not exists track_stock boolean not null default true;
create unique index if not exists products_barcode_uidx on public.products(barcode) where barcode is not null and btrim(barcode) <> '';

alter table if exists public.parties
  add column if not exists credit_limit numeric(18,2) not null default 0,
  add column if not exists tax_id text;

alter table if exists public.sales_invoices
  add column if not exists channel text not null default 'invoice',
  add column if not exists paid_amount numeric(18,2) not null default 0,
  add column if not exists returned_amount numeric(18,2) not null default 0,
  add column if not exists payment_status text not null default 'unpaid';
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname='sales_invoices_payment_status_check'
  ) then
    alter table public.sales_invoices
      add constraint sales_invoices_payment_status_check
      check (payment_status in ('unpaid','partial','paid','refunded'));
  end if;
end $$;

alter table if exists public.company_settings
  add column if not exists store_mode boolean not null default true,
  add column if not exists logo_url text;



-- Accounts payable / supplier settlement
alter table if exists public.purchase_invoices
  add column if not exists paid_amount numeric(18,2) not null default 0,
  add column if not exists payment_status text not null default 'unpaid';
do $ begin
  if not exists(select 1 from pg_constraint where conname='purchase_invoices_payment_status_check') then
    alter table public.purchase_invoices
      add constraint purchase_invoices_payment_status_check
      check(payment_status in ('unpaid','partial','paid'));
  end if;
end $;

alter table if exists public.financial_transactions
  add column if not exists purchase_invoice_id uuid references public.purchase_invoices(id) on delete set null;
create index if not exists financial_purchase_invoice_idx on public.financial_transactions(purchase_invoice_id);

create or replace view public.v_supplier_balances
with (security_invoker=true) as
select p.id as supplier_id,
       p.display_name,
       coalesce(sum(pi.total - coalesce(pi.paid_amount,0)),0) as balance
from public.parties p
left join public.purchase_invoices pi on pi.supplier_id=p.id
where p.party_type in ('supplier','both')
group by p.id,p.display_name;

-- Default retail walk-in customer
insert into public.parties(party_type,display_name,customer_kind,active)
select 'customer','مشتری نقدی','retail',true
where not exists(
  select 1 from public.parties
  where lower(display_name)=lower('مشتری نقدی')
    and party_type in ('customer','both')
);

-- Purchases can add either raw materials or finished retail products
alter table if exists public.purchase_items
  add column if not exists product_id uuid references public.products(id) on delete set null;
create index if not exists purchase_items_product_idx on public.purchase_items(product_id);

create or replace function public.purchase_product_stock_sync()
returns trigger
language plpgsql
security invoker
set search_path=public
as $
declare
  pdate date;
  pj text;
begin
  if new.product_id is null then return new; end if;
  select invoice_date,jalali_date into pdate,pj from public.purchase_invoices where id=new.purchase_id;
  insert into public.inventory_movements(product_id,movement_type,quantity,movement_date,jalali_date,ref_type,ref_id,notes)
  values(new.product_id,'purchase',new.quantity,coalesce(pdate,current_date),pj,'purchase_product',new.id,new.description);
  update public.products
    set purchase_price=new.unit_price,
        estimated_cost=case when estimated_cost=0 then new.unit_price else estimated_cost end
  where id=new.product_id;
  return new;
end;
$;

do $ begin
  if not exists(select 1 from pg_trigger where tgname='purchase_product_stock_sync_trg') then
    create trigger purchase_product_stock_sync_trg
      after insert on public.purchase_items
      for each row when (new.product_id is not null)
      execute function public.purchase_product_stock_sync();
  end if;
end $;

create or replace view public.v_product_stock
with (security_invoker=true) as
select p.id as product_id,
       p.name,
       p.unit,
       p.min_stock,
       coalesce(sum(case
         when im.movement_type in ('purchase','production','return_in','adjustment_in','release') then im.quantity
         when im.movement_type in ('sale','waste','return_out','adjustment_out','reservation') then -im.quantity
         else 0 end),0) as available_stock
from public.products p
left join public.inventory_movements im on im.product_id=p.id
group by p.id,p.name,p.unit,p.min_stock;

-- Cash register
create table if not exists public.cash_registers(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cash_sessions(
  id uuid primary key default gen_random_uuid(),
  register_id uuid not null references public.cash_registers(id) on delete restrict,
  opened_by uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  opening_balance numeric(18,2) not null default 0,
  closed_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,
  closing_balance numeric(18,2),
  expected_balance numeric(18,2),
  variance numeric(18,2),
  status text not null default 'open' check(status in ('open','closed')),
  notes text
);
create index if not exists cash_sessions_register_idx on public.cash_sessions(register_id,status);

alter table if exists public.financial_transactions
  add column if not exists cash_session_id uuid references public.cash_sessions(id) on delete set null;
create index if not exists financial_cash_session_idx on public.financial_transactions(cash_session_id);

-- Sales returns
create table if not exists public.sale_returns(
  id uuid primary key default gen_random_uuid(),
  return_no bigserial unique,
  invoice_id uuid not null references public.sales_invoices(id) on delete restrict,
  customer_id uuid references public.parties(id) on delete set null,
  return_date date not null default current_date,
  jalali_date text,
  subtotal numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0,
  refund_amount numeric(18,2) not null default 0,
  refund_method text,
  status text not null default 'confirmed' check(status in ('confirmed','cancelled')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.sale_return_items(
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.sale_returns(id) on delete cascade,
  invoice_item_id uuid references public.sales_invoice_items(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric(18,3) not null check(quantity > 0),
  unit_price numeric(18,2) not null default 0,
  line_total numeric(18,2) generated always as (quantity * unit_price) stored
);
create index if not exists sale_returns_invoice_idx on public.sale_returns(invoice_id);
create index if not exists sale_return_items_return_idx on public.sale_return_items(return_id);
create index if not exists sale_return_items_invoice_item_idx on public.sale_return_items(invoice_item_id);

-- Audit trail
create table if not exists public.audit_logs(
  id bigserial primary key,
  actor_id uuid,
  table_name text not null,
  record_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_record_idx on public.audit_logs(table_name,record_id);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

create or replace function public.audit_core_change()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
declare
  rid uuid;
begin
  begin
    rid := coalesce(new.id, old.id);
  exception when others then
    rid := null;
  end;
  insert into public.audit_logs(actor_id,table_name,record_id,action,old_data,new_data)
  values(
    auth.uid(),
    tg_table_name,
    rid,
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new,old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'products','parties','sales_invoices','purchase_invoices','expenses',
    'checks','inventory_movements','production_batches','payroll_periods'
  ] loop
    if to_regclass('public.'||t) is not null and not exists(
      select 1 from pg_trigger
      where tgname='audit_'||t and tgrelid=to_regclass('public.'||t)
    ) then
      execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_core_change()','audit_'||t,t);
    end if;
  end loop;
end $$;

-- Atomic return processing
create or replace function public.create_sale_return(
  p_invoice_id uuid,
  p_customer_id uuid,
  p_return_date date,
  p_jalali_date text,
  p_items jsonb,
  p_refund_amount numeric default 0,
  p_refund_method text default 'bank',
  p_notes text default null
) returns uuid
language plpgsql
security invoker
set search_path=public
as $$
declare
  r_id uuid;
  it jsonb;
  ii uuid;
  q numeric;
  sold_q numeric;
  returned_q numeric;
  prod uuid;
  descr text;
  price numeric;
  sum_total numeric := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then
    raise exception 'No return items supplied';
  end if;

  if not exists(select 1 from public.sales_invoices where id=p_invoice_id) then
    raise exception 'Invoice not found';
  end if;

  insert into public.sale_returns(invoice_id,customer_id,return_date,jalali_date,refund_amount,refund_method,notes,created_by)
  values(p_invoice_id,p_customer_id,coalesce(p_return_date,current_date),p_jalali_date,greatest(coalesce(p_refund_amount,0),0),p_refund_method,p_notes,auth.uid())
  returning id into r_id;

  for it in select * from jsonb_array_elements(p_items)
  loop
    ii := (it->>'invoice_item_id')::uuid;
    q := (it->>'quantity')::numeric;
    if q is null or q <= 0 then
      raise exception 'Invalid return quantity';
    end if;

    select sii.quantity,sii.product_id,sii.description,sii.unit_price
      into sold_q,prod,descr,price
    from public.sales_invoice_items sii
    where sii.id=ii and sii.invoice_id=p_invoice_id;

    if not found then
      raise exception 'Invoice item not found';
    end if;

    select coalesce(sum(sri.quantity),0)
      into returned_q
    from public.sale_return_items sri
    join public.sale_returns sr on sr.id=sri.return_id
    where sri.invoice_item_id=ii and sr.status='confirmed';

    if q > sold_q-returned_q then
      raise exception 'Return quantity exceeds remaining sold quantity';
    end if;

    insert into public.sale_return_items(return_id,invoice_item_id,product_id,description,quantity,unit_price)
    values(r_id,ii,prod,descr,q,price);

    sum_total := sum_total + q*price;

    if prod is not null then
      insert into public.inventory_movements(product_id,movement_type,quantity,movement_date,jalali_date,ref_type,ref_id,notes)
      values(prod,'return_in',q,coalesce(p_return_date,current_date),p_jalali_date,'sale_return',r_id,'مرجوعی فروش');
    end if;
  end loop;

  update public.sale_returns
    set subtotal=sum_total,total=sum_total,refund_amount=least(greatest(coalesce(p_refund_amount,0),0),sum_total)
  where id=r_id;

  update public.sales_invoices
    set returned_amount=coalesce(returned_amount,0)+sum_total,
        payment_status=case
          when coalesce(paid_amount,0)=0 and sum_total>=total then 'refunded'
          else payment_status
        end
  where id=p_invoice_id;

  if coalesce(p_refund_amount,0)>0 then
    insert into public.financial_transactions(direction,method,amount,transaction_date,jalali_date,description,party_id,invoice_id,created_by)
    values('payment',coalesce(p_refund_method,'bank'),least(p_refund_amount,sum_total),coalesce(p_return_date,current_date),p_jalali_date,'استرداد وجه مرجوعی فروش',p_customer_id,p_invoice_id,auth.uid());
  end if;

  return r_id;
end;
$$;



-- Safe invoice cancellation: keep audit trail and reverse stock only when no money/returns exist
create or replace function public.cancel_sales_invoice(p_invoice_id uuid)
returns void
language plpgsql
security invoker
set search_path=public
as $
declare
  inv public.sales_invoices%rowtype;
  it record;
begin
  select * into inv from public.sales_invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if inv.status='cancelled' then return; end if;
  if coalesce(inv.paid_amount,0)>0 then raise exception 'Paid invoice cannot be cancelled; reverse the payment first'; end if;
  if exists(select 1 from public.sale_returns where invoice_id=p_invoice_id and status='confirmed') then
    raise exception 'Invoice with confirmed returns cannot be cancelled';
  end if;
  for it in select product_id,quantity,description from public.sales_invoice_items where invoice_id=p_invoice_id and product_id is not null
  loop
    insert into public.inventory_movements(product_id,movement_type,quantity,movement_date,jalali_date,ref_type,ref_id,notes)
    values(it.product_id,'return_in',it.quantity,current_date,inv.jalali_date,'invoice_cancel',p_invoice_id,'برگشت موجودی بابت ابطال فاکتور');
  end loop;
  update public.sales_invoices set status='cancelled',payment_status='unpaid' where id=p_invoice_id;
end;
$;

-- Secure user invitations: public sign-up is rejected unless an owner/admin created an invite
create table if not exists public.user_invites(
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  role app_role not null default 'sales',
  status text not null default 'pending' check(status in ('pending','accepted','cancelled','expired')),
  expires_at timestamptz not null default (now()+interval '7 days'),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists user_invites_status_idx on public.user_invites(status,expires_at);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $
declare
  profile_count bigint;
  inv public.user_invites%rowtype;
begin
  select count(*) into profile_count from public.profiles;
  if profile_count=0 then
    insert into public.profiles(id,full_name,role,active)
    values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.email,'مالک'),'owner',true)
    on conflict(id) do nothing;
    return new;
  end if;

  select * into inv
  from public.user_invites
  where lower(email)=lower(new.email)
    and status='pending'
    and expires_at>now()
  limit 1
  for update;

  if not found then
    raise exception 'INVITE_REQUIRED';
  end if;

  insert into public.profiles(id,full_name,role,active)
  values(new.id,coalesce(inv.full_name,new.raw_user_meta_data->>'full_name',new.email),inv.role,true)
  on conflict(id) do update
    set full_name=excluded.full_name, role=excluded.role, active=true;

  update public.user_invites set status='accepted' where id=inv.id;
  return new;
end;
$;

-- RLS
alter table public.cash_registers enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.sale_returns enable row level security;
alter table public.sale_return_items enable row level security;
alter table public.audit_logs enable row level security;\nalter table public.user_invites enable row level security;

do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='cash_registers' and policyname='cash registers access') then
    create policy "cash registers access" on public.cash_registers for all to authenticated
      using (public.current_role() = any(array['owner'::app_role,'admin'::app_role,'accountant'::app_role,'sales'::app_role]))
      with check (public.current_role() = any(array['owner'::app_role,'admin'::app_role,'accountant'::app_role,'sales'::app_role]));
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='cash_sessions' and policyname='cash sessions access') then
    create policy "cash sessions access" on public.cash_sessions for all to authenticated
      using (public.current_role() = any(array['owner'::app_role,'admin'::app_role,'accountant'::app_role,'sales'::app_role]))
      with check (public.current_role() = any(array['owner'::app_role,'admin'::app_role,'accountant'::app_role,'sales'::app_role]));
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='sale_returns' and policyname='sale returns access') then
    create policy "sale returns access" on public.sale_returns for all to authenticated
      using (public.current_role() = any(array['owner'::app_role,'admin'::app_role,'accountant'::app_role,'sales'::app_role]))
      with check (public.current_role() = any(array['owner'::app_role,'admin'::app_role,'accountant'::app_role,'sales'::app_role]));
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='sale_return_items' and policyname='sale return items access') then
    create policy "sale return items access" on public.sale_return_items for all to authenticated
      using (public.current_role() = any(array['owner'::app_role,'admin'::app_role,'accountant'::app_role,'sales'::app_role]))
      with check (public.current_role() = any(array['owner'::app_role,'admin'::app_role,'accountant'::app_role,'sales'::app_role]));
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='user_invites' and policyname='user invites access') then
    create policy "user invites access" on public.user_invites for all to authenticated
      using (public.current_role() = any(array['owner'::app_role,'admin'::app_role]))
      with check (public.current_role() = any(array['owner'::app_role,'admin'::app_role]));
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='audit_logs' and policyname='audit logs read') then
    create policy "audit logs read" on public.audit_logs for select to authenticated
      using (public.current_role() = any(array['owner'::app_role,'admin'::app_role]));
  end if;
end $$;

revoke all on public.cash_registers, public.cash_sessions, public.sale_returns, public.sale_return_items, public.audit_logs, public.user_invites from anon;
grant select,insert,update,delete on public.cash_registers, public.cash_sessions, public.sale_returns, public.sale_return_items, public.user_invites to authenticated;
grant select on public.audit_logs to authenticated;
grant usage,select on sequence public.sale_returns_return_no_seq to authenticated;
grant usage,select on sequence public.audit_logs_id_seq to authenticated;
grant execute on function public.create_sale_return(uuid,uuid,date,text,jsonb,numeric,text,text) to authenticated;\ngrant execute on function public.cancel_sales_invoice(uuid) to authenticated;

commit;
