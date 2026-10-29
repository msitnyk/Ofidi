export const categoryOptions = [
  { value: 'Atmosferico', label: 'Atmosférico' },
  { value: 'Bombas', label: 'Bombas' },
  { value: 'Car wash/lavadero', label: 'Lavadero' },
  { value: 'Cerrajeria', label: 'Cerrajería' },
  { value: 'Contenedores', label: 'Contenedores' },
  { value: 'Electricistas', label: 'Electricidad' },
  { value: 'Jardineria/poda/cesped', label: 'Jardinería y poda' },
  { value: 'Plomeria/piletas', label: 'Plomería y piletas' },
  { value: 'Pozos/pozero', label: 'Pozos' },
  { value: 'Volquetes', label: 'Volquetes' },
];

export function isAllowedCategory(category) {
  return categoryOptions.some((option) => option.value === category);
}

export function summarizeRatings(recommendations, providerId) {
  const ratings = recommendations
    .filter((recommendation) => recommendation.provider_id === providerId)
    .map((recommendation) => recommendation.rating)
    .filter((rating) => Number.isInteger(rating));

  if (!ratings.length) return null;
  const average = ratings.reduce((total, rating) => total + rating, 0) / ratings.length;
  return { average: average.toFixed(1), count: ratings.length };
}

function normalizeSearchText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR')
    .trim();
}

export function filterDirectory(providers, query, selectedCategory = '') {
  const term = normalizeSearchText(query ?? '');

  return providers.filter((provider) => {
    if (provider.status === 'disabled') return false;
    if (selectedCategory && provider.category !== selectedCategory) return false;
    if (!term) return true;

    const searchableText = [
      provider.name,
      provider.category,
      ...(provider.aliases ?? []),
    ].map(normalizeSearchText);

    return searchableText.some((value) => value.includes(term));
  });
}
