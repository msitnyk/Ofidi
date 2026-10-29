import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const application = await readFile(new URL('../src/main.mjs', import.meta.url), 'utf8');
const migration = await readFile(
  new URL('../../supabase/migrations/20261027000400_suggested_categories_and_admin_inbox.sql', import.meta.url),
  'utf8',
);

test('provides an Other category option with a short suggested-category field', () => {
  assert.match(html, /value="__other__"/);
  assert.match(html, /id="suggested-category"/);
  assert.match(application, /submit_provider_contribution_v2/);
});

test('keeps suggested-category professionals public immediately while tracking approval separately', () => {
  assert.match(migration, /create table public\.provider_category_suggestions/i);
  assert.match(migration, /create or replace function public\.submit_provider_contribution_v2/i);
  assert.match(migration, /'Sugerido'/);
  assert.match(migration, /create or replace function public\.approve_category_suggestion/i);
});

test('shows a separate suggestion inbox to administrators', () => {
  assert.match(html, /id="admin-category-suggestions"/);
  assert.match(application, /approve_category_suggestion/);
  assert.match(application, /Rubro sugerido:/);
});

test('separates active report inbox from report history', () => {
  assert.match(html, /id="admin-report-pending"/);
  assert.match(html, /id="admin-report-history"/);
  assert.match(application, /report\.status === 'open' \|\| report\.status === 'under_review'/);
  assert.match(application, /report\.status === 'resolved' \|\| report\.status === 'dismissed'/);
});
