import assert from 'node:assert/strict';
import test from 'node:test';
import * as importCandidates from '../../scripts/import-candidates.mjs';

const { parseCandidatesCsv, prepareImportCandidates } = importCandidates;

const csvHeader = '"Name","Phone","Categories","CurrentStatus"';

test('parses quoted CSV and separates the canonical name from aliases', () => {
  const csv = `${csvHeader}\n"Teófilo Modesto (alias: Teófilo; Modesto; Modesto Viejo)","+54 9 221 000-0000","Piletas; Jardinería","Not revalidated"`;
  const [candidate] = parseCandidatesCsv(csv);

  assert.deepEqual(candidate, {
    name: 'Teófilo Modesto',
    phone: '+54 9 221 000-0000',
    categories: ['Piletas', 'Jardinería'],
    aliases: ['Teófilo', 'Modesto', 'Modesto Viejo'],
    currentStatus: 'Not revalidated',
  });
});

test('normalizes the import phone and labels the historical source without claiming a verified job', () => {
  const csv = `${csvHeader}\n"Profesional de prueba","+54 9 221 000-0000","Plomería","Not revalidated"`;
  const [candidate] = prepareImportCandidates(csv, { expectedCount: 1 });

  assert.equal(candidate?.phone, '5492210000000');
  assert.equal(candidate?.category, 'Plomería');
  assert.match(candidate?.reason ?? '', /histórico/i);
  assert.match(candidate?.reason ?? '', /no revalidada/i);
  assert.equal(candidate?.importKey, 'initial-candidates:5492210000000');
});

test('refuses a candidate set with repeated normalized phones before import', () => {
  const csv = `${csvHeader}\n"Uno","+54 9 221 000-0000","Plomería","Not revalidated"\n"Dos","5492210000000","Electricidad","Not revalidated"`;

  assert.throws(
    () => prepareImportCandidates(csv, { expectedCount: 2 }),
    /duplicate phone/i,
  );
});

test('uses a new Supabase secret key only as the API key header', () => {
  assert.equal(typeof importCandidates.buildImportHeaders, 'function');
  const headers = importCandidates.buildImportHeaders('sb_secret_test');

  assert.equal(headers.apikey, 'sb_secret_test');
  assert.equal('authorization' in headers, false);
});

test('sends a legacy service-role JWT as both API key and bearer token', () => {
  assert.equal(typeof importCandidates.buildImportHeaders, 'function');
  const legacyKey = 'eyJlegacy-service-role';
  const headers = importCandidates.buildImportHeaders(legacyKey);

  assert.equal(headers.apikey, legacyKey);
  assert.equal(headers.authorization, `Bearer ${legacyKey}`);
});

test('requires the expected number of source rows before import', () => {
  const csv = `${csvHeader}\n"Uno","+54 9 221 000-0000","Plomería","Not revalidated"`;

  assert.throws(() => prepareImportCandidates(csv), /expected 41/i);
});
