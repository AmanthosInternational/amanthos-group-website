/**
 * Seitenskript /affoltern/ und /affoltern/en/ (docs/bauplan-prize-anfrageseite-2026-10-26.md, K1, K4, K5).
 *
 * Reine Funktionen oben (in Node testbar), die DOM-Verdrahtung unten in init(). Das Formular geht
 * als form=affoltern an POST /api/contact des website-backend. Gemeldet wird erst nach einer
 * Antwort 200: ein Lead in den Berichten, hinter dem keine zugestellte Anfrage steht, waere
 * schlimmer als keiner. Meta und Google Ads nur mit Einwilligung (window.amConsent), dieselbe
 * event_id im Browser und im Server-Ereignis, damit Meta entdoppelt.
 *
 * Firmenlink: das Inline-Skript im <head> hat den Token aus `#f=` nach window.__affolternToken
 * gelegt und das Fragment entfernt. Hier wird er mit firmen.json entschluesselt; passt er, stehen
 * Firma und E-Mail im Formular, und die Kennung (nie der Token) geht als `firmenlink` mit.
 */
(function () {
  'use strict';

  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'];
  var UTM_RE = /^[A-Za-z0-9._-]{1,64}$/;
  var CLICK_RE = /^[A-Za-z0-9._-]{1,512}$/;
  var KENNUNG_RE = /^[0-9a-f]{32}$/;
  var DATUM_RE = /^\d{4}-\d{2}-\d{2}$/;
  // Reihenfolge und Menge der Schluessel sind Kontrakt K1 mit contact_affoltern.parse.
  var PAYLOAD_KEYS = ['form', 'name', 'email', 'phone', 'company', 'arrival', 'rooms', 'persons', 'nights',
    'event_id', 'locale', 'utm_source', 'utm_medium', 'utm_campaign', 'gclid', 'fbclid', 'company_website',
    'consent', 'firmenlink'];

  var TEXTE = {
    de: {
      senden: 'Wird gesendet …',
      fehlerVor: 'Ihre Anfrage konnte nicht gesendet werden. Bitte rufen Sie uns an unter ',
      fehlerNach: ' oder schreiben Sie an ',
      pflicht: 'Bitte geben Sie Ihren Namen und eine gültige E-Mail-Adresse an.',
      firma: 'Ihre Firmenangaben sind bereits eingetragen.',
      naechte: function (n) { return n + ' Nächte'; }
    },
    en: {
      senden: 'Sending …',
      fehlerVor: 'Your enquiry could not be sent. Please call us on ',
      fehlerNach: ' or write to ',
      pflicht: 'Please enter your name and a valid email address.',
      firma: 'Your company details are already filled in.',
      naechte: function (n) { return n + ' nights'; }
    }
  };

  function str(v) { return v === undefined || v === null ? '' : String(v).trim(); }
  function localeOf(lang) { return /^en/i.test(str(lang)) ? 'en' : 'de'; }
  function T(lang) { return TEXTE[localeOf(lang)]; }

  function isoDatum(d) {
    var m = d.getMonth() + 1, t = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (t < 10 ? '0' : '') + t;
  }

  /** {min, max} fuer das Datumsfeld: heute bis heute plus ARRIVAL_DAYS. */
  function arrivalBounds(heute, tage) {
    var bis = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() + tage);
    return { min: isoDatum(heute), max: isoDatum(bis) };
  }

  /** UTM aus der Adresse, jeder Wert einzeln geprueft; Klick-Kennungen nur mit Einwilligung. */
  function readCampaign(search, mitKlicks) {
    var out = {};
    var p;
    try { p = new URLSearchParams(search || ''); } catch (e) { p = new URLSearchParams(''); }
    UTM_KEYS.forEach(function (k) {
      var v = str(p.get(k));
      out[k] = UTM_RE.test(v) ? v : '';
    });
    ['gclid', 'fbclid'].forEach(function (k) {
      var v = str(p.get(k));
      out[k] = mitKlicks && CLICK_RE.test(v) ? v : '';
    });
    return out;
  }

  function newEventId() {
    var c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return 'af-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  function erlaubteNaechte(cfg) {
    var liste = [String(cfg.NIGHTS_MAX), 'kuerzer'];
    if (cfg.NIGHTS_89_ENABLED) (cfg.NIGHTS_LONG || []).forEach(function (n) { liste.push(String(n)); });
    return liste;
  }

  /**
   * Der Koerper fuer POST /api/contact, genau die Schluessel aus PAYLOAD_KEYS in dieser Reihenfolge.
   * Nebenfelder fallen bei Formatfehlern auf leer, wie im Backend: ein Fehler darin kostet nie
   * die Anfrage. `i` = Formularwerte plus lang, eventId, campaign, consent, firmenlink.
   */
  function buildPayload(i, cfg) {
    var c = i.campaign || {};
    var rooms = str(i.rooms);
    var nights = str(i.nights).toLowerCase();
    var persons = str(i.persons);
    var out = {
      form: cfg.FORM_KIND,
      name: str(i.name).slice(0, 200),
      email: str(i.email).slice(0, 200),
      phone: str(i.phone).slice(0, 40),
      company: str(i.company).slice(0, 200),
      arrival: DATUM_RE.test(str(i.arrival)) ? str(i.arrival) : '',
      rooms: /^[1-9]\d?$/.test(rooms) && +rooms <= cfg.ROOMS_MAX ? rooms : '',
      persons: persons === '1' || persons === '2' ? persons : '',
      nights: erlaubteNaechte(cfg).indexOf(nights) >= 0 ? nights : '',
      event_id: str(i.eventId),
      locale: localeOf(i.lang),
      utm_source: '', utm_medium: '', utm_campaign: '',
      gclid: '', fbclid: '',
      company_website: str(i.honeypot),
      consent: i.consent === 'granted' ? 'granted' : '',
      firmenlink: KENNUNG_RE.test(str(i.firmenlink)) ? str(i.firmenlink) : ''
    };
    UTM_KEYS.forEach(function (k) { out[k] = UTM_RE.test(str(c[k])) ? str(c[k]) : ''; });
    // Klick-Kennungen gehoeren nur mit Einwilligung zur Anfrage (Server-Ereignis an Meta).
    ['gclid', 'fbclid'].forEach(function (k) {
      out[k] = out.consent === 'granted' && CLICK_RE.test(str(c[k])) ? str(c[k]) : '';
    });
    var geordnet = {};
    PAYLOAD_KEYS.forEach(function (k) { geordnet[k] = out[k]; });
    return geordnet;
  }

  function pflichtOk(p) {
    return p.name.length >= 2 && /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(p.email);
  }

  function granted(w) {
    try { return !!(w.amConsent && w.amConsent.get() === 'granted'); } catch (e) { return false; }
  }

  /** Meldungen nach 200: GA4 immer (Consent Mode regelt), Ads und Meta nur mit Einwilligung. */
  function leadEvents(payload, cfg, w) {
    w = w || (typeof window !== 'undefined' ? window : {});
    var ok = granted(w);
    try {
      if (typeof w.gtag === 'function') {
        w.gtag('event', 'generate_lead', { lead_form: 'affoltern', rooms: payload.rooms, locale: payload.locale });
        if (ok && cfg.ADS_SEND_TO) w.gtag('event', 'conversion', { send_to: cfg.ADS_SEND_TO });
      }
    } catch (e) { /* nie werfen */ }
    try {
      if (ok && typeof w.fbq === 'function') {
        w.fbq('track', 'Lead', { content_name: cfg.CONTENT_NAME }, { eventID: String(payload.event_id) });
      }
    } catch (e) { /* nie werfen */ }
    try {
      if (typeof w.plausible === 'function') {
        w.plausible('Lead', { props: { form: 'affoltern', locale: payload.locale, firmenlink: payload.firmenlink ? 'ja' : 'nein' } });
      }
    } catch (e) { /* nie werfen */ }
  }

  function fehlerText(lang, cfg) {
    var t = T(lang);
    return t.fehlerVor + cfg.PHONE + t.fehlerNach + cfg.EMAIL + '.';
  }

  // ---- DOM ------------------------------------------------------------------------------

  function $(doc, id) { return doc.getElementById(id); }

  function naechteOptionen(doc, cfg, lang) {
    var sel = $(doc, 'af-nights');
    if (!sel || !cfg.NIGHTS_89_ENABLED) return;
    (cfg.NIGHTS_LONG || []).forEach(function (n) {
      var o = doc.createElement('option');
      o.value = String(n);
      o.textContent = T(lang).naechte(n);
      sel.appendChild(o);
    });
  }

  function vorausfuellen(doc, w, cfg, lang, zustand) {
    var token = w.__affolternToken;
    var fl = w.AffolternFirmenlink;
    if (!token || !fl || typeof w.fetch !== 'function') return Promise.resolve(null);
    return w.fetch(cfg.FIRMEN_JSON, { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return j && j.v === 1 ? fl.entschluesseln(token, j.eintraege) : null; })
      .then(function (d) {
        if (!d) return null;
        zustand.firmenlink = d.kennung;
        var firma = $(doc, 'af-company'), mail = $(doc, 'af-email'), hinweis = $(doc, 'af-prefill');
        if (firma && d.firma && !firma.value) firma.value = d.firma;
        if (mail && d.email && !mail.value) mail.value = d.email;
        if (hinweis) { hinweis.textContent = T(lang).firma; hinweis.hidden = false; }
        return d;
      })
      .catch(function () { return null; });
  }

  function init(doc, w) {
    var cfg = w.AFFOLTERN_CONFIG;
    var form = $(doc, 'af-form');
    if (!cfg || !form) return;
    var lang = localeOf(doc.documentElement.getAttribute('lang'));
    var zustand = { firmenlink: '', laeuft: false };

    var datum = $(doc, 'af-arrival');
    if (datum) {
      var g = arrivalBounds(new Date(), cfg.ARRIVAL_DAYS);
      datum.min = g.min; datum.max = g.max;
    }
    naechteOptionen(doc, cfg, lang);
    vorausfuellen(doc, w, cfg, lang, zustand);

    var status = $(doc, 'af-status');
    function zeigen(text, fehler) {
      if (!status) return;
      status.textContent = text;
      status.className = fehler ? 'af-status af-status--fehler' : 'af-status';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (zustand.laeuft) return;
      function wert(id) { var el = $(doc, id); return el ? el.value : ''; }
      var einwilligung = granted(w) ? 'granted' : '';
      var payload = buildPayload({
        name: wert('af-name'), email: wert('af-email'), phone: wert('af-phone'), company: wert('af-company'),
        arrival: wert('af-arrival'), rooms: wert('af-rooms'), persons: wert('af-persons'), nights: wert('af-nights'),
        honeypot: wert('af-company-website'), lang: lang, eventId: newEventId(),
        campaign: readCampaign(w.location ? w.location.search : '', einwilligung === 'granted'),
        consent: einwilligung, firmenlink: zustand.firmenlink
      }, cfg);
      if (!pflichtOk(payload)) { zeigen(T(lang).pflicht, true); return; }

      zustand.laeuft = true;
      var knopf = $(doc, 'af-submit');
      if (knopf) knopf.disabled = true;
      zeigen(T(lang).senden, false);
      w.fetch(cfg.API_BASE + cfg.CONTACT_PATH, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      }).then(function (r) {
        if (r.status !== 200) throw new Error('status ' + r.status);
        leadEvents(payload, cfg, w);
        form.hidden = true;
        var danke = $(doc, 'af-success');
        if (danke) { danke.hidden = false; if (danke.focus) danke.focus(); }
        zeigen('', false);
      }).catch(function () {
        zeigen(fehlerText(lang, cfg), true);
      }).then(function () {
        zustand.laeuft = false;
        if (knopf) knopf.disabled = false;
      });
    });
  }

  var api = {
    PAYLOAD_KEYS: PAYLOAD_KEYS, buildPayload: buildPayload, readCampaign: readCampaign, newEventId: newEventId,
    arrivalBounds: arrivalBounds, leadEvents: leadEvents, localeOf: localeOf, pflichtOk: pflichtOk,
    fehlerText: fehlerText, erlaubteNaechte: erlaubteNaechte, init: init, VERSION: '1'
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined' && window && window.document) {
    window.AffolternPage = api;
    if (window.document.readyState === 'loading') {
      window.document.addEventListener('DOMContentLoaded', function () { init(window.document, window); });
    } else {
      init(window.document, window);
    }
  }
})();
