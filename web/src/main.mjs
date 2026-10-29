import {
  categoryOptions,
  filterDirectory,
  summarizeRatings,
} from './domain/directory.mjs';

const byId = (id) => document.getElementById(id);
const state = {
  supabase: null,
  providers: [],
  recommendations: [],
  session: null,
  hasAccess: false,
  isAdmin: false,
  reviewProvider: null,
  searchTimer: null,
  lastLoggedSearch: null,
  toastTimer: null,
  reportSubmitting: false,
  selectedCategory: '',
  categoryOptions: categoryOptions,
  categorySuggestions: [],
};

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.dataset.error = String(isError);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const toggle = byId('theme-toggle');
  const isDark = theme === 'dark';
  toggle.setAttribute('aria-pressed', String(isDark));
  toggle.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  toggle.title = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  toggle.innerHTML = isDark ? '☀ <span>Modo claro</span>' : '◐ <span>Modo oscuro</span>';
}

function initializeTheme() {
  const savedTheme = localStorage.getItem('ofidi-theme');
  const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : preferredTheme);
}

function showToast(message, type = 'success') {
  const toast = byId('toast');
  if (state.toastTimer) window.clearTimeout(state.toastTimer);

  toast.textContent = message;
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  toast.hidden = false;

  state.toastTimer = window.setTimeout(() => {
    toast.hidden = true;
    toast.textContent = '';
    state.toastTimer = null;
  }, 6000);
}

function showAccessPanel(reason) {
  const panel = byId('access-panel');
  if (reason) byId('access-description').textContent = reason;
  panel.hidden = false;
  panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (!state.session) byId('google-login').focus();
}

function requireNeighborhoodAccess() {
  if (state.hasAccess || state.isAdmin) return true;
  showAccessPanel(
    state.session
      ? 'Tu cuenta ingresó con Google. Validá el código de invitación de Los Sauces para ver teléfonos y participar.'
      : 'Ingresá con Google y usá el código de invitación de Los Sauces. La búsqueda y las fichas básicas son abiertas.',
  );
  return false;
}

function renderCategoryChips() {
  const container = byId('category-chips');
  container.replaceChildren();

  const options = [{ value: '', label: 'Todos' }, ...state.categoryOptions];
  for (const option of options) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'category-chip';
    chip.textContent = option.label;
    chip.setAttribute('aria-pressed', String(option.value === state.selectedCategory));
    chip.addEventListener('click', () => {
      state.selectedCategory = option.value;
      renderCategoryChips();
      displayProviders();
    });
    container.append(chip);
  }
}

function populateContributionCategories() {
  const select = byId('provider-category');
  select.replaceChildren();
  const prompt = document.createElement('option');
  prompt.value = '';
  prompt.textContent = 'Elegí un rubro';
  select.append(prompt);

  for (const category of state.categoryOptions) {
    const option = document.createElement('option');
    option.value = category.value;
    option.textContent = category.label;
    select.append(option);
  }
  const other = document.createElement('option');
  other.value = '__other__';
  other.textContent = '+ Otro rubro...';
  select.append(other);
}

function categoryLabel(provider) {
  if (provider.category === 'Sugerido') {
    const suggestion = state.categorySuggestions.find((item) => item.provider_id === provider.id && item.status === 'pending');
    return suggestion ? `Rubro sugerido: ${suggestion.suggested_category}` : 'Rubro sugerido';
  }
  return state.categoryOptions.find((category) => category.value === provider.category)?.label ?? provider.category;
}

