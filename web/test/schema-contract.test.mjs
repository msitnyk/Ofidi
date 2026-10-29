import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL('../../supabase/migrations/20261027000100_init.sql', import.meta.url),
  'utf8',
);

test('supports public search aliases on canonical provider profiles', () => {
  assert.match(migration, /create table\s+public\.providers\s*\([\s\S]*?aliases\s+text\[\]\s+not null/i);
});

test('keeps phone numbers unique in a private contact table', () => {
  assert.match(migration, /create table\s+public\.provider_contacts/i);
  assert.match(migration, /normalized_phone\s+text\s+not null\s+unique/i);
  assert.match(migration, /alter table\s+public\.provider_contacts\s+enable row level security/i);
});

test('gates phone reads by neighborhood membership', () => {
  assert.match(migration, /create policy[^;]*provider_contacts[^;]*has_neighborhood_access/is);
});

test('hides phone data for disabled profiles and permits admin corrections', () => {
  assert.match(migration, /provider_contacts_member_read[\s\S]*?status\s*<>\s*'disabled'/i);
  assert.match(migration, /provider_contacts_admin_all[\s\S]*?is_app_admin\(\)/i);
  assert.match(migration, /grant select, insert, update, delete on public\.provider_contacts to authenticated/i);
});

test('accepts contributions through a server-side authorized operation', () => {
  assert.match(migration, /create or replace function\s+public\.submit_provider_contribution/i);
  assert.match(migration, /phone-sharing-not-confirmed/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
});

test('supports idempotent initial imports only through the service-role RPC', () => {
  assert.match(migration, /initial_import_key\s+text\s+unique/i);
  assert.match(migration, /create or replace function\s+public\.admin_import_candidate/i);
  assert.match(migration, /auth\.role\(\)[^;]{0,40}<>\s*'service_role'/i);
  assert.match(migration, /grant execute on function public\.admin_import_candidate\([^;]+\) to service_role/i);
  assert.match(migration, /revoke execute on function public\.admin_import_candidate\([^;]+\) from public, anon, authenticated/i);
});

test('stores ratings only in the community-reported range', () => {
  assert.match(migration, /rating\s+smallint\s+check\s*\(rating\s+between\s+1\s+and\s+5\)/i);
  assert.match(migration, /create table\s+public\.recommendations/i);
  assert.match(migration, /source_label\s+text/i);
});

test('allows only the author or administrator to read private attribution records', () => {
  assert.match(migration, /create policy recommendation_attributions_author_or_admin_read[\s\S]*?author_id\s*=\s*auth\.uid\(\)[\s\S]*?is_app_admin\(\)/i);
  assert.match(migration, /grant select on public\.recommendation_attributions to authenticated/i);
});

test('keeps reports as review tickets and contact analytics free of user identity', () => {
  assert.match(migration, /create table\s+public\.reports/i);
  assert.match(migration, /status\s+text\s+not null\s+default\s+'open'/i);
  assert.match(migration, /create table\s+public\.contact_clicks/i);
  assert.doesNotMatch(migration, /create table\s+public\.contact_clicks\s*\([^;]*user_id/is);
});

test('counts anonymous directory searches without storing raw query or user identity', () => {
  assert.match(migration, /create table\s+public\.search_events\s*\([\s\S]*?results_count\s+integer/i);
  assert.doesNotMatch(migration, /create table\s+public\.search_events\s*\([^;]*(query|user_id)/is);
  assert.match(migration, /create or replace function\s+public\.record_directory_search/i);
  assert.match(migration, /grant execute on function public\.record_directory_search\(integer\) to anon, authenticated/i);
});

test('redeems hashed invitation codes into neighborhood membership', () => {
  assert.match(migration, /create table\s+public\.invite_codes/i);
  assert.match(migration, /create or replace function\s+public\.redeem_invite_code/i);
  assert.match(migration, /crypt\(/i);
  assert.match(migration, /create table\s+public\.neighborhood_memberships/i);
});

test('grants provider table writes only behind the administrator RLS policy', () => {
  assert.match(migration, /grant insert, update, delete on public\.providers to authenticated/i);
  assert.match(migration, /create policy providers_admin_all[\s\S]*?using\s*\(public\.is_app_admin\(\)\)[\s\S]*?with check\s*\(public\.is_app_admin\(\)\)/i);
});
