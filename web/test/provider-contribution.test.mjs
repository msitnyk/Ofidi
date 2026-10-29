import assert from 'node:assert/strict';
import test from 'node:test';
import * as contributionRules from '../src/domain/provider-contribution.mjs';

const baseSubmission = {
  name: 'Plomero del barrio',
  phone: '+54 9 221 607-1937',
  category: 'Plomería',
  reason: 'Me resolvió una pérdida de agua.',
  canSharePhone: true,
  contributorId: 'google-user-123',
  contributorName: 'Ana',
  showContributorName: false,
};

test('requires explicit permission to share the professional phone', () => {
  const result = contributionRules.prepareProviderContribution({
    providers: [],
    submission: { ...baseSubmission, canSharePhone: false },
  });

  assert.deepEqual(result, { ok: false, error: 'phone-sharing-not-confirmed' });
});

test('requires an authenticated contributor', () => {
  const result = contributionRules.prepareProviderContribution({
    providers: [],
    submission: { ...baseSubmission, contributorId: null },
  });

  assert.deepEqual(result, { ok: false, error: 'authentication-required' });
});

test('creates a new community-unverified provider with private attribution', () => {
  const result = contributionRules.prepareProviderContribution({
    providers: [],
    submission: baseSubmission,
  });

  assert.deepEqual(result, {
    ok: true,
    action: 'create-provider',
    provider: {
      name: 'Plomero del barrio',
      phone: '5492216071937',
      category: 'Plomería',
      status: 'community-unverified',
      recommendation: {
        reason: 'Me resolvió una pérdida de agua.',
        authorId: 'google-user-123',
        displayAuthorName: null,
      },
    },
  });
});

test('attaches a recommendation to a matching phone without merging by name', () => {
  const providers = [
    { id: 'existing-provider', name: 'Otro nombre', phone: '5492216071937' },
  ];
  const result = contributionRules.prepareProviderContribution({
    providers,
    submission: { ...baseSubmission, showContributorName: true },
  });

  assert.deepEqual(result, {
    ok: true,
    action: 'add-recommendation',
    providerId: 'existing-provider',
    recommendation: {
      reason: 'Me resolvió una pérdida de agua.',
      authorId: 'google-user-123',
      displayAuthorName: 'Ana',
    },
  });
});

test('rejects incomplete phone or recommendation details', () => {
  const invalidPhone = contributionRules.prepareProviderContribution({
    providers: [],
    submission: { ...baseSubmission, phone: '221 607' },
  });
  const missingReason = contributionRules.prepareProviderContribution({
    providers: [],
    submission: { ...baseSubmission, reason: '   ' },
  });

  assert.deepEqual(invalidPhone, { ok: false, error: 'invalid-phone' });
  assert.deepEqual(missingReason, { ok: false, error: 'recommendation-required' });
});
