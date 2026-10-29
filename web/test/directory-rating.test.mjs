import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeRatings } from '../src/domain/directory.mjs';

test('summarizes only numeric neighbor ratings for a provider card', () => {
  assert.deepEqual(summarizeRatings([
    { provider_id: 'a', rating: 5 },
    { provider_id: 'a', rating: 4 },
    { provider_id: 'a', rating: null },
    { provider_id: 'b', rating: 1 },
  ], 'a'), { average: '4.5', count: 2 });
});

test('marks a provider with no ratings as new rather than low-rated', () => {
  assert.equal(summarizeRatings([{ provider_id: 'a', rating: null }], 'a'), null);
});
