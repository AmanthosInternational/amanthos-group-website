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
  'af-nights', 'af-nights-shorter', 'af-company-website', 'af-submit', 'af-status', 'af-success', 'af-consent'];
const PFLICHT = {
  de: 'Höchstens 89 Nächte je Gast in 12 Monaten. Keine Wohnsitznahme, keine Anmeldung beim Einwohneramt.',
  en: "A maximum of 89 nights per guest within 12 months. No taking up of residence, no registration with the residents' registration office.",
};
const SPERR = ['longstay', 'apartment', 'wohnung', 'miete', 'mieten', 'mietvertrag', 'wohnsitz', 'studio', 'zuhause',
  'wohnen', 'moebliert', 'möbliert', 'pro monat', 'monatszimmer', 'mindestens 30 tage', 'kaution', 'monatsmiete',
  'radisson', 'prizeotel', 'reinigung jede woche', 'wöchentliche reinigung', 'weekly cleaning', 'cleaning every week',
  'cleaned weekly', 'rent', 'rental', 'furnished'];

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

  test(`${sp}: kein Sperrwort, keine Marke, kein Firmenpreis, Pflichtzusatz genau einmal`, () => {
    for (const w of SPERR) assert.ok(!new RegExp(`(^|[^\\p{L}])${w}([^\\p{L}]|$)`, 'iu').test(klein), w);
    for (const z of ["1'390", '1390', "1'690", '1690', "1'680", "1'980"]) assert.ok(!text.includes(z), z);
    // Addendum 1: the mandatory note of the town is the only place for "Wohnsitznahme".
    assert.equal(text.split(PFLICHT[sp]).length - 1, 1, 'Pflichtzusatz');
    assert.ok(!/wohnsitz(?!nahme)/i.test(text), 'Wohnsitz nur in Wohnsitznahme');
    assert.ok(text.includes(sp === 'de' ? '29 bis 89' : '29 to 89'));
    assert.ok(text.includes('5 %') && text.includes('10 %'));
    assert.ok(!text.includes(String.fromCharCode(0x2014)), 'Gedankenstrich');
    assert.ok(!text.includes(String.fromCharCode(0xdf)), 'Eszett');
  });

  test(`${sp}: Preise, Fakten und Rueckruf`, () => {
    for (const z of ["CHF 1'590", "CHF 1'890", "CHF 1'880", "CHF 2'180", "CHF 4'391.70", "CHF 5'192.70", "CHF 5'220.30",
      "CHF 6'021.30", 'CHF 12', 'CHF 20', '29']) assert.ok(text.includes(z), z);
    assert.ok(text.includes('Obstgartenstrasse 7, 8910 Affoltern am Albis'));
    assert.ok(text.includes(sp === 'de' ? '4 Gehminuten' : '4 minutes on foot'));
    assert.ok(text.includes(sp === 'de' ? 'Zürich HB 28 Minuten' : 'Zurich main station 28 minutes'));
    assert.ok(text.includes(sp === 'de' ? 'Zug 16 Minuten' : 'Zug 16 minutes'));
    assert.ok(text.includes(sp === 'de' ? 'alle 14 Tage' : 'every 14 days'));
    assert.ok(text.includes(sp === 'de' ? 'Bettwäschewechsel wöchentlich' : 'Bedding changed weekly'));
    assert.equal(html.split('https://cal.com/team/amanthos/affoltern-rueckruf').length - 1, 1);
    assert.ok(text.includes('+41 43 217 86 87') && text.includes('hotel@amanthos.com'));
    assert.ok(!text.includes('booking@'));
  });

  test(`${sp}: jede DOM-id genau einmal`, () => {
    for (const id of IDS) assert.equal(html.split(`id="${id}"`).length - 1, 1, id);
    assert.ok(/<input type="number" id="af-nights" name="nights" inputmode="numeric" min="29" max="89" step="1" value="29">/.test(html));
    assert.ok(/<input type="checkbox" id="af-nights-shorter"/.test(html));
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
