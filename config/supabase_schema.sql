-- Schema for Rent Whisperer Supabase Database

-- Enable Row Level Security
alter table if exists auth.users enable row level security;

-- Create tenants table
create table if not exists public.tenants (
  id uuid default uuid_generate_v4() primary key,
  first_name text not null,
  last_name text not null,
  email text,
  phone text not null,
  unit_id uuid not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Create properties table
create table if not exists public.properties (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  address text not null,
  city text not null,
  province text not null,
  postal_code text not null,
  landlord_id uuid not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Create units table
create table if not exists public.units (
  id uuid default uuid_generate_v4() primary key,
  unit_number text not null,
  property_id uuid not null references public.properties(id),
  rent_amount numeric not null,
  rent_due_day integer not null,
  lease_start timestamp with time zone not null,
  lease_end timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Create rent_payments table
create table if not exists public.rent_payments (
  id uuid default uuid_generate_v4() primary key,
  tenant_id uuid not null references public.tenants(id),
  unit_id uuid not null references public.units(id),
  amount numeric not null,
  due_date date not null,
  payment_date date,
  status text not null check (status in ('pending', 'paid', 'late', 'partial')),
  payment_method text,
  interac_request_link text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Create notifications table
create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  tenant_id uuid not null references public.tenants(id),
  payment_id uuid references public.rent_payments(id),
  type text not null check (type in ('rent_due', 'rent_late', 'receipt', 'form_n4', 'form_l1')),
  channel text not null check (channel in ('whatsapp', 'email')),
  status text not null check (status in ('pending', 'sent', 'delivered', 'read', 'failed')),
  message_id text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Create incoming_messages table
create table if not exists public.incoming_messages (
  id uuid default uuid_generate_v4() primary key,
  phone_number text not null,
  message_id text,
  message_text text,
  received_at timestamp with time zone not null,
  processed boolean default false not null,
  payment_id uuid references public.rent_payments(id),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Create landlords table
create table if not exists public.landlords (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id),
  business_name text,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Add foreign key constraint for landlords in properties
alter table public.properties
  add constraint properties_landlord_id_fkey
  foreign key (landlord_id)
  references public.landlords(id);

-- Add foreign key constraint for units in tenants
alter table public.tenants
  add constraint tenants_unit_id_fkey
  foreign key (unit_id)
  references public.units(id);

-- Create functions for automatic updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create triggers for updating updated_at
create trigger update_tenants_updated_at
  before update on public.tenants
  for each row execute function public.update_updated_at_column();

create trigger update_properties_updated_at
  before update on public.properties
  for each row execute function public.update_updated_at_column();

create trigger update_units_updated_at
  before update on public.units
  for each row execute function public.update_updated_at_column();

create trigger update_rent_payments_updated_at
  before update on public.rent_payments
  for each row execute function public.update_updated_at_column();

create trigger update_notifications_updated_at
  before update on public.notifications
  for each row execute function public.update_updated_at_column();

create trigger update_incoming_messages_updated_at
  before update on public.incoming_messages
  for each row execute function public.update_updated_at_column();

create trigger update_landlords_updated_at
  before update on public.landlords
  for each row execute function public.update_updated_at_column();

-- Create indexes for performance
create index if not exists tenants_unit_id_idx on public.tenants(unit_id);
create index if not exists units_property_id_idx on public.units(property_id);
create index if not exists rent_payments_tenant_id_idx on public.rent_payments(tenant_id);
create index if not exists rent_payments_unit_id_idx on public.rent_payments(unit_id);
create index if not exists rent_payments_due_date_idx on public.rent_payments(due_date);
create index if not exists rent_payments_status_idx on public.rent_payments(status);
create index if not exists notifications_tenant_id_idx on public.notifications(tenant_id);
create index if not exists notifications_payment_id_idx on public.notifications(payment_id);
create index if not exists notifications_status_idx on public.notifications(status);
create index if not exists incoming_messages_phone_number_idx on public.incoming_messages(phone_number);
create index if not exists incoming_messages_processed_idx on public.incoming_messages(processed);

-- Create RLS policies
-- Note: These would typically be more restrictive in a production environment

-- Tenants policies
alter table public.tenants enable row level security;
create policy "Enable read access for all users" on public.tenants for select using (true);
create policy "Enable insert for authenticated users" on public.tenants for insert with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users" on public.tenants for update using (auth.role() = 'authenticated');

-- Properties policies
alter table public.properties enable row level security;
create policy "Enable read access for all users" on public.properties for select using (true);
create policy "Enable insert for authenticated users" on public.properties for insert with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users" on public.properties for update using (auth.role() = 'authenticated');

-- Units policies
alter table public.units enable row level security;
create policy "Enable read access for all users" on public.units for select using (true);
create policy "Enable insert for authenticated users" on public.units for insert with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users" on public.units for update using (auth.role() = 'authenticated');

-- Rent payments policies
alter table public.rent_payments enable row level security;
create policy "Enable read access for all users" on public.rent_payments for select using (true);
create policy "Enable insert for authenticated users" on public.rent_payments for insert with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users" on public.rent_payments for update using (auth.role() = 'authenticated');

-- Notifications policies
alter table public.notifications enable row level security;
create policy "Enable read access for all users" on public.notifications for select using (true);
create policy "Enable insert for authenticated users" on public.notifications for insert with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users" on public.notifications for update using (auth.role() = 'authenticated');

-- Incoming messages policies
alter table public.incoming_messages enable row level security;
create policy "Enable read access for all users" on public.incoming_messages for select using (true);
create policy "Enable insert for all users" on public.incoming_messages for insert with check (true);
create policy "Enable update for authenticated users" on public.incoming_messages for update using (auth.role() = 'authenticated');

-- Landlords policies
alter table public.landlords enable row level security;
create policy "Enable read access for all users" on public.landlords for select using (true);
create policy "Enable insert for authenticated users" on public.landlords for insert with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users" on public.landlords for update using (auth.role() = 'authenticated');