function displayProviders() {
  const list = byId('provider-list');
  const query = byId('search-input').value;
  const visible = filterDirectory(state.providers, query, state.selectedCategory);
  list.replaceChildren();
  byId('result-count').textContent = `${visible.length} ${visible.length === 1 ? 'ficha' : 'fichas'}`;

  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = query
      ? 'No encontramos coincidencias. Probá con otro nombre o rubro, o agregá una referencia.'
      : 'Todavía no hay profesionales cargados. Podés agregar una referencia con acceso al barrio.';
    list.append(empty);
    return;
  }

  for (const provider of visible) {
    const card = document.createElement('button');
    card.className = 'provider-card';
    card.type = 'button';
    card.addEventListener('click', () => openProvider(provider));

    const details = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = provider.name;
    const meta = document.createElement('span');
    meta.className = 'card-meta';
    meta.textContent = `${categoryLabel(provider)} · Aporte de la comunidad`;
    const rating = document.createElement('span');
    const summary = summarizeRatings(state.recommendations, provider.id);
    rating.className = `card-rating${summary ? '' : ' card-rating-new'}`;
    rating.textContent = summary
      ? `★ ${summary.average} (${summary.count} ${summary.count === 1 ? 'opinión' : 'opiniones'})`
      : '★ Sin opiniones aún';
    details.append(name, meta, rating);

    const arrow = document.createElement('span');
    arrow.className = 'card-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '›';
    card.append(details, arrow);
    list.append(card);
  }
}

function displayReportProviders() {
  const select = byId('report-provider');
  const previousValue = select.value;
  select.replaceChildren();
  const prompt = document.createElement('option');
  prompt.value = '';
  prompt.textContent = 'Elegí un profesional';
  select.append(prompt);

  for (const provider of state.providers.filter((item) => item.status !== 'disabled')) {
    const option = document.createElement('option');
    option.value = provider.id;
    option.textContent = `${provider.name} · ${categoryLabel(provider)}`;
    select.append(option);
  }
  if (state.providers.some((provider) => provider.id === previousValue)) {
    select.value = previousValue;
  }
}

function recommendationsFor(providerId) {
  return state.recommendations.filter((recommendation) => recommendation.provider_id === providerId);
}

function displayRecommendations(providerId) {
  const container = byId('dialog-recommendations');
  const recommendations = recommendationsFor(providerId);
  const rated = recommendations.filter((item) => item.rating !== null);
  const average = rated.length
    ? (rated.reduce((total, item) => total + item.rating, 0) / rated.length).toFixed(1)
    : null;
  byId('dialog-rating').textContent = average
    ? `Opiniones vecinales: ${average} / 5 · ${rated.length} ${rated.length === 1 ? 'puntaje' : 'puntajes'} (no verificados)`
    : 'Todavía no hay puntajes vecinales.';

  container.replaceChildren();
  if (!recommendations.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Todavía no hay referencias escritas para esta ficha.';
    container.append(empty);
    return;
  }

  for (const item of recommendations) {
    const article = document.createElement('article');
    article.className = 'recommendation';
    if (item.rating) {
      const stars = document.createElement('strong');
      stars.textContent = `${'★'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)} `;
      article.append(stars);
    }
    if (item.reason) {
      const reason = document.createElement('p');
      reason.textContent = item.reason;
      article.append(reason);
    } else if (item.rating) {
      const noComment = document.createElement('p');
      noComment.className = 'muted';
      noComment.textContent = 'Opinión con puntaje, sin comentario.';
      article.append(noComment);
    }
    const attribution = document.createElement('small');
    attribution.textContent = item.source_label || (item.display_author_name
      ? `Aporte de ${item.display_author_name} · opinión comunitaria no verificada`
      : 'Aporte vecinal · identidad privada');
    article.append(attribution);
    container.append(article);
  }
}

function displayReviewAccess() {
  const canReview = state.hasAccess || state.isAdmin;
  byId('review-form').hidden = !canReview;
  byId('review-access').hidden = canReview;

  if (!canReview) {
    byId('review-access-message').textContent = state.session
      ? 'Ingresaste con Google. Validá el código de Los Sauces para dejar una opinión.'
      : 'Ingresá con Google y validá el código de Los Sauces para dejar una opinión.';
    byId('review-access-button').textContent = state.session
      ? 'Validar código de invitación'
      : 'Ingresar con Google';
  }
}

