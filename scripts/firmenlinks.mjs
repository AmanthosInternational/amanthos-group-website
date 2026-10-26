#!/usr/bin/env node
/**
 * Firmenlinks fuer /affoltern/ (Kontrakt K4, docs/bauplan-prize-anfrageseite-2026-10-26.md).
 *
 *   node scripts/firmenlinks.mjs <firmenliste.csv> [--json affoltern/firmen.json] [--links <datei>] [--alle-neu]
 *
 * Liest die Firmenliste (Spalten nr, firma, email_rolle; amanthos-creative
 * kampagnen/prize-29-naechte-2026-11/firmenliste.csv), erzeugt je Zeile einen neuen Token und
 * schreibt zwei Dateien:
 *   - firmen.json ins Repo: nur Kennungen und Chiffrate, keine Firma, keine Adresse im Klartext
 *   - die Linkliste (nr,firma,link) AUSSERHALB jedes Repos, Vorgabe
 *     ~/Projects/werbemittel/prize-29n-2026-11/firmenlinks.csv; sie ist der einzige Ort, an dem
 *     Token und Firma zusammen stehen
 * Bestehende Links bleiben gueltig: liegt die Linkliste schon da, behaelt jede Firma ihren Token
 * (Schluessel: der Firmenname, ohne Gross- und Kleinschreibung), nur neue Zeilen bekommen einen
 * neuen. So kann die Firmenliste wachsen, ohne dass versandte Links ihre Vorausfuellung verlieren.
 * Firmen, die aus der Liste fallen, verlieren ihren Eintrag. `--alle-neu` erzeugt alle Tokens neu
 * und entwertet damit jeden alten Link (nur bewusst, etwa nach einem Leck der Linkliste).
 * Node 22, nur WebCrypto, keine Abhaengigkeit.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const hier = dirname(fileURLToPath(import.meta.url));
const fl = require(resolve(hier, '../affoltern/js/affoltern-firmenlink.js'));

export const BASIS = 'https://www.amanthos.com/affoltern/';
export const UTM = 'utm_source=firmenlink&utm_medium=email&utm_campaign=prize-29n-b2b';
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;

/** CSV mit Anfuehrungszeichen (RFC 4180, ohne Zeilenumbrueche in Feldern). */
export function csvZeilen(text) {
  const zeilen = String(text).replace(/^﻿/, '').split(/\r?\n/).filter((z) => z.trim());
  const feld = (z) => {
    const out = [];
    let cur = '', q = false;
    for (let i = 0; i < z.length; i++) {
      const c = z[i];
      if (q) {
        if (c === '"' && z[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
      } else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur);
    return out;
  };
  const [kopf, ...rest] = zeilen.map(feld);
  return rest.map((w) => Object.fromEntries(kopf.map((k, i) => [k.trim(), (w[i] || '').trim()])));
}

export function link(token) {
  return `${BASIS}?${UTM}#f=${token}`;
}

function csvFeld(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function schluesselVon(firma) {
  return String(firma || '').trim().toLowerCase();
}

/** Firma (klein) zu Token aus einer vorhandenen Linkliste (nr,firma,link); kaputte Zeilen fallen weg. */
export function bestehendeTokens(linkCsv) {
  const karte = new Map();
  for (const z of csvZeilen(linkCsv || '')) {
    const token = String(z.link || '').split('#f=')[1] || '';
    if (fl.tokenBytes(token) && z.firma) karte.set(schluesselVon(z.firma), token);
  }
  return karte;
}

/**
 * {json, links, neu}: firmen.json-Objekt und Zeilen der Linkliste, ohne zu schreiben. `bestehend`
 * (aus bestehendeTokens) behaelt die Tokens bekannter Firmen; `neu` zaehlt die neuen Tokens.
 */
export async function erzeugen(firmen, bestehend = new Map()) {
  const eintraege = {};
  const links = [];
  let neu = 0;
  for (const f of firmen) {
    const firma = String(f.firma || '').trim();
    if (!firma) continue;
    const email = EMAIL_RE.test(String(f.email_rolle || '').trim()) ? f.email_rolle.trim() : '';
    let token = bestehend.get(schluesselVon(firma));
    if (!token) { token = fl.neuerToken(); neu++; }
    eintraege[await fl.kennung(token)] = await fl.verschluesseln(token, { firma, email });
    links.push({ nr: f.nr, firma, link: link(token) });
  }
  return { json: { v: 1, eintraege }, links, neu };
}

async function main(argv) {
  const args = argv.slice(2);
  const quelle = args.find((a) => !a.startsWith('--'));
  const opt = (name, vorgabe) => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? args[i + 1] : vorgabe;
  };
  if (!quelle) {
    console.error('Aufruf: node scripts/firmenlinks.mjs <firmenliste.csv> [--json <datei>] [--links <datei>]');
    return 2;
  }
  const jsonPfad = resolve(opt('--json', resolve(hier, '../affoltern/firmen.json')));
  const linkPfad = resolve(opt('--links', resolve(homedir(), 'Projects/werbemittel/prize-29n-2026-11/firmenlinks.csv')));
  const repo = resolve(hier, '..');
  if (!relative(repo, linkPfad).startsWith('..')) {
    console.error('Die Linkliste gehoert nicht ins Repo: sie traegt die Tokens.');
    return 2;
  }
  const bestehend = args.includes('--alle-neu') || !existsSync(linkPfad)
    ? new Map() : bestehendeTokens(readFileSync(linkPfad, 'utf8'));
  const { json, links, neu } = await erzeugen(csvZeilen(readFileSync(quelle, 'utf8')), bestehend);
  writeFileSync(jsonPfad, JSON.stringify(json, null, 1) + '\n');
  mkdirSync(dirname(linkPfad), { recursive: true });
  writeFileSync(linkPfad, ['nr,firma,link', ...links.map((l) => [l.nr, l.firma, l.link].map(csvFeld).join(','))].join('\n') + '\n');
  const mitMail = csvZeilen(readFileSync(quelle, 'utf8')).filter((f) => EMAIL_RE.test(String(f.email_rolle || '').trim())).length;
  console.log(`${links.length} Firmenlinks, davon ${mitMail} mit Rollenadresse; ${links.length - neu} behalten, ${neu} neu; firmen.json ${Object.keys(json.eintraege).length} Eintraege`);
  console.log(`Linkliste: ${linkPfad}`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv).then((code) => { process.exitCode = code; });
}
