import assert from 'node:assert/strict';
import test from 'node:test';
import * as phoneRules from '../src/domain/phone.mjs';

test('normalizes Argentina mobile formatting to a canonical WhatsApp number', () => {
  assert.equal(phoneRules.normalizeArgentinaMobile('+54 9 221 607-1937'), '5492216071937');
});

test('recognizes equivalent formatting as the same canonical number', () => {
  assert.equal(
    phoneRules.normalizeArgentinaMobile('+54 9 221 607-1937'),
    phoneRules.normalizeArgentinaMobile('5492216071937'),
  );
});

test('rejects numbers that are not complete Argentina mobile numbers', () => {
  assert.equal(phoneRules.normalizeArgentinaMobile('221 607-1937'), null);
  assert.equal(phoneRules.normalizeArgentinaMobile('+54 9 221 607'), null);
});

test('finds a duplicate only by canonical phone, not by similar name', () => {
  const existing = [
    { id: 'provider-1', name: 'Gisbert Bombas Bobinados', phone: '5492214803809' },
  ];

  assert.equal(
    phoneRules.findDuplicateByPhone(existing, '+54 9 221 480-3809')?.id,
    'provider-1',
  );
  assert.equal(
    phoneRules.findDuplicateByPhone(existing, '+54 9 221 480-3810'),
    null,
  );
});
