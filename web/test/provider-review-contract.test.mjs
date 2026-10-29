import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const application = await readFile(new URL('../src/main.mjs', import.meta.url), 'utf8');
const migration = await readFile(
  new URL('../../supabase/migrations/20261027000200_provider_reviews.sql', import.meta.url),
  'utf8',
);

function providerDialogMarkup() {
  return html.match(/<dialog id="provider-dialog"[\s\S]*?<\/dialog>/)?.[0] ?? '';
}

test('offers an opinion form inside an existing provider profile without asking to add a provider', () => {
  const dialog = providerDialogMarkup();
  assert.match(dialog, /id="review-form"/);
  assert.match(dialog, /name="reason"/);
  assert.match(dialog, /name="rating"/);
  assert.doesNotMatch(dialog, /name="phone"/);
});

test('submits an opinion for the selected provider directly', () => {
  assert.match(application, /rpc\('submit_provider_review'/);
  assert.match(application, /p_provider_id:\s*state\.reviewProvider\.id/);
  assert.match(application, /p_reason:/);
  assert.match(application, /p_rating:/);
});

test('allows a star-only or comment-only community opinion, but not an empty one', () => {
  assert.match(migration, /alter table public\.recommendations[\s\S]*?alter column reason drop not null/i);
  assert.match(migration, /create or replace function public\.submit_provider_review/i);
  assert.match(migration, /review-content-required/i);
  assert.match(migration, /p_rating is not null and p_rating not between 1 and 5/i);
});

test('restricts opinions to authenticated neighborhood members or administrators', () => {
  assert.match(migration, /not public\.has_neighborhood_access\(\) and not public\.is_app_admin\(\)/i);
  assert.match(migration, /grant execute on function public\.submit_provider_review\(uuid, text, smallint, text\) to authenticated/i);
  assert.match(migration, /revoke execute on function public\.submit_provider_review\(uuid, text, smallint, text\) from public, anon/i);
});