async function displayContact(provider) {
  const area = byId('dialog-contact');
  area.replaceChildren();
  const heading = document.createElement('h3');
  heading.textContent = 'Contacto';
  area.append(heading);

  if (!state.hasAccess && !state.isAdmin) {
    const help = document.createElement('p');
    help.className = 'muted';
    help.textContent = 'El teléfono se muestra a vecinos que ingresaron con Google y validaron el código del barrio.';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button button-primary';
    button.textContent = state.session ? 'Validar código de invitación' : 'Ingresar con Google';
    button.addEventListener('click', () => {
      byId('provider-dialog').close();
      showAccessPanel(
        state.session
          ? 'Tu cuenta ingresó con Google. Validá el código de invitación de Los Sauces para ver teléfonos y participar.'
          : 'Ingresá con Google y usá el código de invitación de Los Sauces. La búsqueda y las fichas básicas son abiertas.',
      );
    });
    area.append(help, button);
    return;
  }

  const loading = document.createElement('p');
  loading.className = 'muted';
  loading.textContent = 'Cargando contacto…';
  area.append(loading);

  const { data, error } = await state.supabase
    .from('provider_contacts')
    .select('normalized_phone')
    .eq('provider_id', provider.id)
    .maybeSingle();
  area.replaceChildren(heading);

  if (error || !data?.normalized_phone) {
    const unavailable = document.createElement('p');
    unavailable.className = 'muted';
    unavailable.textContent = 'El teléfono no está disponible para esta ficha.';
    area.append(unavailable);
    return;
  }

  const phone = data.normalized_phone;
  const phoneText = document.createElement('p');
  phoneText.textContent = `WhatsApp: +${phone}`;
  const contact = document.createElement('button');
  contact.className = 'button button-primary';
  contact.type = 'button';
  contact.textContent = 'Contactar por WhatsApp';
  contact.addEventListener('click', async () => {
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    const { error: clickError } = await state.supabase.rpc('record_contact_click', {
      p_provider_id: provider.id,
    });
    const url = `https://wa.me/${phone}`;
    if (tab) tab.location = url;
    else window.location.assign(url);
    if (clickError) console.warn('No se pudo registrar el clic de contacto.');
  });
  const note = document.createElement('p');
  note.className = 'muted';
  note.textContent = 'El clic abre WhatsApp; no confirma que se haya enviado un mensaje ni que el trabajo se haya concretado.';
  area.append(phoneText, contact, note);
}

async function openProvider(provider) {
  state.reviewProvider = provider;
  byId('dialog-title').textContent = provider.name;
  byId('dialog-category').textContent = categoryLabel(provider);
  displayRecommendations(provider.id);
  displayReviewAccess();
  byId('provider-dialog').showModal();
  await displayContact(provider);
}

async function loadDirectory() {
  const { data: providers, error: providerError } = await state.supabase
    .from('providers')
    .select('id,name,category,aliases,status,created_at')
    .order('name');
  if (providerError) throw providerError;

  const ids = (providers ?? []).map((provider) => provider.id);
  let recommendations = [];
  if (ids.length) {
    const { data, error } = await state.supabase
      .from('recommendations')
      .select('id,provider_id,reason,rating,source_label,display_author_name,created_at')
      .in('provider_id', ids)
      .order('created_at', { ascending: false });
    if (error) throw error;
    recommendations = data ?? [];
  }

  const [{ data: approvedCategories, error: categoryError }, { data: suggestions, error: suggestionError }] = await Promise.all([
    state.supabase.from('approved_categories').select('category,label').order('label'),
    state.supabase.from('provider_category_suggestions').select('provider_id,suggested_category,status').eq('status', 'pending'),
  ]);
  state.categoryOptions = categoryError || !approvedCategories?.length
    ? categoryOptions
    : approvedCategories.map(({ category, label }) => ({ value: category, label }));
  state.categorySuggestions = suggestionError ? [] : (suggestions ?? []);
  state.providers = providers ?? [];
  state.recommendations = recommendations;
  renderCategoryChips();
  populateContributionCategories();
  displayProviders();
  displayReportProviders();
  if (state.isAdmin) await loadAdminReports();
}

