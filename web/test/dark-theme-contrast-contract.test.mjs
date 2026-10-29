import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const darkTheme = styles.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';

test('uses high-contrast surfaces, text, borders and controls in dark mode', () => {
  assert.match(darkTheme, /--bg:\s*#0b1510/);
  assert.match(darkTheme, /--surface:\s*#17251d/);
  assert.match(darkTheme, /--ink:\s*#f6fff8/);
  assert.match(darkTheme, /--muted:\s*#d0dfd5/);
  assert.match(darkTheme, /--border:\s*#5f806d/);
});

test('does not leave white controls or light-theme shadows in dark mode', () => {
  assert.match(styles, /:root\[data-theme="dark"\][\s\S]*?--input-bg:\s*#101d16/);
  assert.match(styles, /:root\[data-theme="dark"\][\s\S]*?--header-bg:\s*rgb\(11 21 16 \/ 96%\)/);
});
