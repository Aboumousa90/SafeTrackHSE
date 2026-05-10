create extension if not exists "pgcrypto";

create type user_role as enum ('super_admin','company_admin','hse_manager','supervisor','employee');
create type severity_level as enum ('S1','S2','S3','S4','S5');
create type incident_status as enum ('draft','in_analysis','measures_defined','closed');
create type analysis_method as enum ('5why','fishbone','fmea','pareto','fault_tree','scatter');
create type muopo_category as enum ('M','U','O','P','O2');
create type priority_level as enum ('immediate','short_term','long_term');
create type measure_status as enum ('open','in_progress','completed','verified');
create type proactive_type as enum ('near_miss','unsafe_condition','unsafe_act','positive_observation');
create type risk_level as enum ('low','medium','high','critical');

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  industry text,
  country text,
  subscription_plan text not null default 'Basic',
  created_at timestamptz not null default now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  manager_id uuid
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  role user_role not null default 'employee',
  full_name text not null,
  email text not null unique,
  department_id uuid references public.departments(id),
  language text not null default 'nl',
  created_at timestamptz not null default now()
);

alter table public.departments add constraint departments_manager_fk foreign key (manager_id) references public.users(id);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  reference_number text not null unique,
  title text not null,
  description text not null check (char_length(description) >= 100),
  incident_date date not null,
  incident_time time not null,
  department_id uuid references public.departments(id),
  involved_person_id uuid references public.users(id),
  reporter_id uuid references public.users(id),
  location text not null,
  location_detail text,
  is_victim boolean not null default false,
  injury_location text,
  severity_level severity_level not null,
  severity_rationale text,
  is_pse boolean not null default false,
  is_undesired_release boolean not null default false,
  status incident_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.incident_pse_data (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  product_name text,
  cas_number text,
  quantity numeric,
  unit text,
  sds_url text,
  release_duration text,
  containment_status text,
  corporate_classification text,
  consequence_area text
);

create table public.incident_analyses (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  method analysis_method not null,
  ai_conversation jsonb not null default '[]',
  direct_causes text[] not null default '{}',
  underlying_causes text[] not null default '{}',
  root_causes text[] not null default '{}',
  contributing_factors text[] not null default '{}',
  analysis_data jsonb not null default '{}',
  completed_at timestamptz
);

create table public.incident_measures (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  muopo_category muopo_category not null,
  description text not null,
  responsible_person_id uuid references public.users(id),
  due_date date not null,
  priority priority_level not null,
  status measure_status not null default 'open',
  evidence_url text,
  completed_at timestamptz,
  verified_by uuid references public.users(id),
  verified_at timestamptz
);

create table public.incident_lessons (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  lesson text not null,
  applicable_departments text[] not null default '{}',
  created_by uuid references public.users(id)
);

create table public.proactive_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  department_id uuid references public.departments(id),
  reporter_id uuid references public.users(id),
  report_type proactive_type not null,
  description text not null,
  location text,
  photo_url text,
  risk_level risk_level not null,
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  assigned_to uuid references public.users(id),
  action_taken text,
  anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.observation_rounds (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  observer_id uuid references public.users(id),
  department_id uuid references public.departments(id),
  round_date date not null,
  round_time time not null,
  location text,
  observations jsonb not null default '[]',
  overall_score integer check (overall_score between 1 and 5),
  follow_up_required boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table public.hse_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  period_year integer not null,
  period_month integer not null check (period_month between 1 and 12),
  total_incidents integer not null default 0,
  incidents_by_severity jsonb not null default '{}',
  total_proactive_reports integer not null default 0,
  observation_rounds_count integer not null default 0,
  top_root_causes jsonb not null default '[]',
  top_departments jsonb not null default '[]',
  top_injury_types jsonb not null default '[]',
  muopo_breakdown jsonb not null default '{}',
  ai_insights text,
  generated_at timestamptz not null default now(),
  unique(company_id, period_year, period_month)
);

create table public.company_configs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  severity_matrix jsonb not null default '{}',
  corporate_pse_standard jsonb not null default '{}',
  notification_settings jsonb not null default '{}',
  report_template_url text,
  slide_template_url text
);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  incident_id uuid references public.incidents(id) on delete cascade,
  event_type text not null check (event_type in ('incident_created','incident_escalated','measure_overdue','analysis_completed','monthly_analytics_ready','proactive_high_risk')),
  channel text not null check (channel in ('email','push')),
  status text not null check (status in ('queued','sent','skipped','failed')),
  recipient text not null,
  payload jsonb not null default '{}',
  error text,
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_user_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.users where id = auth.uid()
$$;

