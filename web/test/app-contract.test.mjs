import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const application = await readFile(new URL('../src/main.mjs', import.meta.url), 'utf8');

test('keeps directory search open and gates phone access through neighborhood membership', () => {
  assert.match(html, /id="search-input"/);
  assert.match(html, /id="access-panel"/);
  assert.match(application, /from\('provider_contacts'\)/);
  assert.match(application, /state\.hasAccess/);
});

test('logs anonymous searches and contact-link clicks without claiming completed work', () => {
  assert.match(application, /rpc\('record_directory_search'/);
  assert.match(application, /rpc\('record_contact_click'/);
  assert.match(html, /no confirma una conversación ni un trabajo realizado/i);
  assert.match(html, /id="admin-metrics"/);
});

test('marks imported historic sources separately from community recommendations', () => {
  assert.match(application, /source_label/);
  assert.match(html, /aporte de la comunidad/i);
});

test('keeps every DOM id used by the application declared in the page', () => {
  const declaredIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const referencedIds = [...application.matchAll(/byId\('([^']+)'\)/g)].map((match) => match[1]);
  const missingIds = [...new Set(referencedIds)].filter((id) => !declaredIds.has(id));

  assert.deepEqual(missingIds, []);
});
