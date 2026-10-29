-- OFIDI Los Sauces pilot schema.
-- Phone numbers live in a separate RLS-protected table; public profiles never expose them.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.neighborhood_memberships (
  user_id uuid not null references auth.users (id) on delete cascade,
  neighborhood_slug text not null default 'los-sauces',
  created_at timestamptz not null default now(),
  primary key (user_id, neighborhood_slug)
);

create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null,
  max_uses integer not null check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (used_count <= max_uses)
);

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  category text not null check (length(trim(category)) between 1 and 80),
  aliases text[] not null default '{}',
  status text not null default 'community_unverified'
    check (status in ('community_unverified', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.provider_contacts (
  provider_id uuid primary key references public.providers (id) on delete cascade,
  normalized_phone text not null unique
    check (normalized_phone ~ '^549[0-9]{10}$'),
  created_at timestamptz not null default now()
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  reason text not null check (length(trim(reason)) between 1 and 1000),
  rating smallint check (rating between 1 and 5),
  source_label text,
  display_author_name text check (
    display_author_name is null or length(trim(display_author_name)) between 1 and 100
  ),
  initial_import_key text unique,
  created_at timestamptz not null default now()
);

-- Kept separate so public recommendation reads cannot reveal the contributor's user id.
create table public.recommendation_attributions (
  recommendation_id uuid primary key references public.recommendations (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete restrict,
  reason text not null check (length(trim(reason)) between 1 and 120),
  details text check (details is null or length(trim(details)) <= 2000),
  status text not null default 'open'
    check (status in ('open', 'under_review', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Intentionally no actor/user id: this measures a contact-link click, not a conversation or job.
create table public.contact_clicks (
  id bigint generated always as identity primary key,
  provider_id uuid not null references public.providers (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Search analytics store result counts only: no raw query and no user identifier.
create table public.search_events (
  id bigint generated always as identity primary key,
  results_count integer not null check (results_count between 0 and 1000),
  created_at timestamptz not null default now()
);

create index recommendations_provider_created_idx
  on public.recommendations (provider_id, created_at desc);
create index reports_status_created_idx
  on public.reports (status, created_at desc);
create index contact_clicks_provider_created_idx
  on public.contact_clicks (provider_id, created_at desc);

create or replace function public.normalize_argentina_mobile(p_phone text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digits text;
begin
  if p_phone is null then
    return null;
  end if;

  v_digits := regexp_replace(p_phone, '[^0-9]', '', 'g');
  if left(v_digits, 2) = '00' then
    v_digits := substr(v_digits, 3);
  end if;

  if v_digits ~ '^549[0-9]{10}$' then
    return v_digits;
  end if;

  return null;
end;
$$;

create or replace function public.has_neighborhood_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.neighborhood_memberships membership
    where membership.user_id = auth.uid()
      and membership.neighborhood_slug = 'los-sauces'
  );
$$;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_admins administrator
    where administrator.user_id = auth.uid()
  );
$$;

create or replace function public.redeem_invite_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.invite_codes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication-required' using errcode = '42501';
  end if;
  if nullif(trim(p_code), '') is null then
    raise exception 'invalid-invite-code' using errcode = '22023';
  end if;

  if public.has_neighborhood_access() then
    return true;
  end if;

  select invite.*
    into v_invite
    from public.invite_codes invite
   where invite.is_active
     and (invite.expires_at is null or invite.expires_at > now())
     and invite.used_count < invite.max_uses
     and extensions.crypt(trim(p_code), invite.code_hash) = invite.code_hash
   for update;

  if not found then
    raise exception 'invalid-invite-code' using errcode = '22023';
  end if;

  update public.invite_codes
     set used_count = used_count + 1
   where id = v_invite.id;

  insert into public.neighborhood_memberships (user_id, neighborhood_slug)
  values (auth.uid(), 'los-sauces')
  on conflict (user_id, neighborhood_slug) do nothing;

  return true;
end;
$$;

create or replace function public.submit_provider_contribution(
  p_name text,
  p_phone text,
  p_category text,
  p_reason text,
  p_can_share_phone boolean,
  p_display_author_name text default null,
  p_rating smallint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
  v_provider_id uuid;
  v_recommendation_id uuid;
  v_created boolean := false;
begin
  if auth.uid() is null or not public.has_neighborhood_access() then
    raise exception 'neighborhood-access-required' using errcode = '42501';
  end if;
  if p_can_share_phone is distinct from true then
    raise exception 'phone-sharing-not-confirmed' using errcode = '22023';
  end if;
  if nullif(trim(p_name), '') is null or length(trim(p_name)) > 160
     or nullif(trim(p_category), '') is null or length(trim(p_category)) > 80 then
    raise exception 'provider-details-required' using errcode = '22023';
  end if;
  if nullif(trim(p_reason), '') is null or length(trim(p_reason)) > 1000 then
    raise exception 'recommendation-required' using errcode = '22023';
  end if;
  if p_rating is not null and p_rating not between 1 and 5 then
    raise exception 'invalid-rating' using errcode = '22023';
  end if;
  if p_display_author_name is not null
     and length(trim(p_display_author_name)) not between 1 and 100 then
    raise exception 'invalid-display-author-name' using errcode = '22023';
  end if;

  v_phone := public.normalize_argentina_mobile(p_phone);
  if v_phone is null then
    raise exception 'invalid-phone' using errcode = '22023';
  end if;

  -- Serialize concurrent submissions for the same phone before checking/inserting.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_phone, 0));

  select contact.provider_id
    into v_provider_id
    from public.provider_contacts contact
   where contact.normalized_phone = v_phone;

  if v_provider_id is null then
    insert into public.providers (name, category)
    values (trim(p_name), trim(p_category))
    returning id into v_provider_id;

    insert into public.provider_contacts (provider_id, normalized_phone)
    values (v_provider_id, v_phone);
    v_created := true;
  end if;

  insert into public.recommendations (
    provider_id, reason, rating, display_author_name
  ) values (
    v_provider_id,
    trim(p_reason),
    p_rating,
    nullif(trim(p_display_author_name), '')
  ) returning id into v_recommendation_id;

  insert into public.recommendation_attributions (recommendation_id, author_id)
  values (v_recommendation_id, auth.uid());

  return pg_catalog.jsonb_build_object(
    'provider_id', v_provider_id,
    'recommendation_id', v_recommendation_id,
    'created', v_created
  );
end;
$$;

create or replace function public.admin_import_candidate(
  p_import_key text,
  p_name text,
  p_phone text,
  p_category text,
  p_aliases text[],
  p_reason text,
  p_uploader_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
  v_provider_id uuid;
  v_recommendation_id uuid;
  v_created_profile boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service-role-required' using errcode = '42501';
  end if;
  if p_uploader_id is null or not exists (
    select 1 from public.app_admins administrator
    where administrator.user_id = p_uploader_id
  ) then
    raise exception 'registered-admin-required' using errcode = '42501';
  end if;
  if p_import_key is null or p_import_key !~ '^initial-candidates:[a-zA-Z0-9_-]+$' then
    raise exception 'invalid-import-key' using errcode = '22023';
  end if;
  if nullif(trim(p_name), '') is null or length(trim(p_name)) > 160
     or nullif(trim(p_category), '') is null or length(trim(p_category)) > 80 then
    raise exception 'provider-details-required' using errcode = '22023';
  end if;
  if nullif(trim(p_reason), '') is null or length(trim(p_reason)) > 1000 then
    raise exception 'source-note-required' using errcode = '22023';
  end if;

  v_phone := public.normalize_argentina_mobile(p_phone);
  if v_phone is null then
    raise exception 'invalid-phone' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_phone, 0));

  select recommendation.id, recommendation.provider_id
    into v_recommendation_id, v_provider_id
    from public.recommendations recommendation
   where recommendation.initial_import_key = p_import_key;
  if found then
    return pg_catalog.jsonb_build_object(
      'provider_id', v_provider_id,
      'recommendation_id', v_recommendation_id,
      'created_profile', false,
      'already_imported', true
    );
  end if;

  select contact.provider_id
    into v_provider_id
    from public.provider_contacts contact
   where contact.normalized_phone = v_phone;

  if v_provider_id is null then
    insert into public.providers (name, category, aliases)
    values (trim(p_name), trim(p_category), coalesce(p_aliases, '{}'::text[]))
    returning id into v_provider_id;

    insert into public.provider_contacts (provider_id, normalized_phone)
    values (v_provider_id, v_phone);
    v_created_profile := true;
  else
    update public.providers provider
       set aliases = (
         select coalesce(array_agg(alias order by alias), '{}'::text[])
           from (
             select distinct trim(candidate) as alias
               from unnest(
                 coalesce(provider.aliases, '{}'::text[])
                 || coalesce(p_aliases, '{}'::text[])
                 || array[trim(p_name)]
               ) as alias_candidates(candidate)
              where nullif(trim(candidate), '') is not null
                and lower(trim(candidate)) <> lower(trim(provider.name))
           ) alias_values
       ),
       updated_at = now()
     where provider.id = v_provider_id;
  end if;

  insert into public.recommendations (
    provider_id, reason, source_label, initial_import_key
  ) values (
    v_provider_id,
    trim(p_reason),
    'Registro histórico interno · vigencia no revalidada',
    p_import_key
  ) returning id into v_recommendation_id;

  insert into public.recommendation_attributions (recommendation_id, author_id)
  values (v_recommendation_id, p_uploader_id);

  return pg_catalog.jsonb_build_object(
    'provider_id', v_provider_id,
    'recommendation_id', v_recommendation_id,
    'created_profile', v_created_profile,
    'already_imported', false
  );
end;
$$;

create or replace function public.submit_provider_report(
  p_provider_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report_id uuid;
begin
  if auth.uid() is null or not public.has_neighborhood_access() then
    raise exception 'neighborhood-access-required' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null or length(trim(p_reason)) > 120 then
    raise exception 'report-reason-required' using errcode = '22023';
  end if;
  if p_details is not null and length(trim(p_details)) > 2000 then
    raise exception 'report-details-too-long' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.providers provider where provider.id = p_provider_id
  ) then
    raise exception 'provider-not-found' using errcode = 'P0002';
  end if;

  insert into public.reports (provider_id, reporter_id, reason, details)
  values (p_provider_id, auth.uid(), trim(p_reason), nullif(trim(p_details), ''))
  returning id into v_report_id;

  return v_report_id;
end;
$$;

create or replace function public.record_contact_click(p_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_neighborhood_access() then
    raise exception 'neighborhood-access-required' using errcode = '42501';
  end if;
  if not exists (
    select 1
      from public.providers provider
      join public.provider_contacts contact on contact.provider_id = provider.id
     where provider.id = p_provider_id
       and provider.status <> 'disabled'
  ) then
    raise exception 'provider-not-found' using errcode = 'P0002';
  end if;

  insert into public.contact_clicks (provider_id) values (p_provider_id);
end;
$$;

create or replace function public.record_directory_search(p_results_count integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_results_count is null or p_results_count not between 0 and 1000 then
    raise exception 'invalid-results-count' using errcode = '22023';
  end if;

  insert into public.search_events (results_count) values (p_results_count);
end;
$$;

alter table public.neighborhood_memberships enable row level security;
alter table public.app_admins enable row level security;
alter table public.invite_codes enable row level security;
alter table public.providers enable row level security;
alter table public.provider_contacts enable row level security;
alter table public.recommendations enable row level security;
alter table public.recommendation_attributions enable row level security;
alter table public.reports enable row level security;
alter table public.contact_clicks enable row level security;
alter table public.search_events enable row level security;

create policy neighborhood_membership_self_or_admin_read
  on public.neighborhood_memberships for select to authenticated
  using (user_id = auth.uid() or public.is_app_admin());

create policy app_admins_admin_read
  on public.app_admins for select to authenticated
  using (public.is_app_admin());

-- No client policy is defined for invite_codes: access is only through the redemption RPC.

create policy providers_public_directory_read
  on public.providers for select to anon, authenticated
  using (status <> 'disabled');
create policy providers_admin_all
  on public.providers for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy provider_contacts_member_read
  on public.provider_contacts for select to authenticated
  using (
    public.is_app_admin()
    or (
      public.has_neighborhood_access()
      and exists (
        select 1 from public.providers provider
        where provider.id = provider_contacts.provider_id
          and provider.status <> 'disabled'
      )
    )
  );
create policy provider_contacts_admin_all
  on public.provider_contacts for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy recommendations_public_read
  on public.recommendations for select to anon, authenticated
  using (true);

create policy recommendation_attributions_author_or_admin_read
  on public.recommendation_attributions for select to authenticated
  using (author_id = auth.uid() or public.is_app_admin());

create policy reports_admin_read
  on public.reports for select to authenticated
  using (public.is_app_admin());
create policy reports_admin_update
  on public.reports for update to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy contact_clicks_admin_read
  on public.contact_clicks for select to authenticated
  using (public.is_app_admin());

create policy search_events_admin_read
  on public.search_events for select to authenticated
  using (public.is_app_admin());

revoke all on public.neighborhood_memberships from anon, authenticated;
revoke all on public.app_admins from anon, authenticated;
revoke all on public.invite_codes from anon, authenticated;
revoke all on public.provider_contacts from anon, authenticated;
revoke all on public.recommendation_attributions from anon, authenticated;
revoke all on public.reports from anon, authenticated;
revoke all on public.contact_clicks from anon, authenticated;
revoke all on public.search_events from anon, authenticated;
revoke insert, update, delete on public.providers from anon, authenticated;
revoke insert, update, delete on public.recommendations from anon, authenticated;

-- Public directory fields only; RLS still excludes disabled entries.
grant select on public.providers, public.recommendations to anon, authenticated;
grant insert, update, delete on public.providers to authenticated;
grant select, insert, update, delete on public.provider_contacts to authenticated;
grant select on public.recommendation_attributions to authenticated;
grant select on public.neighborhood_memberships, public.app_admins to authenticated;
grant select, update on public.reports to authenticated;
grant select on public.contact_clicks, public.search_events to authenticated;

grant execute on function public.normalize_argentina_mobile(text) to anon, authenticated;
grant execute on function public.has_neighborhood_access() to authenticated;
grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.redeem_invite_code(text) to authenticated;
grant execute on function public.submit_provider_contribution(text, text, text, text, boolean, text, smallint) to authenticated;
grant execute on function public.admin_import_candidate(text, text, text, text, text[], text, uuid) to service_role;
grant execute on function public.submit_provider_report(uuid, text, text) to authenticated;
grant execute on function public.record_contact_click(uuid) to authenticated;
grant execute on function public.record_directory_search(integer) to anon, authenticated;

revoke execute on function public.redeem_invite_code(text) from public, anon;
revoke execute on function public.submit_provider_contribution(text, text, text, text, boolean, text, smallint) from public, anon;
revoke execute on function public.admin_import_candidate(text, text, text, text, text[], text, uuid) from public, anon, authenticated;
revoke execute on function public.submit_provider_report(uuid, text, text) from public, anon;
revoke execute on function public.record_contact_click(uuid) from public, anon;
revoke execute on function public.record_directory_search(integer) from public;

revoke execute on function public.is_app_admin() from public, anon;
revoke execute on function public.has_neighborhood_access() from public, anon;

-- After creating the first Google-auth user, add that UUID as the pilot admin:
-- insert into public.app_admins (user_id) values ('<AUTH_USER_UUID>');
-- Create a private invite code in the SQL editor (never put the plaintext in this repo):
-- insert into public.invite_codes (code_hash, max_uses, expires_at)
-- values (extensions.crypt('<PRIVATE_CODE>', extensions.gen_salt('bf')), 50, null);
