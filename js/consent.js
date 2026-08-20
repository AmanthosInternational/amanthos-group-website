/*
 * Consent Mode v2 + Einwilligungs-Banner (Amanthos Group).
 *
 * Diese Datei wird SYNCHRON und VOR dem gtag-Loader eingebunden -- nur so stehen
 * die Consent-Defaults im dataLayer, bevor gtag.js konfiguriert wird. Kein defer,
 * kein async, keine Minifizierung (bewusst: eine Datei, ein Name, alle vier
 * Amanthos-Websites gleich).
 *
 * Grundhaltung:
 *   - EWR + UK: nichts messen, bis der Besucher zustimmt (Regional-Default denied).
 *   - Schweiz und Rest der Welt: messen erlaubt, Widerspruch jederzeit moeglich
 *     (revDSG verlangt keine vorherige Einwilligung).
 *   - Ads-Signale sind ueberall und dauerhaft denied -- es gibt keine
 *     Ads-Verknuepfung, also auch keine DoubleClick-Cookies.
 *   - Ablehnung heisst wirklich Ablehnung: zusaetzlich zum consent-update wird
 *     window['ga-disable-<ID>'] gesetzt, Googles offizieller Kill-Switch. Danach
 *     geht kein Hit mehr raus, auch kein cookieloser.
 *
 * Besonderheit dieser Site: sie hat kein js/i18n.js und damit keinen
 * localStorage-Sprachschluessel. Die Sprache steht im data-lang-Attribut des
 * <html>-Elements (Startseite, umgeschaltet per setLang()); die Unterseiten
 * tragen nur lang="de" bzw. lang="en". Beides wird gelesen, in dieser Reihenfolge.
 *
 * Alles laeuft in try/catch. Ist localStorage gesperrt, verhaelt sich die Seite
 * wie "noch keine Wahl getroffen" -- und wirft nie.
 */
