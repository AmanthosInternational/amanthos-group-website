// Seitenskript /affoltern/ (Plan prize-anfrageseite, K1, K4, K5). node --test, keine Abhaengigkeit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const page = require('../affoltern/js/affoltern-page.js');
const CFG = require('../affoltern/js/affoltern-config.js');
const fl = require('../affoltern/js/affoltern-firmenlink.js');

const K1 = ['form', 'name', 'email', 'phone', 'company', 'arrival', 'rooms', 'persons', 'nights', 'event_id',
  'locale', 'utm_source', 'utm_medium', 'utm_campaign', 'gclid', 'fbclid', 'company_website', 'consent', 'firmenlink'];

function eingabe(extra = {}) {
  return {
    name: 'Testperson', email: 'testperson@example.invalid', phone: '', company: 'Testfirma AG',
    arrival: '2027-01-15', rooms: '2', persons: '2', nights: '29', honeypot: '', lang: 'de',
    eventId: 'abcdef12-3456', consent: 'granted', firmenlink: '0123456789abcdef0123456789abcdef',
    campaign: { utm_source: 'firmenlink', utm_medium: 'email', utm_campaign: 'prize-29n-b2b', gclid: 'g1', fbclid: 'f1' },
    ...extra,
  };
}

test('Payload hat genau die 19 Schluessel von K1 in dieser Reihenfolge', () => {
  const p = page.buildPayload(eingabe(), CFG);
  assert.deepEqual(Object.keys(p), K1);
  assert.deepEqual(page.PAYLOAD_KEYS, K1);
  assert.equal(p.form, 'affoltern');
  assert.equal(p.firmenlink, '0123456789abcdef0123456789abcdef');
  assert.equal(p.utm_campaign, 'prize-29n-b2b');
  assert.equal(p.gclid, 'g1');
});

for (const [feld, wert] of [
  ['arrival', '15.01.2027'], ['rooms', '0'], ['rooms', '31'], ['rooms', '02'], ['persons', '3'],
  ['nights', '28'], ['nights', '90'], ['nights', '089'], ['firmenlink', 'kurz'],
]) {
  test(`Nebenfeld ${feld}=${wert} faellt auf leer`, () => {
    assert.equal(page.buildPayload(eingabe({ [feld]: wert }), CFG)[feld], '');
  });
}

test('Naechte 29 bis 89 frei, im Dreimonatsfenster geklemmt (Nachtrag 1)', () => {
  assert.equal(CFG.NIGHTS_MIN, 29);
  assert.equal(CFG.NIGHTS_MAX, 89);
  assert.equal(page.buildPayload(eingabe({ nights: '45' }), CFG).nights, '45');
  assert.equal(page.buildPayload(eingabe({ nights: '89' }), CFG).nights, '89');
  assert.equal(page.buildPayload(eingabe({ nights: '89', arrival: '2027-02-15' }), CFG).nights, '88');
  assert.equal(page.buildPayload(eingabe({ nights: 'kuerzer' }), CFG).nights, 'kuerzer');
  assert.equal(page.buildPayload(eingabe({ nights: '89', arrival: '' }), CFG).nights, '89', 'ohne Datum keine Klemme');
});

test('maxNaechte wie hotel_briefe.max_naechte', () => {
  const faelle = [['2026-11-01', 89], ['2027-01-15', 89], ['2027-01-30', 89], ['2027-01-31', 88], ['2027-02-01', 88],
    ['2027-02-15', 88], ['2027-02-28', 88], ['2027-03-01', 89], ['2028-02-01', 89], ['kein-datum', 89], ['2027-02-30', 89]];
  for (const [a, n] of faelle) assert.equal(page.maxNaechte(a, CFG), n, a);
});

test('ohne Einwilligung keine Klick-Kennungen im Payload', () => {
  const p = page.buildPayload(eingabe({ consent: '' }), CFG);
  assert.equal(p.consent, '');
  assert.equal(p.gclid, '');
  assert.equal(p.fbclid, '');
  assert.equal(p.utm_source, 'firmenlink');
});

