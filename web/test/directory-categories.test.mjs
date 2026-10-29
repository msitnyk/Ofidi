import assert from 'node:assert/strict';
import test from 'node:test';
import {
  categoryOptions,
  filterDirectory,
  isAllowedCategory,
} from '../src/domain/directory.mjs';

const providers = [
  { id: 'plomero', name: 'Piletas Norte', aliases: [], category: 'Plomeria/piletas', status: 'community_unverified' },
  { id: 'electrico', name: 'Electricista del barrio', aliases: [], category: 'Electricistas', status: 'community_unverified' },
  { id: 'disabled', name: 'Plomero inactivo', aliases: [], category: 'Plomeria/piletas', status: 'disabled' },
];

test('exposes the ten approved pilot categories with their stored values', () => {
  assert.deepEqual(categoryOptions.map(({ value }) => value), [
    'Atmosferico',
    'Bombas',
    'Car wash/lavadero',
    'Cerrajeria',
    'Contenedores',
    'Electricistas',
    'Jardineria/poda/cesped',
    'Plomeria/piletas',
    'Pozos/pozero',
    'Volquetes',
  ]);
});

test('filters an active directory by the selected closed category', () => {
  assert.deepEqual(
    filterDirectory(providers, '', 'Plomeria/piletas').map(({ id }) => id),
    ['plomero'],
  );
});

test('accepts only a category from the pilot list for a new community contribution', () => {
  assert.equal(isAllowedCategory('Electricistas'), true);
  assert.equal(isAllowedCategory('Plomería'), false);
  assert.equal(isAllowedCategory(''), false);
});