async function loadAuthorization() {
  state.hasAccess = false;
  state.isAdmin = false;
  if (state.session) {
    const [{ data: membership }, { data: administrator }] = await Promise.all([
      state.supabase.rpc('has_neighborhood_access'),
      state.supabase.rpc('is_app_admin'),
    ]);
    state.hasAccess = membership === true;
    state.isAdmin = administrator === true;
  }

  byId('google-login').hidden = Boolean(state.session);
  byId('session-controls').hidden = !state.session;
  byId('invite-form').hidden = !state.session || state.hasAccess || state.isAdmin;
  byId('access-panel').hidden = state.hasAccess || state.isAdmin;
  byId('admin-panel').hidden = !state.isAdmin;
  if (state.session) {
    const user = state.session.user;
    byId('session-label').textContent = user.user_metadata?.full_name || 'Sesión iniciada';
  }
}

async function syncSession() {
  const { data, error } = await state.supabase.auth.getSession();
  if (error) throw error;
  state.session = data.session;
  await loadAuthorization();
}

async function loadDisabledProviders() {
  const container = byId('admin-disabled-providers');
  container.replaceChildren();
  const { data: providers, error } = await state.supabase
    .from('providers')
    .select('id,name,category,status')
    .eq('status', 'disabled')
    .order('name');

  if (error) {
    const message = document.createElement('p');
    message.className = 'muted';
    message.textContent = 'No se pudieron cargar las fichas dadas de baja.';
    container.append(message);
    return;
  }
  if (!providers?.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No hay fichas dadas de baja.';
    container.append(empty);
    return;
  }

  for (const provider of providers) {
    const article = document.createElement('article');
    article.className = 'recommendation';
    const title = document.createElement('strong');
    title.textContent = `${provider.name} · ${categoryOptions.find((category) => category.value === provider.category)?.label ?? provider.category}`;
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent = 'Oculto para el barrio; el registro se conserva en la papelera.';
    const restore = document.createElement('button');
    restore.type = 'button';
    restore.className = 'button button-secondary';
    restore.textContent = 'Restaurar ficha';
    restore.addEventListener('click', async () => {
      const originalLabel = restore.textContent;
      restore.disabled = true;
      restore.textContent = 'Restaurando...';
      const { data: restoredProvider, error: restoreError } = await state.supabase
        .from('providers')
        .update({ status: 'community_unverified', updated_at: new Date().toISOString() })
        .eq('id', provider.id)
        .select('id,status')
        .maybeSingle();
      if (restoreError || !restoredProvider) {
        showToast('No se pudo restaurar la ficha. Verificá tus permisos de administración.', 'error');
        restore.disabled = false;
        restore.textContent = originalLabel;
        return;
      }
      showToast('Ficha restaurada y visible nuevamente para el barrio.', 'success');
      await loadDirectory();
    });
    article.append(title, note, restore);
    container.append(article);
  }
}

async function loadCategorySuggestions() {
  const container = byId('admin-category-suggestions');
  container.replaceChildren();
  const { data: suggestions, error } = await state.supabase
    .from('provider_category_suggestions')
    .select('id,provider_id,suggested_category,created_at,status')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) {
    const message = document.createElement('p');
    message.className = 'muted';
    message.textContent = 'No se pudieron cargar los rubros sugeridos.';
    container.append(message);
    return;
  }
  if (!suggestions?.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No hay rubros sugeridos pendientes.';
    container.append(empty);
    return;
  }
  const providersById = new Map(state.providers.map((provider) => [provider.id, provider]));
  for (const suggestion of suggestions) {
    const item = document.createElement('article');
    item.className = 'recommendation';
    const provider = providersById.get(suggestion.provider_id);
    const title = document.createElement('strong');
    title.textContent = `${suggestion.suggested_category} · sugerido para ${provider?.name ?? 'una ficha'}`;
    const controls = document.createElement('div');
    controls.className = 'inline-form';
    const approve = document.createElement('button');
    approve.type = 'button';
    approve.className = 'button button-secondary';
    approve.textContent = 'Aprobar rubro';
    approve.addEventListener('click', async () => {
      approve.disabled = true;
      const { error: approvalError } = await state.supabase.rpc('approve_category_suggestion', {
        p_suggestion_id: suggestion.id,
      });
      if (approvalError) {
        approve.disabled = false;
        showToast('No se pudo aprobar el rubro sugerido.', 'error');
        return;
      }
      showToast('Rubro aprobado e incorporado a las categorías oficiales.', 'success');
      await loadDirectory();
    });
    const reject = document.createElement('button');
    reject.type = 'button';
    reject.className = 'button button-light';
    reject.textContent = 'Descartar';
    reject.addEventListener('click', async () => {
      reject.disabled = true;
      const { error: rejectionError } = await state.supabase
        .from('provider_category_suggestions')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', suggestion.id);
      if (rejectionError) {
        reject.disabled = false;
        showToast('No se pudo descartar el rubro sugerido.', 'error');
        return;
      }
      showToast('Rubro sugerido descartado. La ficha publicada se conserva.', 'success');
      await loadDirectory();
    });
    controls.append(approve, reject);
    item.append(title, controls);
    container.append(item);
  }
}

