// Generator scripts/firmenlinks.mjs (Plan prize-anfrageseite, K4). Synthetische Firmen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { csvZeilen, erzeugen, bestehendeTokens, link, UTM } from '../scripts/firmenlinks.mjs';

const require = createRequire(import.meta.url);
const fl = require('../affoltern/js/affoltern-firmenlink.js');

const CSV = [
  'nr,firma,branche,ort,website,email_rolle',
  '1,Testbau AG,Bau,"Zürich, Urdorf",https://example.invalid,info@testbau.example.invalid',
  '2,"Muster ""Montage"" GmbH",Montage,Zug,,',
  '3,Dritte AG,IT,Zug,,kaputt-at',
].join('\n');

test('CSV mit Anfuehrungszeichen und Kommas im Feld', () => {
  const z = csvZeilen(CSV);
  assert.equal(z.length, 3);
  assert.equal(z[0].ort, 'Zürich, Urdorf');
  assert.equal(z[1].firma, 'Muster "Montage" GmbH');
});

test('je Zeile ein Eintrag, Token 22 Zeichen, kein Klartext im JSON', async () => {
  const { json, links } = await erzeugen(csvZeilen(CSV));
  assert.equal(json.v, 1);
  assert.equal(Object.keys(json.eintraege).length, 3);
  assert.equal(links.length, 3);
  const roh = JSON.stringify(json);
  for (const wort of ['Testbau', 'Montage', 'Dritte', 'info@', 'example']) assert.ok(!roh.includes(wort), wort);
  for (const l of links) {
    const token = l.link.split('#f=')[1];
    assert.match(token, /^[A-Za-z0-9_-]{22}$/);
    assert.ok(l.link.startsWith('https://www.amanthos.com/affoltern/?' + UTM + '#f='));
    const d = await fl.entschluesseln(token, json.eintraege);
    assert.equal(d.firma, l.firma);
  }
  const [mit, ohne, kaputt] = await Promise.all(links.map((l) => fl.entschluesseln(l.link.split('#f=')[1], json.eintraege)));
  assert.equal(mit.email, 'info@testbau.example.invalid');
  assert.equal(ohne.email, '');
  assert.equal(kaputt.email, '', 'ungueltige Rollenadresse faellt weg');
});

test('ohne Linkliste erzeugt jeder Lauf neue Tokens', async () => {
  const a = await erzeugen(csvZeilen(CSV));
  const b = await erzeugen(csvZeilen(CSV));
  assert.notEqual(a.links[0].link, b.links[0].link);
  assert.match(link('A'.repeat(22)), /utm_source=firmenlink&utm_medium=email&utm_campaign=prize-29n-b2b#f=A{22}$/);
});

test('firmen.json im Repo ist gueltig und ohne Klartext', () => {
  const pfad = new URL('../affoltern/firmen.json', import.meta.url);
  assert.ok(existsSync(pfad), 'firmen.json fehlt: Generator laufen lassen');
  const j = JSON.parse(readFileSync(pfad, 'utf8'));
  assert.equal(j.v, 1);
  const ids = Object.keys(j.eintraege);
  assert.ok(ids.length > 0);
  assert.ok(ids.every((k) => /^[0-9a-f]{32}$/.test(k)));
  assert.ok(Object.values(j.eintraege).every((v) => /^[A-Za-z0-9_-]+$/.test(v)));
  assert.ok(!readFileSync(pfad, 'utf8').includes('@'));
});

test('mit Linkliste behalten bekannte Firmen ihren Token, nur neue bekommen einen', async () => {
  const erst = await erzeugen(csvZeilen(CSV));
  const liste = ['nr,firma,link', ...erst.links.map((l) => `${l.nr},"${l.firma.replace(/"/g, '""')}",${l.link}`)].join('\n');
  const gross = CSV + '\n4,Neue Firma AG,Bau,Zug,,neu@example.invalid';
  const zweit = await erzeugen(csvZeilen(gross), bestehendeTokens(liste));
  assert.equal(zweit.neu, 1);
  assert.deepEqual(zweit.links.slice(0, 3).map((l) => l.link), erst.links.map((l) => l.link));
  // Ein alter Link fuellt mit der neuen firmen.json weiter vor.
  const altToken = erst.links[0].link.split('#f=')[1];
  assert.equal((await fl.entschluesseln(altToken, zweit.json.eintraege)).firma, 'Testbau AG');
  assert.equal(Object.keys(zweit.json.eintraege).length, 4);
  // Gross- und Kleinschreibung des Namens zaehlt nicht, kaputte Zeilen fallen weg.
  assert.equal(bestehendeTokens(liste + '\n9,TESTBAU AG,kein-link').get('testbau ag'), altToken);
});
