/**
 * Firmenlink der Seiten /affoltern/ (Kontrakt K4, docs/bauplan-prize-anfrageseite-2026-10-26.md).
 *
 * Ein persoenlicher Link je Firma fuellt Firma und E-Mail im Formular vor, ohne Backend, ohne
 * Datenbank und ohne Klartext in der URL. Der Link traegt im Fragment `#f=<token>` 16 Zufallsbytes
 * (base64url, 22 Zeichen). Aus dem Token entstehen zwei Dinge:
 *
 *   kennung   = die ersten 16 Bytes von SHA-256(Token) als 32 Hex: Schluessel in firmen.json und
 *               Wert, der mit der Anfrage ans Backend geht (der Token selbst verlaesst nie den Browser)
 *   schluessel = HKDF-SHA-256(Token, salt SALT, info INFO), 256 Bit, fuer AES-GCM
 *
 * firmen.json = {"v": 1, "eintraege": {kennung: base64url(iv || chiffrat)}}. Wer die Datei liest,
 * sieht weder Firmen noch Adressen und kann keine Kennung einer Firma zuordnen.
 *
 * Dieselbe Datei laeuft im Browser (window.AffolternFirmenlink) und in Node 22 (require), damit
 * Generator und Seite nachweislich dasselbe rechnen. Nur WebCrypto, keine Abhaengigkeit.
 */
(function () {
  'use strict';

  var SALT = 'amanthos-affoltern-v1';
  var INFO = 'firmenlink';
  var TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

  function subtle() {
    var c = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
    return c && c.subtle ? c.subtle : null;
  }

  function utf8(text) { return new TextEncoder().encode(text); }

  function b64urlEncode(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64urlDecode(text) {
    var t = String(text).replace(/-/g, '+').replace(/_/g, '/');
    while (t.length % 4) t += '=';
    var s = atob(t);
    var out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  function hex(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return s;
  }

  /** Token-Bytes oder null, wenn der Text kein Token ist. */
  function tokenBytes(token) {
    if (!TOKEN_RE.test(String(token || ''))) return null;
    var b = b64urlDecode(token);
    return b.length === 16 ? b : null;
  }

  /** Die Kennung des Tokens (32 Hex) oder null. */
  function kennung(token) {
    var b = tokenBytes(token);
    var s = subtle();
    if (!b || !s) return Promise.resolve(null);
    return s.digest('SHA-256', b).then(function (h) { return hex(new Uint8Array(h).slice(0, 16)); });
  }

  function schluessel(b, nutzung) {
    var s = subtle();
    return s.importKey('raw', b, 'HKDF', false, ['deriveKey']).then(function (basis) {
      return s.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: utf8(SALT), info: utf8(INFO) },
        basis, { name: 'AES-GCM', length: 256 }, false, [nutzung]);
    });
  }

  /** Verschluesselt {firma, email} fuer firmen.json (nur der Generator braucht das). */
  function verschluesseln(token, daten, iv) {
    var b = tokenBytes(token);
    if (!b) return Promise.reject(new Error('kein Token'));
    var vektor = iv || globalThis.crypto.getRandomValues(new Uint8Array(12));
    return schluessel(b, 'encrypt').then(function (k) {
      return subtle().encrypt({ name: 'AES-GCM', iv: vektor }, k, utf8(JSON.stringify(daten)));
    }).then(function (c) {
      var ct = new Uint8Array(c);
      var alles = new Uint8Array(vektor.length + ct.length);
      alles.set(vektor, 0);
      alles.set(ct, vektor.length);
      return b64urlEncode(alles);
    });
  }

  /**
   * {kennung, firma, email} fuer den Token, oder null: kein Token, kein Eintrag, falscher
   * Schluessel, kaputte Daten. Wirft nie, damit die Seite ohne Firmenlink normal weiterlaeuft.
   */
  function entschluesseln(token, eintraege) {
    var b = tokenBytes(token);
    if (!b || !subtle() || !eintraege || typeof eintraege !== 'object') return Promise.resolve(null);
    var id = null;
    return kennung(token).then(function (k) {
      id = k;
      var roh = Object.prototype.hasOwnProperty.call(eintraege, id) ? eintraege[id] : null;
      if (typeof roh !== 'string') return null;
      var alles = b64urlDecode(roh);
      if (alles.length < 29) return null;
      return schluessel(b, 'decrypt').then(function (key) {
        return subtle().decrypt({ name: 'AES-GCM', iv: alles.slice(0, 12) }, key, alles.slice(12));
      });
    }).then(function (klar) {
      if (!klar) return null;
      var d = JSON.parse(new TextDecoder().decode(klar));
      return {
        kennung: id,
        firma: typeof d.firma === 'string' ? d.firma.slice(0, 200) : '',
        email: typeof d.email === 'string' ? d.email.slice(0, 200) : ''
      };
    }).catch(function () { return null; });
  }

  /** Ein neuer Token, 16 Zufallsbytes base64url. */
  function neuerToken() {
    return b64urlEncode(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  }

  var api = {
    SALT: SALT, INFO: INFO, kennung: kennung, verschluesseln: verschluesseln,
    entschluesseln: entschluesseln, neuerToken: neuerToken, tokenBytes: tokenBytes
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined' && window) window.AffolternFirmenlink = api;
})();
