-- Let neighbors review an existing provider without resubmitting its phone.
-- A review may contain a rating, a comment, or both, but never neither.
alter table public.recommendations
  alter column reason drop not null;

create or replace function public.submit_provider_review(
  p_provider_id uuid,
  p_reason text default null,
  p_rating smallint default null,
  p_display_author_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recommendation_id uuid;
begin
  if auth.uid() is null
     or (not public.has_neighborhood_access() and not public.is_app_admin()) then
    raise exception 'neighborhood-access-required' using errcode = '42501';
  end if;

  if nullif(trim(p_reason), '') is null and p_rating is null then
    raise exception 'review-content-required' using errcode = '22023';
  end if;
  if p_reason is not null and length(trim(p_reason)) > 1000 then
    raise exception 'review-comment-too-long' using errcode = '22023';
  end if;
  if p_rating is not null and p_rating not between 1 and 5 then
    raise exception 'invalid-rating' using errcode = '22023';
  end if;
  if p_display_author_name is not null
     and length(trim(p_display_author_name)) not between 1 and 100 then
    raise exception 'invalid-display-author-name' using errcode = '22023';
  end if;
  if not exists (
    select 1
      from public.providers provider
     where provider.id = p_provider_id
       and provider.status <> 'disabled'
  ) then
    raise exception 'provider-not-found' using errcode = 'P0002';
  end if;

  insert into public.recommendations (
    provider_id, reason, rating, display_author_name
  ) values (
    p_provider_id,
    nullif(trim(p_reason), ''),
    p_rating,
    nullif(trim(p_display_author_name), '')
  ) returning id into v_recommendation_id;

  insert into public.recommendation_attributions (recommendation_id, author_id)
  values (v_recommendation_id, auth.uid());

  return v_recommendation_id;
end;
$$;

revoke execute on function public.submit_provider_review(uuid, text, smallint, text) from public, anon;
grant execute on function public.submit_provider_review(uuid, text, smallint, text) to authenticated;