create or replace function public.current_user_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() = 'super_admin', false)
$$;

create or replace function public.same_company(target_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or target_company_id = public.current_user_company_id()
$$;

alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.departments enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_pse_data enable row level security;
alter table public.incident_analyses enable row level security;
alter table public.incident_measures enable row level security;
alter table public.incident_lessons enable row level security;
alter table public.proactive_reports enable row level security;
alter table public.observation_rounds enable row level security;
alter table public.hse_analytics_snapshots enable row level security;
alter table public.company_configs enable row level security;
alter table public.notification_events enable row level security;
alter table public.push_subscriptions enable row level security;

create policy companies_tenant_read on public.companies for select using (public.same_company(id));
create policy users_tenant_read on public.users for select using (public.same_company(company_id));
create policy users_admin_write on public.users for all using (public.is_platform_admin() or (public.same_company(company_id) and public.current_user_role() in ('company_admin','hse_manager'))) with check (public.is_platform_admin() or public.same_company(company_id));
create policy departments_tenant_all on public.departments for all using (public.same_company(company_id)) with check (public.same_company(company_id));
create policy incidents_tenant_write on public.incidents for insert with check (public.same_company(company_id));
create policy incidents_tenant_update on public.incidents for update using (public.same_company(company_id)) with check (public.same_company(company_id));
create policy measures_tenant_all on public.incident_measures for all using (public.same_company(company_id)) with check (public.same_company(company_id));
create policy lessons_tenant_all on public.incident_lessons for all using (public.same_company(company_id)) with check (public.same_company(company_id));
create policy proactive_tenant_all on public.proactive_reports for all using (public.same_company(company_id)) with check (public.same_company(company_id));
create policy rounds_tenant_all on public.observation_rounds for all using (public.same_company(company_id)) with check (public.same_company(company_id));
create policy analytics_tenant_read on public.hse_analytics_snapshots for select using (public.same_company(company_id));
create policy configs_tenant_all on public.company_configs for all using (public.same_company(company_id)) with check (public.same_company(company_id));
create policy notification_events_tenant_all on public.notification_events for all using (public.same_company(company_id)) with check (public.same_company(company_id));
create policy push_subscriptions_tenant_all on public.push_subscriptions for all using (public.same_company(company_id)) with check (public.same_company(company_id));

create policy pse_data_by_incident_company on public.incident_pse_data for all
using (exists (select 1 from public.incidents i where i.id = incident_id and public.same_company(i.company_id)))
with check (exists (select 1 from public.incidents i where i.id = incident_id and public.same_company(i.company_id)));

create policy analyses_by_incident_company on public.incident_analyses for all
using (exists (select 1 from public.incidents i where i.id = incident_id and public.same_company(i.company_id)))
with check (exists (select 1 from public.incidents i where i.id = incident_id and public.same_company(i.company_id)));

create policy sensitive_victim_access on public.incidents for select
using (
  public.same_company(company_id)
  and (
    is_victim = false
    or public.current_user_role() in ('super_admin','company_admin','hse_manager')
    or reporter_id = auth.uid()
    or involved_person_id = auth.uid()
  )
);

create index incidents_company_status_idx on public.incidents(company_id, status);
create index incidents_company_date_idx on public.incidents(company_id, incident_date desc);
create index measures_company_status_due_idx on public.incident_measures(company_id, status, due_date);
create index proactive_company_risk_idx on public.proactive_reports(company_id, risk_level, status);
create index notification_events_company_status_idx on public.notification_events(company_id, status, created_at desc);
create index push_subscriptions_company_user_idx on public.push_subscriptions(company_id, user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'incident-attachments',
  'incident-attachments',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy incident_attachments_read on storage.objects for select
using (
  bucket_id = 'incident-attachments'
  and public.same_company((storage.foldername(name))[1]::uuid)
);

create policy incident_attachments_write on storage.objects for insert
with check (
  bucket_id = 'incident-attachments'
  and public.same_company((storage.foldername(name))[1]::uuid)
);
