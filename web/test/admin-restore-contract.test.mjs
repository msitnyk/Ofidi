import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const application = await readFile(new URL('../src/main.mjs', import.meta.url), 'utf8');
const migration = await readFile(
  new URL('../../supabase/migrations/20261027000300_categories_and_restore.sql', import.meta.url),
  'utf8',
);

test('offers horizontally scrollable category chips and a closed category selector', () => {
  assert.match(html, /id="category-chips"/);
  assert.match(html, /id="provider-category"[^>]*required/);
  assert.doesNotMatch(html, /<input name="category"/);
});

test('shows disabled providers in an admin trash area and restores them', () => {
  assert.match(html, /id="admin-disabled-providers"/);
  assert.match(application, /status: 'community_unverified'/);
  assert.match(application, /Restaurar ficha/);
});

test('enforces one of the approved categories for direct neighborhood submissions', () => {
  assert.match(migration, /create or replace function public\.submit_provider_contribution/i);
  assert.match(migration, /p_category not in \(/i);
  assert.match(migration, /invalid-category/i);
});
