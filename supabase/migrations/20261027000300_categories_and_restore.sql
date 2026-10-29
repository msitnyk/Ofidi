-- Standardize the ten pilot categories used by existing imported candidates.
-- New neighbor contributions are published immediately; administrators only disable/restore later.
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
  if nullif(trim(p_name), '') is null or length(trim(p_name)) > 160 then
    raise exception 'provider-details-required' using errcode = '22023';
  end if;
  if p_category not in (
    'Atmosferico',
    'Bombas',
    'Car wash/lavadero',
    'Cerrajeria',
    'Contenedores',
    'Electricistas',
    'Jardineria/poda/cesped',
    'Plomeria/piletas',
    'Pozos/pozero',
    'Volquetes'
  ) then
    raise exception 'invalid-category' using errcode = '22023';
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

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_phone, 0));

  select contact.provider_id
    into v_provider_id
    from public.provider_contacts contact
   where contact.normalized_phone = v_phone;

  if v_provider_id is null then
    -- The default community_unverified status is publicly readable immediately.
    insert into public.providers (name, category)
    values (trim(p_name), p_category)
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

grant execute on function public.submit_provider_contribution(text, text, text, text, boolean, text, smallint) to authenticated;
revoke execute on function public.submit_provider_contribution(text, text, text, text, boolean, text, smallint) from public, anon;
