-- Durable AI rate limiting. The in-process limiter does not work across
-- serverless instances; this table + RPC give one shared counter per user.

create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  created_at timestamptz not null default now()
);

create index ai_usage_events_user_time_idx
  on public.ai_usage_events (user_key, created_at desc);

-- No direct table access: rows are only written through the RPC below.
alter table public.ai_usage_events enable row level security;

create or replace function public.consume_ai_rate_limit(
  p_user_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
begin
  -- Serialise concurrent calls for the same user so the count is accurate.
  perform pg_advisory_xact_lock(hashtext(p_user_key));

  select count(*) into used
  from public.ai_usage_events
  where user_key = p_user_key
    and created_at > now() - make_interval(secs => p_window_seconds);

  if used >= p_limit then
    return query select false, 0;
    return;
  end if;

  insert into public.ai_usage_events (user_key) values (p_user_key);
  return query select true, p_limit - used - 1;
end;
$$;

grant execute on function public.consume_ai_rate_limit(text, integer, integer) to authenticated;

-- Housekeeping helper: call periodically (e.g. pg_cron) to drop old events.
create or replace function public.prune_ai_usage_events(p_older_than_hours integer default 24)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.ai_usage_events
  where created_at < now() - make_interval(hours => p_older_than_hours);
$$;
