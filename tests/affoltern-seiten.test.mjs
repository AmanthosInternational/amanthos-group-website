// Seiten /affoltern/ und /affoltern/en/ (Plan prize-anfrageseite, Segment 2): Wortregel, Preise,
// Fakten, DOM-Kontrakt, Reihenfolge der Skripte, hreflang. node --test, keine Abhaengigkeit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SEITEN = {
  de: readFileSync(new URL('../affoltern/index.html', import.meta.url), 'utf8'),
  en: readFileSync(new URL('../affoltern/en/index.html', import.meta.url), 'utf8'),
};
const IDS = ['af-form', 'af-name', 'af-email', 'af-phone', 'af-company', 'af-arrival', 'af-rooms', 'af-persons',
  'af-nights', 'af-company-website', 'af-submit', 'af-status', 'af-success', 'af-consent'];
const SPERR = ['longstay', 'apartment', 'wohnung', 'miete', 'mieten', 'mietvertrag', 'wohnsitz', 'studio', 'zuhause',
  'wohnen', 'moebliert', 'möbliert', 'pro monat', 'monatszimmer', 'mindestens 30 tage', 'kaution', 'monatsmiete',
  'radisson', 'prizeotel', 'jede woche', 'wöchentlich', 'weekly', 'rent', 'rental', 'furnished'];

/** Sichtbarer Text plus alt, title, description: alles, was ein Mensch oder eine Suchmaschine liest. */
function lesbar(html) {
  const meta = [...html.matchAll(/<(?:meta|img)[^>]*(?:content|alt)="([^"]*)"/g)].map((m) => m[1]).join(' ');
  const body = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
  return (body + ' ' + meta).replace(/\s+/g, ' ');
}

for (const [sp, html] of Object.entries(SEITEN)) {
  const text = lesbar(html);
  const klein = text.toLowerCase();

  test(`${sp}: kein Sperrwort, keine Marke, kein Firmenpreis, keine 89`, () => {
    for (const w of SPERR) assert.ok(!new RegExp(`(^|[^\\p{L}])${w}([^\\p{L}]|$)`, 'iu').test(klein), w);
    for (const z of ["1'390", '1390', "1'690", '1690', "1'680", "1'980"]) assert.ok(!text.includes(z), z);
    assert.ok(!/\b89\b/.test(text), '89');
    assert.ok(!text.includes(String.fromCharCode(0x2014)), 'Gedankenstrich');
    assert.ok(!text.includes(String.fromCharCode(0xdf)), 'Eszett');
  });

  test(`${sp}: Preise, Fakten und Rueckruf`, () => {
    for (const z of ["CHF 1'590", "CHF 1'890", "CHF 1'880", "CHF 2'180", 'CHF 12', 'CHF 20', '29']) assert.ok(text.includes(z), z);
    assert.ok(text.includes('Obstgartenstrasse 7, 8910 Affoltern am Albis'));
    assert.ok(text.includes(sp === 'de' ? '4 Gehminuten' : '4 minutes on foot'));
    assert.ok(text.includes(sp === 'de' ? 'Zürich HB 28 Minuten' : 'Zurich main station 28 minutes'));
    assert.ok(text.includes(sp === 'de' ? 'Zug 16 Minuten' : 'Zug 16 minutes'));
    assert.ok(text.includes(sp === 'de' ? 'alle 14 Tage' : 'every 14 days'));
    assert.equal(html.split('https://cal.com/team/amanthos/affoltern-rueckruf').length - 1, 1);
    assert.ok(text.includes('+41 43 217 86 87') && text.includes('hotel@amanthos.com'));
    assert.ok(!text.includes('booking@'));
  });

  test(`${sp}: jede DOM-id genau einmal`, () => {
    for (const id of IDS) assert.equal(html.split(`id="${id}"`).length - 1, 1, id);
    assert.ok(/<option value="29" selected>/.test(html));
    assert.ok(!/<option value="(3\d|[4-8]\d)"[^>]*>[^<]*(Nächte|nights)/.test(html), 'lange Aufenthalte nur per Schalter');
  });

  test(`${sp}: Firmenlink-Fragment vor consent.js, consent.js vor gtag`, () => {
    const token = html.indexOf('__affolternToken');
    const consent = html.indexOf('/js/consent.js');
    const gtag = html.indexOf("gtag('config'");
    assert.ok(token > 0 && token < consent && consent < gtag);
    assert.ok(html.indexOf('replaceState') < consent);
  });

  test(`${sp}: canonical und hreflang`, () => {
    const eigen = sp === 'de' ? 'https://www.amanthos.com/affoltern/' : 'https://www.amanthos.com/affoltern/en/';
    assert.ok(html.includes(`<link rel="canonical" href="${eigen}">`));
    assert.ok(html.includes('hreflang="de" href="https://www.amanthos.com/affoltern/"'));
    assert.ok(html.includes('hreflang="en" href="https://www.amanthos.com/affoltern/en/"'));
    assert.ok(html.includes(`<html lang="${sp}">`));
  });
}