test('readCampaign prueft jeden Wert einzeln', () => {
  const c = page.readCampaign('?utm_source=firmenlink&utm_medium=e%20mail&utm_campaign=prize-29n-b2b&fbclid=abc', true);
  assert.deepEqual(c, { utm_source: 'firmenlink', utm_medium: '', utm_campaign: 'prize-29n-b2b', gclid: '', fbclid: 'abc' });
  assert.equal(page.readCampaign('?fbclid=abc', false).fbclid, '');
});

test('Pflichtfelder und Sprache', () => {
  assert.equal(page.pflichtOk(page.buildPayload(eingabe(), CFG)), true);
  assert.equal(page.pflichtOk(page.buildPayload(eingabe({ name: 'X' }), CFG)), false);
  assert.equal(page.pflichtOk(page.buildPayload(eingabe({ email: 'kein-at' }), CFG)), false);
  // E-Mail ODER Telefon (Entscheid 02.11.2026)
  assert.equal(page.pflichtOk(page.buildPayload(eingabe({ email: '', phone: '+41 43 217 86 87' }), CFG)), true);
  assert.equal(page.pflichtOk(page.buildPayload(eingabe({ email: '', phone: '' }), CFG)), false);
  assert.equal(page.pflichtOk(page.buildPayload(eingabe({ email: '', phone: '123' }), CFG)), false);
  assert.equal(page.pflichtOk(page.buildPayload(eingabe({ email: 'kein-at', phone: '+41 43 217 86 87' }), CFG)), false);
  assert.equal(page.localeOf('en-GB'), 'en');
  assert.equal(page.localeOf('fr'), 'de');
  assert.match(page.fehlerText('de', CFG), /\+41 79 543 97 76.*hotel@amanthos\.com/);
});

test('arrivalBounds: heute bis heute plus 365 Tage', () => {
  assert.deepEqual(page.arrivalBounds(new Date(2026, 9, 26), 365), { min: '2026-10-26', max: '2027-10-26' });
});

function fenster(consent) {
  const calls = [];
  return {
    calls,
    amConsent: { get: () => consent },
    gtag: (...a) => calls.push(['gtag', ...a]),
    fbq: (...a) => calls.push(['fbq', ...a]),
    plausible: (...a) => calls.push(['plausible', ...a]),
  };
}

test('leadEvents ohne Einwilligung: kein fbq, kein Ads-Aufruf', () => {
  const w = fenster('denied');
  page.leadEvents(page.buildPayload(eingabe({ consent: '' }), CFG), { ...CFG, ADS_SEND_TO: 'AW-1/x' }, w);
  assert.equal(w.calls.filter((c) => c[0] === 'fbq').length, 0);
  assert.equal(w.calls.filter((c) => c[0] === 'gtag' && c[2] === 'conversion').length, 0);
  assert.equal(w.calls.filter((c) => c[2] === 'generate_lead').length, 1);
});

test('leadEvents mit Einwilligung: fbq Lead mit derselben event_id, Ads nur mit ADS_SEND_TO', () => {
  const w = fenster('granted');
  const p = page.buildPayload(eingabe(), CFG);
  page.leadEvents(p, { ...CFG, ADS_SEND_TO: '' }, w);
  const fbq = w.calls.find((c) => c[0] === 'fbq');
  assert.deepEqual(fbq, ['fbq', 'track', 'Lead', { content_name: 'affoltern-29n' }, { eventID: 'abcdef12-3456' }]);
  assert.equal(w.calls.filter((c) => c[2] === 'conversion').length, 0, 'ohne Label kein Ads-Aufruf');
  const w2 = fenster('granted');
  page.leadEvents(p, CFG, w2);
  assert.deepEqual(w2.calls.filter((c) => c[2] === 'conversion'), [
    ['gtag', 'event', 'conversion', { send_to: 'AW-702540316/wmccCMWW4qwdEJzU_84C' }],
  ]);
});

