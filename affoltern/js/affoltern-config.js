/**
 * Amanthos Hotels Affoltern am Albis: Konstanten der Seiten /affoltern/ (deutsch) und
 * /affoltern/en/ (englisch), Kontrakt K5 aus docs/bauplan-prize-anfrageseite-2026-10-26.md.
 *
 * Alles, was die zwei Seiten und das Seitenskript an festen Werten brauchen, steht hier und
 * nur hier. Keine Logik, kein DOM. Aufbau wie js/glattbrugg-config.js der Living-Seiten.
 *
 * PRICES sind die Preise der Seite, nicht die des Firmeneingangs: der Firmenpreis ab 5 Zimmern
 * steht nach Entscheid Bogdan (26.10.2026) nur in der Antwort per Mail, nie auf der Seite.
 * Gerechnet wird im Backend (hotel_briefe.berechnen); hier steht nur, was die Seite zeigt.
 *
 * NIGHTS_MIN bis NIGHTS_MAX: 29 bis 89 Naechte seit der schriftlichen Bestaetigung der Stadt vom
 * 29.10.2026 (Nachtrag 1 des Plans). Die Obergrenze je Anreise (Aufenthalt endet vor dem gleichen
 * Kalendertag drei Monate spaeter) rechnet das Seitenskript wie das Backend (hotel_briefe.max_naechte).
 * Die Staffel (ab 59 Naechten 5 %, 89 Naechte 10 %) steht als Text auf der Seite, gerechnet wird im
 * Backend.
 *
 * ADS_SEND_TO ist das Label der eigenen Conversion-Aktion "Prize Affoltern 29N - Anfrage
 * (Formular)" (Konto 102-092-8693, angelegt 28.10.2026, Lead-Formular, eine je Klick). Das
 * Seitenskript ruft sie nur nach einer Antwort 200 und nur mit Einwilligung auf. Leer hiesse: kein
 * Ads-Conversion-Aufruf, GA4, Meta und Plausible zaehlen trotzdem.
 *
 * API_BASE prueft auf typeof ... === 'string' statt auf den Wahrheitswert: ein Test kann
 * window.AMANTHOS_API_BASE auf den leeren String setzen (gleiche Origin).
 */
(function () {
  'use strict';

  var api = {
    API_BASE: (typeof window !== 'undefined' && typeof window.AMANTHOS_API_BASE === 'string')
      ? window.AMANTHOS_API_BASE : 'https://amanthos-website-api.onrender.com',
    CONTACT_PATH: '/api/contact',
    FORM_KIND: 'affoltern',
    PAGE_URL_DE: 'https://www.amanthos.com/affoltern/',
    PAGE_URL_EN: 'https://www.amanthos.com/affoltern/en/',
    GA4_ID: 'G-1EW53WRTNR',
    ADS_ID: 'AW-702540316',
    ADS_SEND_TO: 'AW-702540316/wmccCMWW4qwdEJzU_84C',
    CONTENT_NAME: 'affoltern-29n',
    CAL_LINK: 'https://cal.com/team/amanthos/affoltern-rueckruf',
    PHONE: '+41 43 217 86 87',
    PHONE_HREF: 'tel:+41432178687',
    EMAIL: 'hotel@amanthos.com',
    NIGHTS_MIN: 29,
    NIGHTS_MAX: 89,
    ROOMS_MAX: 30,
    ARRIVAL_DAYS: 365,
    FIRMEN_JSON: '/affoltern/firmen.json',
    PRICES: {
      einzel_bis_feb: 1590,
      zweit: 1880,
      einzel_ab_maerz: 1890,
      zweit_ab_maerz: 2180,
      fruehstueck_tag: 12,
      tiefgarage_tag: 20
    },
    VERSION: '1'
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined' && window) window.AFFOLTERN_CONFIG = api;
})();