(function () {
  'use strict';

  var GA4_ID = 'G-1EW53WRTNR';
  var LANG_KEY = null; // kein i18n-localStorage auf dieser Site, siehe dict()
  var STORE_KEY = 'am_consent_analytics';
  var PRIVACY_URL = '/privacy/';
  var FALLBACK_LANG = 'de';

  // EU-27 + Island, Liechtenstein, Norwegen + UK. CH steht bewusst NICHT darin.
  var OPT_IN_REGIONS = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
    'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
    'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB'
  ];

  var TEXTS = {
    de: {
      title: 'Einwilligung in die Reichweitenmessung',
      text: 'Diese Website misst ihre Nutzung mit Google Analytics und setzt dafür Cookies. Sie entscheiden, ob wir das dürfen. Ihre Wahl können Sie jederzeit ändern.',
      accept: 'Akzeptieren',
      decline: 'Ablehnen',
      privacy: 'Datenschutz'
    },
    en: {
      title: 'Consent for usage measurement',
      text: 'This website measures its usage with Google Analytics and sets cookies for that purpose. You decide whether we may. You can change your choice at any time.',
      accept: 'Accept',
      decline: 'Decline',
      privacy: 'Privacy'
    }
  };

  var STYLE_ID = 'am-consent-style';
  var BANNER_ID = 'am-consent-banner';
  var CSS = [
    '.am-consent{position:fixed;left:0;right:0;bottom:0;z-index:9999;',
    'background:#2a2c25;color:#faf8f5;font-family:inherit;font-size:.9rem;',
    'line-height:1.55;padding:1rem 1.25rem;box-shadow:0 -2px 14px rgba(0,0,0,.28)}',
    '.am-consent-inner{max-width:1100px;margin:0 auto;display:flex;flex-wrap:wrap;',
    'align-items:center;justify-content:space-between;gap:.8rem 1.5rem}',
    '.am-consent-text{margin:0;flex:1 1 320px}',
    '.am-consent-actions{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem}',
    '.am-consent-btn{font:inherit;cursor:pointer;border:1px solid #faf8f5;',
    'background:transparent;color:#faf8f5;padding:.55rem 1.5rem;border-radius:2px;',
    'min-width:8.5rem;text-align:center}',
    '.am-consent-btn:hover,.am-consent-btn:focus{background:#faf8f5;color:#2a2c25}',
    '.am-consent-link{color:#faf8f5;text-decoration:underline;white-space:nowrap}',
    '@media(max-width:560px){.am-consent-btn{flex:1 1 auto}}'
  ].join('');

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  function readChoice() {
    try {
      var v = window.localStorage.getItem(STORE_KEY);
      return (v === 'granted' || v === 'denied') ? v : null;
    } catch (e) { return null; }
  }

  function writeChoice(state) {
    try { window.localStorage.setItem(STORE_KEY, state); } catch (e) { /* Privatmodus */ }
  }

  function dict() {
    var code = null;
    if (LANG_KEY) {
      try { code = window.localStorage.getItem(LANG_KEY); } catch (e) { /* Privatmodus */ }
    }
    if (!code) {
      // Startseite: data-lang wird von setLang() gepflegt. Unterseiten: nur lang.
      try { code = document.documentElement.getAttribute('data-lang'); } catch (e) { /* s.o. */ }
    }
    if (!code) {
      try { code = document.documentElement.getAttribute('lang'); } catch (e) { /* s.o. */ }
    }
    code = (code || '').toString().slice(0, 2).toLowerCase();
    return TEXTS[code] || TEXTS[FALLBACK_LANG];
  }

  /*
   * Bereits gesetzte Google-Cookies entfernen.
   *
   * `analytics_storage: denied` und der ga-disable-Kill-Switch verhindern NEUE
   * Cookies und neue Hits. Was schon auf dem Geraet liegt, raeumen sie nicht
   * weg: die Kennung _ga ueberlebt eine Ablehnung sonst zwei Jahre lang.
   *
   * Zwei Fallstricke, die den naiven Einzeiler wirkungslos machen:
   *  - Geloescht wird nur, wenn Name, Pfad UND Domain exakt zur Setzung passen.
   *    GA4 setzt _ga auf der registrierbaren Domain (".example.com"), nicht auf
   *    dem Host. Darum jede Domain-Variante durchgehen.
   *  - Der Name von _ga_<ID> haengt an der Mess-ID, und aus der GTM-Zeit koennen
   *    _gcl_*-Cookies liegen. Darum document.cookie lesen statt Namen raten.
   */
  function clearGoogleCookies() {
    try {
      var parts = String(location.hostname || '').split('.');
      var scopes = [''];
      for (var i = 0; i < parts.length - 1; i++) {
        var d = parts.slice(i).join('.');
        scopes.push('; domain=.' + d);
        scopes.push('; domain=' + d);
      }
      var names = { '_ga': true };
      names['_ga_' + String(GA4_ID).replace(/^G-/, '')] = true;
      var raw = document.cookie ? document.cookie.split(';') : [];
      for (var j = 0; j < raw.length; j++) {
        var n = raw[j].split('=')[0].trim();
        if (/^(_ga|_gid|_gat|_gac_|_gcl_)/.test(n)) { names[n] = true; }
      }
      var dead = '=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; max-age=0';
      for (var name in names) {
        if (!Object.prototype.hasOwnProperty.call(names, name)) { continue; }
        for (var k = 0; k < scopes.length; k++) {
          document.cookie = name + dead + scopes[k];
        }
      }
    } catch (e) { /* nie werfen */ }
  }

  function apply(state) {
    // Reihenfolge zaehlt: erst den Kill-Switch loesen bzw. setzen, dann melden.
    if (state === 'granted') {
      window['ga-disable-' + GA4_ID] = false;
      gtag('consent', 'update', { analytics_storage: 'granted' });
    } else {
      gtag('consent', 'update', { analytics_storage: 'denied' });
      window['ga-disable-' + GA4_ID] = true;
      clearGoogleCookies();
    }
    // meta.js haengt an dieser Meldung: es laedt mit defer und damit NACH
    // dem synchronen Erstlauf, bekommt spaetere Wechsel aber sofort mit.
    try {
      document.dispatchEvent(new CustomEvent('am:consent-change', { detail: { state: state } }));
    } catch (e) { /* nie werfen */ }
  }

  // ---- Defaults setzen, bevor gtag.js ueberhaupt laedt --------------------
  try {
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted'
    });
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      region: OPT_IN_REGIONS
    });
    var stored = readChoice();
    if (stored) apply(stored);
  } catch (e) { /* Consent darf die Seite nie brechen */ }

  // ---- Banner -------------------------------------------------------------
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.appendChild(document.createTextNode(CSS));
    (document.head || document.documentElement).appendChild(s);
  }

  function button(label, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'am-consent-btn';
    b.appendChild(document.createTextNode(label));
    b.addEventListener('click', onClick);
    return b;
  }

  function buildBanner() {
    var t = dict();
    injectStyle();

    var box = document.createElement('div');
    box.id = BANNER_ID;
    box.className = 'am-consent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', t.title);

    var inner = document.createElement('div');
    inner.className = 'am-consent-inner';

    var p = document.createElement('p');
    p.className = 'am-consent-text';
    p.appendChild(document.createTextNode(t.text));

    var actions = document.createElement('div');
    actions.className = 'am-consent-actions';

    // Beide Knoepfe: gleiche Klasse, gleiche Groesse, gleiche Ebene, keine
    // Vorbelegung. Ablehnen steht nicht versteckt hinter einem zweiten Klick.
    actions.appendChild(button(t.accept, function () { api.set('granted'); }));
    actions.appendChild(button(t.decline, function () { api.set('denied'); }));

    var link = document.createElement('a');
    link.className = 'am-consent-link';
    link.href = PRIVACY_URL;
    link.appendChild(document.createTextNode(t.privacy));
    actions.appendChild(link);

    inner.appendChild(p);
    inner.appendChild(actions);
    box.appendChild(inner);
    document.body.appendChild(box);
    return box;
  }

  function showBanner() {
    try {
      if (!document.body) return;
      var existing = document.getElementById(BANNER_ID);
      if (existing) { existing.style.display = ''; return; }
      buildBanner();
    } catch (e) { /* nie werfen */ }
  }

  function hideBanner() {
    try {
      var el = document.getElementById(BANNER_ID);
      if (el) el.style.display = 'none';
    } catch (e) { /* nie werfen */ }
  }

  var api = {
    get: function () { return readChoice(); },
    set: function (state) {
      try {
        if (state !== 'granted' && state !== 'denied') return;
        writeChoice(state);
        apply(state);
        hideBanner();
      } catch (e) { /* nie werfen */ }
    },
    open: function () { showBanner(); }
  };

  window.amConsent = api;

  function onReady() {
    if (readChoice() === null) showBanner();
  }

  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onReady);
    } else {
      onReady();
    }
  } catch (e) { /* nie werfen */ }
})();