async function loadAdminReports() {
  const container = byId('admin-report-pending');
  const historyContainer = byId('admin-report-history');
  container.replaceChildren();
  historyContainer.replaceChildren();
  const [
    { data: reports, error },
    { count: searchCount, error: searchError },
    { count: clickCount, error: clickError },
  ] = await Promise.all([
    state.supabase
      .from('reports')
      .select('id,provider_id,reason,details,status,created_at')
      .order('created_at', { ascending: false }),
    state.supabase.from('search_events').select('id', { count: 'exact', head: true }),
    state.supabase.from('contact_clicks').select('id', { count: 'exact', head: true }),
  ]);
  byId('admin-metrics').textContent = searchError || clickError
    ? 'No se pudieron cargar las métricas.'
    : `Búsquedas registradas: ${searchCount ?? 0} · clics en Contactar: ${clickCount ?? 0}. No indican conversaciones ni trabajos realizados.`;
  await Promise.all([loadDisabledProviders(), loadCategorySuggestions()]);
  if (error) {
    container.textContent = 'No se pudieron cargar los reportes.';
    return;
  }

  const providersById = new Map(state.providers.map((provider) => [provider.id, provider]));
  const pendingReports = (reports ?? []).filter((report) => report.status === 'open' || report.status === 'under_review');
  const historicalReports = (reports ?? []).filter((report) => report.status === 'resolved' || report.status === 'dismissed');

  if (!pendingReports.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No hay reportes pendientes.';
    container.append(empty);
  }
  if (!historicalReports.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Todavía no hay reportes resueltos o descartados.';
    historyContainer.append(empty);
  } else {
    for (const report of historicalReports) {
      const item = document.createElement('article');
      item.className = 'recommendation';
      const provider = providersById.get(report.provider_id);
      const title = document.createElement('strong');
      title.textContent = `${provider?.name ?? 'Ficha'} · ${report.reason}`;
      const detail = document.createElement('p');
      detail.textContent = report.details || 'Sin detalle adicional.';
      const stateNote = document.createElement('small');
      stateNote.textContent = report.status === 'resolved' ? 'Estado: Resuelto' : 'Estado: Descartado';
      item.append(title, detail, stateNote);
      historyContainer.append(item);
    }
  }

  for (const report of pendingReports) {
    const article = document.createElement('article');
    article.className = 'recommendation';
    const provider = providersById.get(report.provider_id);
    const title = document.createElement('strong');
    title.textContent = `${provider?.name ?? 'Ficha'} · ${report.reason}`;
    const detail = document.createElement('p');
    detail.textContent = report.details || 'Sin detalle adicional.';
    const controls = document.createElement('div');
    controls.className = 'inline-form';
    const status = document.createElement('select');
    for (const value of ['open', 'under_review', 'resolved', 'dismissed']) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = {
        open: 'Abierto', under_review: 'En revisión', resolved: 'Resuelto', dismissed: 'Descartado',
      }[value];
      status.append(option);
    }
    status.value = report.status;
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'button button-secondary';
    save.textContent = 'Guardar estado';
    save.addEventListener('click', async () => {
      const originalLabel = save.textContent;
      save.disabled = true;
      save.textContent = 'Guardando...';

      try {
        const { data: updatedReport, error: updateError } = await state.supabase
          .from('reports')
          .update({ status: status.value, updated_at: new Date().toISOString() })
          .eq('id', report.id)
          .select('id,status')
          .maybeSingle();

        if (updateError || !updatedReport) {
          showToast('No se pudo guardar el estado. Verificá que tu cuenta tenga permisos de administración.', 'error');
          return;
        }

        report.status = updatedReport.status;
        showToast('Estado del reporte actualizado.', 'success');
      } catch {
        showToast('No se pudo guardar el estado. Revisá tu conexión e intentá otra vez.', 'error');
      } finally {
        save.disabled = false;
        save.textContent = originalLabel;
      }
    });
    controls.append(status, save);
    article.append(title, detail, controls);

    if (provider && provider.status !== 'disabled') {
      const disable = document.createElement('button');
      disable.type = 'button';
      disable.className = 'button button-light';
      disable.textContent = 'Desactivar ficha';
      disable.addEventListener('click', async () => {
        const confirmed = window.confirm(`¿Desactivar la ficha de ${provider.name}?`);
        if (!confirmed) return;
        const { error: updateError } = await state.supabase
          .from('providers')
          .update({ status: 'disabled', updated_at: new Date().toISOString() })
          .eq('id', provider.id);
        if (updateError) {
          window.alert('No se pudo desactivar la ficha.');
          return;
        }
        provider.status = 'disabled';
        displayProviders();
        displayReportProviders();
        await loadAdminReports();
      });
      article.append(disable);
    }
    container.append(article);
  }
}

