-- Schema for Rent Whisperer Supabase Database
-- Run this script in the Supabase SQL Editor to set up your database

-- Enable Row Level Security
alter table if exists auth.users enable row level security;

-- Create properties table first (no foreign key dependencies)
create table if not exists public.properties (
  id serial primary key,
  name text not null,
  address text not null,
  city text not null,
  province text not null,
  postal_code text not null,
  landlord_id integer not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Create units table (depends on properties)
create table if not exists public.units (
  id serial primary key,
  unit_number text not null,
  property_id integer not null references public.properties(id),
  rent_amount numeric not null,
  rent_due_day integer not null,
  lease_start timestamp with time zone not null,
  lease_end timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Create tenants table (depends on units)
create table if not exists public.tenants (
  id serial primary key,
  first_name text not null,
  last_name text not null,
  email text,
  phone text not null,
  unit_id integer not null references public.units(id),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Create rent_payments table (depends on tenants and units)
create table if not exists public.rent_payments (
  id serial primary key,
  tenant_id integer not null references public.tenants(id),
  unit_id integer not null references public.units(id),
  amount numeric not null,
  due_date date not null,
  payment_date date,
  status text not null,
  payment_method text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Create notifications table (depends on tenants)
create table if not exists public.notifications (
  id serial primary key,
  tenant_id integer not null references public.tenants(id),
  type text not null,
  message text not null,
  sent_at timestamp with time zone,
  delivered_at timestamp with time zone,
  read_at timestamp with time zone,
  status text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Insert test property
INSERT INTO public.properties (name, address, city, province, postal_code, landlord_id)
VALUES ('Test Property', '123 Main St', 'Toronto', 'ON', 'A1A1A1', 1);

-- Insert test unit
INSERT INTO public.units (unit_number, property_id, rent_amount, rent_due_day, lease_start)
VALUES ('101', 1, 1500, 1, '2025-05-01T00:00:00Z');
