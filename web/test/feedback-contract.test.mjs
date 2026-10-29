import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const application = await readFile(new URL('../src/main.mjs', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

test('provides an accessible toast region for action feedback', () => {
  assert.match(html, /id="toast"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(styles, /\.toast-success/);
  assert.match(styles, /\.toast-error/);
});

test('shows a clear invalid-code message and shakes and refocuses the code field', () => {
  assert.match(application, /Código de barrio incorrecto\. Por favor, verificá e intentá de nuevo\./);
  assert.match(application, /inviteCodeInput\.classList\.add\('shake'\)/);
  assert.match(application, /inviteCodeInput\.focus\(\)/);
});

test('confirms successful code validation and unlocks neighborhood access', () => {
  assert.match(application, /Código verificado correctamente\. Teléfonos desbloqueados\./);
  assert.match(application, /showToast\([^;]*'success'\)/);
});

test('prevents duplicate reports while sending and confirms success after resetting the form', () => {
  assert.match(application, /submitButton\.disabled\s*=\s*true/);
  assert.match(application, /submitButton\.textContent\s*=\s*'Enviando\.\.\.'/);
  assert.match(application, /form\.reset\(\)/);
  assert.match(application, /Gracias por avisarnos\. Tu reporte fue enviado y será revisado por el equipo\./);
  assert.match(application, /submitButton\.disabled\s*=\s*false/);
});

test('confirms a report status only when Supabase returns the updated ticket', () => {
  assert.match(application, /\.eq\('id', report\.id\)[\s\S]*?\.select\('id,status'\)/);
  assert.match(application, /if\s*\(updateError\s*\|\|\s*!updatedReport\)/);
  assert.match(application, /Estado del reporte actualizado\./);
});
