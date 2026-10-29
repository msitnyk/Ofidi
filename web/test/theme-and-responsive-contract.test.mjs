import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const application = await readFile(new URL('../src/main.mjs', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

test('offers an accessible theme switcher in the site header', () => {
  assert.match(html, /id="theme-toggle"/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /Cambiar a modo oscuro/);
});

test('persists and applies an explicit light or dark preference', () => {
  assert.match(application, /localStorage\.getItem\('ofidi-theme'/);
  assert.match(application, /localStorage\.setItem\('ofidi-theme'/);
  assert.match(application, /document\.documentElement\.dataset\.theme/);
});

test('defines dark theme tokens and mobile responsive layouts', () => {
  assert.match(styles, /:root\[data-theme="dark"\]/);
  assert.match(styles, /@media \(max-width: 38rem\)/);
  assert.match(styles, /\.category-chips/);
  assert.match(styles, /overflow-x: auto/);
});
