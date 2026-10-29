-- Community-suggested categories: profiles remain visible immediately, while
-- administrators decide whether a suggested name joins the official category list.
create table public.approved_categories (
  category text primary key check (length(trim(category)) between 1 and 80),
  label text not null check (length(trim(label)) between 1 and 80),
  created_at timestamptz not null default now()
);

insert into public.approved_categories (category, label) values
  ('Atmosferico', 'Atmosférico'),
  ('Bombas', 'Bombas'),
  ('Car wash/lavadero', 'Lavadero'),
  ('Cerrajeria', 'Cerrajería'),
  ('Contenedores', 'Contenedores'),
  ('Electricistas', 'Electricidad'),
  ('Jardineria/poda/cesped', 'Jardinería y poda'),
  ('Plomeria/piletas', 'Plomería y piletas'),
  ('Pozos/pozero', 'Pozos'),
  ('Volquetes', 'Volquetes')
on conflict (category) do nothing;

create table public.provider_category_suggestions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  suggested_category text not null check (length(trim(suggested_category)) between 1 and 80),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid not null references auth.users (id) on delete restrict,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index provider_category_suggestions_status_created_idx
  on public.provider_category_suggestions (status, created_at desc);

create or replace function public.submit_provider_contribution_v2(
  p_name text,
  p_phone text,
  p_category text,
  p_suggested_category text,
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
  v_category text;
begin
  if auth.uid() is null or not public.has_neighborhood_access() then
    raise exception 'neighborhood-access-required' using errcode = '42501';
  end if;
  if p_can_share_phone is distinct from true then
    raise exception 'phone-sharing-not-confirmed' using errcode = '22023';
  end if;
  if nullif(trim(p_name), '') is null or length(trim(p_name)) > 160 then
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

  if p_category is null then
    if nullif(trim(p_suggested_category), '') is null or length(trim(p_suggested_category)) > 80 then
      raise exception 'suggested-category-required' using errcode = '22023';
    end if;
    v_category := 'Sugerido';
  elsif exists (select 1 from public.approved_categories category where category.category = p_category) then
    if nullif(trim(p_suggested_category), '') is not null then
      raise exception 'invalid-category-selection' using errcode = '22023';
    end if;
    v_category := p_category;
  else
    raise exception 'invalid-category' using errcode = '22023';
  end if;

  v_phone := public.normalize_argentina_mobile(p_phone);
  if v_phone is null then
    raise exception 'invalid-phone' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_phone, 0));

  select contact.provider_id into v_provider_id
    from public.provider_contacts contact where contact.normalized_phone = v_phone;
  if v_provider_id is null then
    insert into public.providers (name, category)
    values (trim(p_name), v_category)
    returning id into v_provider_id;
    insert into public.provider_contacts (provider_id, normalized_phone)
    values (v_provider_id, v_phone);
    v_created := true;
  end if;

  if p_category is null then
    insert into public.provider_category_suggestions (provider_id, suggested_category, submitted_by)
    values (v_provider_id, trim(p_suggested_category), auth.uid());
  end if;

  insert into public.recommendations (provider_id, reason, rating, display_author_name)
  values (v_provider_id, trim(p_reason), p_rating, nullif(trim(p_display_author_name), ''))
  returning id into v_recommendation_id;
  insert into public.recommendation_attributions (recommendation_id, author_id)
  values (v_recommendation_id, auth.uid());

  return pg_catalog.jsonb_build_object(
    'provider_id', v_provider_id,
    'recommendation_id', v_recommendation_id,
    'created', v_created
  );
end;
$$;

create or replace function public.approve_category_suggestion(p_suggestion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suggestion public.provider_category_suggestions%rowtype;
begin
  if auth.uid() is null or not public.is_app_admin() then
    raise exception 'admin-required' using errcode = '42501';
  end if;
  select suggestion.* into v_suggestion
    from public.provider_category_suggestions suggestion
   where suggestion.id = p_suggestion_id and suggestion.status = 'pending'
   for update;
  if not found then
    raise exception 'suggestion-not-found' using errcode = 'P0002';
  end if;

  insert into public.approved_categories (category, label)
  values (v_suggestion.suggested_category, v_suggestion.suggested_category)
  on conflict (category) do nothing;
  update public.providers set category = v_suggestion.suggested_category, updated_at = now()
   where id = v_suggestion.provider_id;
  update public.provider_category_suggestions
     set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
   where id = v_suggestion.id;
end;
$$;

alter table public.approved_categories enable row level security;
alter table public.provider_category_suggestions enable row level security;

create policy approved_categories_public_read on public.approved_categories
  for select to anon, authenticated using (true);
create policy approved_categories_admin_all on public.approved_categories
  for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy provider_category_suggestions_pending_public_read on public.provider_category_suggestions
  for select to anon, authenticated using (status = 'pending' or public.is_app_admin());
create policy provider_category_suggestions_admin_all on public.provider_category_suggestions
  for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

revoke all on public.approved_categories from anon, authenticated;
revoke all on public.provider_category_suggestions from anon, authenticated;
grant select on public.approved_categories to anon, authenticated;
grant select, insert, update, delete on public.provider_category_suggestions to authenticated;
grant execute on function public.submit_provider_contribution_v2(text, text, text, text, text, boolean, text, smallint) to authenticated;
grant execute on function public.approve_category_suggestion(uuid) to authenticated;
revoke execute on function public.submit_provider_contribution_v2(text, text, text, text, text, boolean, text, smallint) from public, anon;
revoke execute on function public.approve_category_suggestion(uuid) from public, anon;
