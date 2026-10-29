import assert from 'node:assert/strict';
import test from 'node:test';
import { filterDirectory } from '../src/domain/directory.mjs';

const providers = [
  {
    id: 'teofilo',
    name: 'Teófilo Modesto',
    aliases: ['Modesto', 'Modesto Viejo'],
    category: 'Piletas',
    status: 'community_unverified',
  },
  {
    id: 'disabled',
    name: 'Profesional desactivado',
    aliases: [],
    category: 'Piletas',
    status: 'disabled',
  },
  {
    id: 'leo',
    name: 'Leo Gisbert',
    aliases: [],
    category: 'Bombas',
    status: 'community_unverified',
  },
];

test('searches provider names and aliases without accents or case sensitivity', () => {
  assert.deepEqual(filterDirectory(providers, 'MODESTO VIEJO').map(({ id }) => id), ['teofilo']);
  assert.deepEqual(filterDirectory(providers, 'teofilo').map(({ id }) => id), ['teofilo']);
});

test('filters by category and never lists disabled providers', () => {
  assert.deepEqual(filterDirectory(providers, 'pileta').map(({ id }) => id), ['teofilo']);
  assert.deepEqual(filterDirectory(providers, '').map(({ id }) => id), ['teofilo', 'leo']);
});
