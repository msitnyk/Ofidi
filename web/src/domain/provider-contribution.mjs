import {
  findDuplicateByPhone,
  normalizeArgentinaMobile,
} from './phone.mjs';

export function prepareProviderContribution({ providers, submission }) {
  if (!submission.contributorId) {
    return { ok: false, error: 'authentication-required' };
  }

  if (submission.canSharePhone !== true) {
    return { ok: false, error: 'phone-sharing-not-confirmed' };
  }

  const phone = normalizeArgentinaMobile(submission.phone);
  if (!phone) {
    return { ok: false, error: 'invalid-phone' };
  }

  if (!submission.reason?.trim()) {
    return { ok: false, error: 'recommendation-required' };
  }

  if (!submission.name?.trim() || !submission.category?.trim()) {
    return { ok: false, error: 'provider-details-required' };
  }

  const recommendation = {
    reason: submission.reason.trim(),
    authorId: submission.contributorId,
    displayAuthorName: submission.showContributorName
      ? submission.contributorName?.trim() || null
      : null,
  };
  const duplicate = findDuplicateByPhone(providers, phone);

  if (duplicate) {
    return {
      ok: true,
      action: 'add-recommendation',
      providerId: duplicate.id,
      recommendation,
    };
  }

  return {
    ok: true,
    action: 'create-provider',
    provider: {
      name: submission.name.trim(),
      phone,
      category: submission.category.trim(),
      status: 'community-unverified',
      recommendation,
    },
  };
}