test('Firmenlink-Roundtrip: Generator verschluesselt, Seite entschluesselt', async () => {
  const token = fl.neuerToken();
  const id = await fl.kennung(token);
  assert.match(id, /^[0-9a-f]{32}$/);
  const eintraege = { [id]: await fl.verschluesseln(token, { firma: 'Testfirma AG', email: 'info@example.invalid' }) };
  assert.deepEqual(await fl.entschluesseln(token, eintraege), { kennung: id, firma: 'Testfirma AG', email: 'info@example.invalid' });
  assert.equal(await fl.entschluesseln(fl.neuerToken(), eintraege), null, 'fremder Token');
  assert.equal(await fl.entschluesseln('kein-token', eintraege), null);
  const falsch = { [id]: eintraege[id].slice(0, -4) + 'AAAA' };
  assert.equal(await fl.entschluesseln(token, falsch), null, 'manipuliertes Chiffrat');
});

// Entscheid 02.11.2026: direkte Handynummer der Rezeption statt Festnetz (KI-Rezeption).
test('Rezeptionsnummer ist die Handynummer in config und beiden Seiten', async () => {
  const { readFileSync } = await import('node:fs');
  assert.equal(CFG.PHONE, '+41 79 543 97 76');
  assert.equal(CFG.PHONE_HREF, 'tel:+41795439776');
  for (const f of ['../affoltern/index.html', '../affoltern/en/index.html']) {
    const html = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.equal(html.split('tel:+41795439776').length - 1, 2, f + ' tel-Links');
    assert.equal(html.split('+41 79 543 97 76').length - 1, 3, f + ' Anzeige');
    assert.ok(!html.includes('217 86 87') && !html.includes('432178687'), f + ' keine alte Nummer');
  }
});

// Feldpruefung beim Verlassen: gleiche Regel wie emailOk, leer bleibt erlaubt.
function fakeFeld(value) {
  const f = { value, validity: '', listeners: {}, setCustomValidity(m) { this.validity = m; }, addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); } };
  return f;
}

test('E-Mail-Feld: ungueltige Adresse wird beim Verlassen gemeldet, leer und gueltig nicht', () => {
  const de = fakeFeld('kein-at');
  assert.equal(page.emailFeldPruefen(de, 'de'), false);
  assert.match(de.validity, /E-Mail-Adresse/);
  const en = fakeFeld('a@b');
  assert.equal(page.emailFeldPruefen(en, 'en'), false);
  assert.match(en.validity, /email address/);
  for (const ok of ['', 'testperson@example.invalid']) {
    const f = fakeFeld(ok);
    f.validity = 'alt';
    assert.equal(page.emailFeldPruefen(f, 'de'), true);
    assert.equal(f.validity, '');
  }
});

test('init haengt die Pruefung an blur und change des Feldes und zeigt den Text im Status', () => {
  const els = { 'af-form': fakeFeld(''), 'af-email': fakeFeld('kein-at'), 'af-status': { textContent: '', className: '' } };
  const doc = { documentElement: { getAttribute: () => 'de' }, getElementById: (id) => els[id] || null };
  page.init(doc, { AFFOLTERN_CONFIG: CFG, fetch: undefined });
  assert.ok(els['af-email'].listeners.blur && els['af-email'].listeners.change);
  els['af-email'].listeners.blur[0]();
  assert.match(els['af-email'].validity, /E-Mail-Adresse/);
  assert.match(els['af-status'].textContent, /E-Mail-Adresse/);
  assert.match(els['af-status'].className, /fehler/);
  els['af-email'].value = '';
  els['af-email'].listeners.change[0]();
  assert.equal(els['af-email'].validity, '');
  assert.equal(els['af-status'].textContent, '');
});