async function signInWithGoogle() {
  const { error } = await state.supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) window.alert(`No se pudo iniciar sesión: ${error.message}`);
}

async function redeemInvite(event) {
  event.preventDefault();
  const message = byId('invite-message');
  const inviteCodeInput = byId('invite-code');
  const code = inviteCodeInput.value.trim();
  const { error } = await state.supabase.rpc('redeem_invite_code', { p_code: code });

  if (error) {
    const invalidCode = error.message.includes('invalid-invite-code');
    const errorMessage = invalidCode
      ? 'Código de barrio incorrecto. Por favor, verificá e intentá de nuevo.'
      : 'No se pudo validar el código. Revisá tu conexión e intentá otra vez.';
    setMessage(message, errorMessage, true);
    showToast(errorMessage, 'error');

    if (invalidCode) {
      inviteCodeInput.classList.remove('shake');
      void inviteCodeInput.offsetWidth;
      inviteCodeInput.classList.add('shake');
    }
    inviteCodeInput.focus();
    return;
  }

  inviteCodeInput.value = '';
  await syncSession();
  await loadDirectory();
  showToast('Código verificado correctamente. Teléfonos desbloqueados.', 'success');
}

async function submitProviderReview(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = byId('review-message');
  if (!requireNeighborhoodAccess() || !state.reviewProvider) return;

  const data = new FormData(form);
  const reason = String(data.get('reason') ?? '').trim() || null;
  const rating = data.get('rating') ? Number(data.get('rating')) : null;
  if (!reason && rating === null) {
    const errorMessage = 'Elegí estrellas, escribí un comentario o hacé ambas cosas.';
    setMessage(message, errorMessage, true);
    showToast(errorMessage, 'error');
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonText = submitButton.textContent;
  if (submitButton.disabled) return;
  submitButton.disabled = true;
  submitButton.textContent = 'Publicando...';
  setMessage(message, '');

  try {
    const profileName = state.session?.user?.user_metadata?.full_name ?? null;
    const { error } = await state.supabase.rpc('submit_provider_review', {
      p_provider_id: state.reviewProvider.id,
      p_reason: reason,
      p_rating: rating,
      p_display_author_name: data.get('showName') === 'on' ? (profileName || 'Vecino/a') : null,
    });

    if (error) {
      const errorMessage = error.message === 'review-content-required'
        ? 'Elegí estrellas, escribí un comentario o hacé ambas cosas.'
        : 'No se pudo publicar la opinión. Revisá tu conexión e intentá otra vez.';
      setMessage(message, errorMessage, true);
      showToast(errorMessage, 'error');
      return;
    }

    const providerId = state.reviewProvider.id;
    form.reset();
    await loadDirectory();
    displayRecommendations(providerId);
    setMessage(message, 'Tu opinión se agregó a esta ficha.');
    showToast('Gracias. Tu opinión quedó publicada como aporte vecinal no verificado.', 'success');
  } catch {
    const errorMessage = 'No se pudo publicar la opinión. Revisá tu conexión e intentá otra vez.';
    setMessage(message, errorMessage, true);
    showToast(errorMessage, 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
  }
}

async function submitContribution(event) {
  event.preventDefault();
  const message = byId('contribution-message');
  if (!requireNeighborhoodAccess()) return;

  const form = event.currentTarget;
  const data = new FormData(form);
  const selectedCategory = data.get('category');
  const suggestedCategory = selectedCategory === '__other__'
    ? String(data.get('suggestedCategory') ?? '').trim()
    : null;
  if (selectedCategory === '__other__' && !suggestedCategory) {
    setMessage(message, 'Indicá el rubro que querés sugerir.', true);
    return;
  }

  const profileName = state.session?.user?.user_metadata?.full_name ?? null;
  const { data: result, error } = await state.supabase.rpc('submit_provider_contribution_v2', {
    p_name: data.get('name'),
    p_phone: data.get('phone'),
    p_category: selectedCategory === '__other__' ? null : selectedCategory,
    p_suggested_category: suggestedCategory,
    p_reason: data.get('reason'),
    p_can_share_phone: data.get('canShare') === 'on',
    p_display_author_name: data.get('showName') === 'on' ? (profileName || 'Vecino/a') : null,
    p_rating: data.get('rating') ? Number(data.get('rating')) : null,
  });

  if (error) {
    const errorMessages = {
      'invalid-phone': 'Ingresá un celular argentino completo, con prefijo +54 9.',
      'phone-sharing-not-confirmed': 'Confirmá que tenés permiso para compartir el teléfono.',
      'neighborhood-access-required': 'Necesitás validar el código de Los Sauces.',
      'invalid-category': 'Elegí uno de los rubros disponibles.',
    };
    setMessage(message, errorMessages[error.message] || 'No se pudo guardar el aporte. Revisá los datos e intentá otra vez.', true);
    return;
  }

  form.reset();
  setMessage(
    message,
    result.created
      ? 'Aporte publicado. La ficha ya está visible como aporte de la comunidad.'
      : 'El teléfono ya estaba en el directorio: agregamos tu recomendación a la ficha existente.',
  );
  await loadDirectory();
}

async function submitReport(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = byId('report-message');
  if (!requireNeighborhoodAccess() || state.reportSubmitting) return;

  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonText = submitButton.textContent;
  state.reportSubmitting = true;
  submitButton.disabled = true;
  submitButton.textContent = 'Enviando...';
  setMessage(message, '');

  try {
    const data = new FormData(form);
    const { error } = await state.supabase.rpc('submit_provider_report', {
      p_provider_id: data.get('providerId'),
      p_reason: data.get('reason'),
      p_details: data.get('details') || null,
    });
    if (error) {
      const errorMessage = 'No se pudo enviar el reporte. Revisá el profesional y volvé a intentar.';
      setMessage(message, errorMessage, true);
      showToast(errorMessage, 'error');
      return;
    }

    form.reset();
    setMessage(message, '');
    showToast(
      'Gracias por avisarnos. Tu reporte fue enviado y será revisado por el equipo.',
      'success',
    );
  } catch {
    const errorMessage = 'No se pudo enviar el reporte. Revisá tu conexión e intentá otra vez.';
    setMessage(message, errorMessage, true);
    showToast(errorMessage, 'error');
  } finally {
    state.reportSubmitting = false;
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
  }
}

function recordSearchWhenIdle() {
  clearTimeout(state.searchTimer);
  const query = byId('search-input').value.trim();
  if (query.length < 2 || query === state.lastLoggedSearch) return;

  state.searchTimer = setTimeout(async () => {
    state.lastLoggedSearch = query;
    const count = filterDirectory(state.providers, query).length;
    const { error } = await state.supabase.rpc('record_directory_search', {
      p_results_count: count,
    });
    if (error) console.warn('No se pudo registrar la búsqueda.');
  }, 700);
}

function bindEvents() {
  byId('google-login').addEventListener('click', signInWithGoogle);
  byId('access-google-login').addEventListener('click', signInWithGoogle);
  byId('logout').addEventListener('click', async () => {
    await state.supabase.auth.signOut();
    window.location.reload();
  });
  byId('invite-form').addEventListener('submit', redeemInvite);
  byId('review-form').addEventListener('submit', submitProviderReview);
  byId('provider-category').addEventListener('change', (event) => {
    const isOther = event.currentTarget.value === '__other__';
    const field = byId('suggested-category-field');
    const input = byId('suggested-category');
    field.hidden = !isOther;
    input.required = isOther;
    if (!isOther) input.value = '';
  });
  byId('review-access-button').addEventListener('click', () => {
    byId('provider-dialog').close();
    showAccessPanel(
      state.session
        ? 'Tu cuenta ingresó con Google. Validá el código de invitación de Los Sauces para dejar opiniones.'
        : 'Ingresá con Google y usá el código de invitación de Los Sauces para dejar opiniones.',
    );
  });
  byId('contribution-form').addEventListener('submit', submitContribution);
  byId('report-form').addEventListener('submit', submitReport);
  byId('refresh-admin').addEventListener('click', loadAdminReports);
  byId('search-input').addEventListener('input', () => {
    displayProviders();
    recordSearchWhenIdle();
  });
  byId('close-dialog').addEventListener('click', () => byId('provider-dialog').close());
  byId('provider-dialog').addEventListener('click', (event) => {
    if (event.target === byId('provider-dialog')) byId('provider-dialog').close();
  });
}

async function start() {
  initializeTheme();
  byId('theme-toggle').addEventListener('click', () => {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('ofidi-theme', nextTheme);
    applyTheme(nextTheme);
  });
  const config = window.OFIDI_CONFIG ?? {};
  const isConfigured = config.supabaseUrl?.startsWith('https://')
    && !config.supabaseUrl.includes('YOUR_PROJECT_REF')
    && config.supabasePublishableKey
    && !config.supabasePublishableKey.includes('YOUR_SUPABASE');

  if (!isConfigured) {
    const notice = byId('system-notice');
    notice.hidden = false;
    notice.textContent = 'La aplicación todavía no está conectada a Supabase. Completá web/config.js con la URL del proyecto y la clave pública antes de probarla.';
    document.querySelectorAll('#google-login, #access-google-login, #contribution-form button, #report-form button')
      .forEach((button) => { button.disabled = true; });
    byId('provider-list').replaceChildren();
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'El directorio aparecerá cuando se configure la base de datos.';
    byId('provider-list').append(empty);
    return;
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    state.supabase = createClient(config.supabaseUrl, config.supabasePublishableKey);
    bindEvents();
    await syncSession();
    await loadDirectory();
    state.supabase.auth.onAuthStateChange(() => {
      queueMicrotask(async () => {
        try {
          await syncSession();
          await loadDirectory();
        } catch (error) {
          console.error(error);
        }
      });
    });
  } catch (error) {
    const notice = byId('system-notice');
    notice.hidden = false;
    notice.textContent = 'No se pudo conectar al servicio. Verificá la configuración de Supabase y la conexión a internet.';
    console.error(error);
  }
}

start();
