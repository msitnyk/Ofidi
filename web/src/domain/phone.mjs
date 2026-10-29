export function normalizeArgentinaMobile(value) {
  if (typeof value !== 'string') return null;

  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);

  return /^549\d{10}$/.test(digits) ? digits : null;
}

export function findDuplicateByPhone(providers, phone) {
  const normalizedPhone = normalizeArgentinaMobile(phone);
  if (!normalizedPhone) return null;

  return providers.find((provider) => (
    normalizeArgentinaMobile(provider.phone) === normalizedPhone
  )) ?? null;
}
