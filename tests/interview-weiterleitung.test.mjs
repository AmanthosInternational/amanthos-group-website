// Weiterleitung /interview: nur lang, stelle, src und test gehen an das Erstinterview weiter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../interview/index.html', import.meta.url), 'utf8');
const skript = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const ZIEL = 'https://script.google.com/macros/s/AKfycbzRzCSL-xWge4Ky9QngkOiWe1P0jEmv2ZWOGkddRZUM__oQfcYw3Gic2YFcbTkM1OY2/exec';

function leite(suche) {
  let ziel = null;
  vm.runInNewContext(skript, { window: { location: { search: suche, replace: (u) => { ziel = u; } } }, URLSearchParams });
  return ziel;
}

test('ohne Parameter geht es auf die blanke Adresse', () => {
  assert.equal(leite(''), ZIEL);
});

test('lang, stelle und src gehen kodiert mit', () => {
  assert.equal(leite('?lang=pt&stelle=housekeeping+interlaken&src=meta-hcsi-pt'),
    ZIEL + '?lang=pt&stelle=housekeeping%20interlaken&src=meta-hcsi-pt');
});

test('fremde Parameter und ueberlange Werte bleiben zurueck', () => {
  assert.equal(leite('?fbclid=abc&utm_source=x&lang=pl&src=' + 'x'.repeat(81)), ZIEL + '?lang=pl');
});

test('Sonderzeichen werden kodiert, das Ziel bleibt dieselbe Adresse', () => {
  const u = leite('?stelle=%22%3E%3Cscript%3E&lang=de');
  assert.ok(u.startsWith(ZIEL + '?'));
  assert.ok(!u.includes('<') && !u.includes('"'));
});

test('ohne JavaScript bleibt die feste Weiterleitung', () => {
  assert.match(html, /<noscript>\s*<meta http-equiv="refresh" content="0;url=https:\/\/script\.google\.com\/macros\/s\/AKfycbz/);
});
