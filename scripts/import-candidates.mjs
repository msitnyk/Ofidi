import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { normalizeArgentinaMobile } from '../web/src/domain/phone.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultCsvPath = path.join(projectRoot, 'materiales', 'candidatos-profesionales-interno.csv');
const historicalReason = 'Contacto histórico del registro interno de Los Sauces; actividad actual no revalidada por OFIDI.';

export function buildImportHeaders(apiKey) {
  const headers = {
    apikey: apiKey,
    'content-type': 'application/json',
    accept: 'application/json',
  };

  // Legacy service_role keys are JWTs; new sb_secret keys must stay out of Authorization.
  if (apiKey.startsWith('eyJ')) headers.authorization = `Bearer ${apiKey}`;
  return headers;
}

function parseCsvRows(csvText) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];

    if (character === '"') {
      if (quoted && csvText[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && csvText[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('Malformed candidate CSV: unterminated quoted field.');
  if (field !== '' || row.length) {
    row.push(field);
    if (row.some((value) => value.trim() !== '')) rows.push(row);
  }
  return rows;
}

export function parseCandidatesCsv(csvText) {
  const [rawHeaders, ...rows] = parseCsvRows(csvText);
  if (!rawHeaders) throw new Error('Candidate CSV is empty.');
  const headers = rawHeaders.map((header, index) => (
    index === 0 ? header.replace(/^\uFEFF/, '') : header
  ));

  const requiredHeaders = ['Name', 'Phone', 'Categories', 'CurrentStatus'];
  for (const required of requiredHeaders) {
    if (!headers.includes(required)) throw new Error(`Candidate CSV is missing the ${required} column.`);
  }

  return rows.map((values) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    const aliasMatch = record.Name.match(/\s*\(alias:\s*([^)]+)\)\s*$/i);
    const aliases = aliasMatch
      ? aliasMatch[1].split(';').map((alias) => alias.trim()).filter(Boolean)
      : [];
    const name = aliasMatch ? record.Name.slice(0, aliasMatch.index).trim() : record.Name.trim();

    return {
      name,
      phone: record.Phone.trim(),
      categories: record.Categories.split(';').map((category) => category.trim()).filter(Boolean),
      aliases,
      currentStatus: record.CurrentStatus.trim(),
    };
  });
}

export function prepareImportCandidates(csvText, { expectedCount = 41 } = {}) {
  const sourceCandidates = parseCandidatesCsv(csvText);
  if (sourceCandidates.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} candidate records; found ${sourceCandidates.length}.`);
  }

  const seenPhones = new Set();
  return sourceCandidates.map((candidate, index) => {
    const phone = normalizeArgentinaMobile(candidate.phone);
    if (!phone) throw new Error(`Invalid Argentine mobile in candidate row ${index + 2}.`);
    if (seenPhones.has(phone)) throw new Error(`Duplicate phone in candidate row ${index + 2}.`);
    seenPhones.add(phone);

    if (!candidate.name || candidate.name.length > 160 || !candidate.categories.length) {
      throw new Error(`Candidate row ${index + 2} is missing valid name or category data.`);
    }
    const category = candidate.categories.join(' · ');
    if (category.length > 80) throw new Error(`Candidate row ${index + 2} has a category that is too long.`);

    return {
      name: candidate.name,
      phone,
      category,
      aliases: candidate.aliases,
      reason: historicalReason,
      importKey: `initial-candidates:${phone}`,
    };
  });
}

async function callImportRpc(candidate, { supabaseUrl, serviceRoleKey, adminUserId, fetchImpl }) {
  const response = await fetchImpl(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/admin_import_candidate`, {
    method: 'POST',
    headers: buildImportHeaders(serviceRoleKey),
    body: JSON.stringify({
      p_import_key: candidate.importKey,
      p_name: candidate.name,
      p_phone: candidate.phone,
      p_category: candidate.category,
      p_aliases: candidate.aliases,
      p_reason: candidate.reason,
      p_uploader_id: adminUserId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase rejected a candidate record (HTTP ${response.status}). No response body was logged.`);
  }
  return response.json();
}

export async function importCandidates({
  csvPath = defaultCsvPath,
  supabaseUrl = process.env.SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
  adminUserId = process.env.OFIDI_ADMIN_USER_ID,
  fetchImpl = fetch,
  expectedCount = 41,
  dryRun = false,
} = {}) {
  const csvText = await readFile(csvPath, 'utf8');
  const candidates = prepareImportCandidates(csvText, { expectedCount });

  if (dryRun) {
    return { validated: candidates.length, imported: 0, alreadyImported: 0, profilesCreated: 0 };
  }
  if (!supabaseUrl || !/^https?:\/\//i.test(supabaseUrl) || !serviceRoleKey || !adminUserId) {
    throw new Error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OFIDI_ADMIN_USER_ID in the local environment.');
  }
  if (!/^[0-9a-f-]{36}$/i.test(adminUserId)) {
    throw new Error('OFIDI_ADMIN_USER_ID must be the Google account UUID from Supabase Auth.');
  }

  let imported = 0;
  let alreadyImported = 0;
  let profilesCreated = 0;
  for (const candidate of candidates) {
    const result = await callImportRpc(candidate, {
      supabaseUrl,
      serviceRoleKey,
      adminUserId,
      fetchImpl,
    });
    if (result.already_imported) alreadyImported += 1;
    else imported += 1;
    if (result.created_profile) profilesCreated += 1;
  }

  return { validated: candidates.length, imported, alreadyImported, profilesCreated };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const result = await importCandidates({ dryRun });
  if (dryRun) {
    console.log(`Validación OK: ${result.validated} candidatos; no se escribió en Supabase.`);
    return;
  }
  console.log(`Importación terminada: ${result.imported} registros nuevos, ${result.alreadyImported} ya importados, ${result.profilesCreated} fichas nuevas.`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
