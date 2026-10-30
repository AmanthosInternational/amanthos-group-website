---
thema: prize-anfrageseite
datum: 2026-10-26
status: aktiv
modus: kurz
modus_grund: zwei Segmente neben Segment 0, vom Orchestrator seriell gebaut (kein Parallelbau mit Agenten); --kurz im Auftrag
plankey: prize-anfrageseite
repo: ~/Projects/amanthos-platform (Segment 0, 1, Verdrahtung C); ~/Projects/amanthos-group-website (Segment 2, Verdrahtung D), dort Plankopie byte-gleich als erster Commit
basis: platform origin/main 9b30825; group-website origin/main ee59ea5 (Pages main /, CNAME www.amanthos.com, plan-abgleich Required, strict false); Living-Muster js/glattbrugg-config.js und js/glattbrugg-page.js; website-api Env 26.10. gelesen: META_PIXEL_ID 516536478992095 (= js/meta.js), LEAD_ANTWORT gesetzt, HOTEL_SENDER_EMAIL, HOTEL_REPLY_TO, LEAD_ANTWORT_AFFOLTERN, AUTOANTWORT_AFFOLTERN, LEAD_KOPIE_AFFOLTERN dort NICHT gesetzt; Testzahl website-backend nicht gemessen (lokaler Klon veraltet, nur origin/main gelesen)
klasse: FL-3 (Gaeste-PII, Mailversand an Interessenten, render.yaml, Workflow): Handmerge je PR nach Einzelfreigabe Bogdan, nie --auto; status aktiv setzt der Orchestrator nach Bogdans Freigabe im ersten Commit jedes Segment-Branches, nicht der Planer
---

# Bauplan: Prize Affoltern, Anfrageseite amanthos.com/affoltern mit Firmen-Schnellanfrage

> Auftrag `~/.claude/briefings/prize-firmenanfrage-seite-2026-10-26.md`, Entscheide Bogdan 26.10. (Firmenpreis nur in der Web-Autoantwort, zu zweit ab Maerz CHF 2'180, 89 Naechte gebaut aber aus). Branches `segment/prize-anfrageseite/<nr>-<slug>` von `origin/main`, jeder Commit mit `Plan-Abgleich:` (`erledigt:`, `offen:`, `abweichung:`). Kein Versand an Firmen, kein Schalter umgelegt, kein Env gesetzt, keine Migration, kein Umbau der Startseite ohne Bogdan. Keine Personendaten in Tests, Fixtures, Logs (Adressen `example.invalid`, Name `Testperson`). Kein Gedankenstrich. Sperrwoerter (hotel_briefe.SPERRWOERTER plus Kaution, Monatsmiete) nie; Radisson und Prizeotel nie; CHF 1'390/1'690 nie auf der Seite und nie im Meta-Brief; "jede Woche" nie (Zwischenreinigung alle 14 Tage).

## 1. Ziel und Produktivitaetspruefung

Eine kurze Landingpage `/affoltern/` (DE) und `/affoltern/en/` (EN) im Pages-Repo amanthos-group-website, Preis zuerst, echte Fotos, Formular mit Name, E-Mail, Telefon, Firma, Anreise, Zimmer, Personen je Zimmer und Naechte (29, kuerzer auf Anfrage; 30 bis 89 hinter Schalter). Absenden geht als `form=affoltern` an `POST /api/contact` des bestehenden website-backend: interne Mail an hotel@ und sales@, Meta-CAPI-Lead auf den gemeinsamen Pixel, Trichterzeile `grenchen_leads objekt=affoltern`, danach genau eine automatische Antwort ab hotel@ mit berechnetem Preis und Cal.com-Rueckruflink ueber den bestehenden `lead_antwort`-Pfad (Schalter LEAD_ANTWORT_AFFOLTERN, Vorgabe aus). Der Firmeneingang ist ein persoenlicher Link je Firma aus `firmenliste.csv`, der Firma und E-Mail vorausfuellt, ohne Backend, ohne DB und ohne Klartext in der URL.

1. **Billigster Weg:** kein neuer Dienst. Siebte Formularart in `_handle_contact` nach dem Muster `contact_glattbrugg.py`; Antwort ueber `lead_antwort.senden` (Schalter, hotel@-Absender, Bcc-Kopien, Lock auf der Trichterzeile, Sperrliste, Probe-Modus sind da); Preisregel als reine Funktion neben `hotel_briefe.PREISE`; Seite nach Living-Muster. Geschaetzt rund 330 Produktivzeilen platform, rund 650 group-website (davon rund 400 HTML-Text der zwei Seiten).
2. **Plattform statt Bau:** Das Meta-Sofortformular deckt nur den oeffentlichen Eingang, kennt keinen Firmenlink und keine Google-Zielseite; Cal.com fragt keinen Preis; ein Formulardienst (Typeform, Tally) traegt PII zu einem Dritten und antwortet nicht mit Preis. Das Relay AmanthosWebseiten ist nicht noetig: `meta_capi.send_lead(site='')` meldet an denselben Pixel 516536478992095, den `js/meta.js` im Browser feuert (Entdopplung ueber `event_id`).
3. **Engpass:** nicht der Code, sondern drei Dinge aussen: die Affoltern-Env auf `amanthos-website-api` (heute nicht gesetzt, siehe Kopf), "Senden als hotel@amanthos.com" im Postfach von `SMTP_USER` (Prize-Plan Frage 5) und die B2B-Mail selbst (Dispatcher). Bis die Env steht, aendert jeder Merge nichts: `lead_antwort.modus('affoltern')` ist ohne `LEAD_ANTWORT_AFFOLTERN` `aus`.

**Befunde, die den Schnitt bestimmen (26.10. im Code gelesen):** `lead_antwort._antwort` beansprucht `antwort_am` auf der Trichterzeile, also `upsert_lead` vor der Antwort im selben Thread. `lead_antwort._grund` macht `freitext` zum Sonderfall (Entwurf ans Team statt Antwort): das Formular hat deshalb kein Nachrichtenfeld. `lead_fakten.fakten` liefert fuer affoltern `dict(PREISE)`; die Berechnung gehoert dorthin, der Text nach `hotel_briefe`. `test_hotel_briefe` pinnt die Betragsmenge auf `PREISE.values()`, den Satz "bei Anreise ab Maerz auf Anfrage" und `1'390` als Sperrwort: Firmenpreise stehen deshalb in `FIRMENPREISE` (nie im Meta-Brief), `zweit_ab_maerz` kommt in `PREISE`, und die Sperrwortpruefung trennt Woerter (alle Texte) von Betraegen (nur Meta-Brief). jarvis ordnet Web-Mails ueber `Formular auf <url>` (Slug `affoltern`) und das Wort `Affoltern` im Betreff zu; Lokalteil `development` gilt als Test. group-website hat bewusst kein package.json; `node --test` laeuft ohne. `/affoltern` antwortet auf Pages mit 301 auf `/affoltern/`, der DoD-Curl braucht `-L` oder den Schraegstrich.

## 2. Segment 0: Kontrakt (erster Commit auf `segment/prize-anfrageseite/1-backend`, PR A zusammen mit Segment 1)

```bauplan-scope segment=0
website-backend/lead_kontrakt.py
website-backend/hotel_briefe.py
website-backend/tests/test_hotel_briefe.py
website-backend/tests/test_lead_kontrakt.py
docs/bauplan-prize-anfrageseite-2026-10-26.md
```

- **K1 Payload** `POST /api/contact`, JSON, 19 Schluessel: `form`=`affoltern`; `name` (2 bis 200 Zeichen, Pflicht, einzeilig); `email` (Pflicht, Muster wie glattbrugg); `phone` (bis 40); `company` (bis 200); `arrival` (`YYYY-MM-DD`, heute bis heute plus 365 Tage, sonst leer); `rooms` (`1` bis `30`, sonst leer); `persons` (`1`|`2` je Zimmer, sonst leer); `nights` (`29`|`kuerzer`; `30` bis `89` nur bei `NAECHTE_89_AKTIV`, sonst leer); `event_id`; `locale` (`de`|`en`); `utm_source`, `utm_medium`, `utm_campaign`; `gclid`, `fbclid`; `company_website` (Honigtopf); `consent` (`granted`|leer); `firmenlink` (32 Hex oder leer). Kein Nachrichtenfeld. Antworten 200 `{ok:true}`, 400 nur bei Name oder E-Mail, 429, 502, 503 wie heute. Ein Formatfehler in einem Nebenfeld kostet nie den Lead.
- **K2 Antwort** `lead_kontrakt.WebAnfrage(Anfrage, total=False)` mit `personen: int | None`; Web-Anfrage = `{lead_id: event_id, objekt: 'affoltern', sprache: locale, quelle: 'website', zimmer: rooms, einzug: arrival, naechte: 29|None, freitext: False, einwilligung_nachfass: False, personen}`. Genau eine Mail je Anfrage: `lead_antwort.senden(anfrage, email, name, personen=...)`, keine zweite Bestaetigung ueber `grenchen_autoantwort`. Absender `mail_absender.hotel()`, Reply-To `HOTEL_REPLY_TO`, Bcc `LEAD_KOPIE_AFFOLTERN`, Betreff `hotel_briefe.BETREFF`, Schalter: der schwaechere von `LEAD_ANTWORT` und `LEAD_ANTWORT_AFFOLTERN`.
- **K3 Preisregel** `hotel_briefe.berechnen(anreise_iso, zimmer, personen=1) -> dict | None`: Saison `winter` bei Anreisemonat 11, 12, 1, 2, sonst `sommer`; der Anreisetag bestimmt den Preis des ganzen Aufenthalts; `PREISE` neu `{'einzel_bis_feb': 1590, 'zweit': 1880, 'einzel_ab_maerz': 1890, 'zweit_ab_maerz': 2180, 'fruehstueck_tag': 12, 'tiefgarage_tag': 20}`; `FIRMENPREISE = {'bis_feb': 1390, 'ab_maerz': 1690}` je Zimmer ab 5 Zimmern, zu zweit plus 290 je Zimmer (Entscheid Bogdan 26.10.); Ergebnis `{saison, zimmer, personen, firmen, zimmerpreis, gesamt = zimmer * zimmerpreis, naechte: 29, fruehstueck_tag, tiefgarage_tag}`; `None` bei fehlendem Datum oder fehlender Zimmerzahl (dann wie heute `dict(PREISE)` und der Meta-Brief). Nur 29 Naechte werden gerechnet; `kuerzer` und 30 bis 89 bekommen den Satz "den Preis fuer N Naechte nennen wir Ihnen persoenlich". `hotel_briefe.offerte(sprache, fakten, anfrage) -> list[str]`: Dank mit Echo (Anreise als Datum, Zimmer, Personen, Naechte), Preiszeile mit Gesamtbetrag inkl. MWST, bei `firmen` der Firmenpreis-Satz, Fruehstueck und Tiefgarage, Vorauszahlung und "keine Anmeldung bei der Gemeinde", Cal-Link `lead_kontrakt.CAL_LINK['affoltern']` genau einmal, Kontakt, `signatur()`. Sperrwortpruefung: `sperrwort_treffer(text, betraege=True)`; Woerter gelten fuer alle Texte, die Betraege `1'390`/`1390` nur fuer `angebot`/`BRIEF` (Meta). `angebot()` DE/EN nennt neu "CHF 2'180 bei Anreise ab Maerz" statt "auf Anfrage"; betroffene Tests mit Begruendung angepasst.
- **K4 Firmenlink** (statisch, kein Backend): Token = 16 Zufallsbytes base64url (22 Zeichen) im Fragment `#f=<token>`; Kennung `id` = SHA-256 der Token-Bytes, 32 Hex; Schluessel = HKDF-SHA-256(ikm Token-Bytes, salt `amanthos-affoltern-v1`, info `firmenlink`, 256 Bit); AES-GCM mit 12-Byte-IV ueber JSON `{firma, email}` (`email` leer bei Firmen ohne Rollenadresse, 38 von 48); `affoltern/firmen.json` = `{"v": 1, "eintraege": {id: base64url(iv || ciphertext)}}`, keine Firma im Klartext, Zielliste bleibt verborgen. Link = `https://www.amanthos.com/affoltern/?utm_source=firmenlink&utm_medium=email&utm_campaign=prize-29n-b2b#f=<token>`. Die Seite liest und entfernt das Fragment per Inline-Skript im `<head>` vor `consent.js` (`history.replaceState`), entschluesselt mit WebCrypto, fuellt `company` und `email` vor und sendet `firmenlink=id`; ohne passenden Eintrag bleibt das Formular leer, ohne Fehler. Name bleibt Pflicht (Backend und Anrede), Telefon frei. Generator `scripts/firmenlinks.mjs` (Node 22, WebCrypto, keine Abhaengigkeit) liest `firmenliste.csv` (Pfad als Argument), schreibt `affoltern/firmen.json` und `~/Projects/werbemittel/prize-29n-2026-11/firmenlinks.csv` (`nr,firma,link`, ausserhalb jedes Repos); jeder Lauf erzeugt neue Tokens und ersetzt alle Links.
- **K5 Seite** `affoltern/js/affoltern-config.js`: `API_BASE`, `CONTACT_PATH /api/contact`, `FORM_KIND affoltern`, `PAGE_URL_DE https://www.amanthos.com/affoltern/`, `PAGE_URL_EN .../affoltern/en/`, `GA4_ID G-1EW53WRTNR`, `ADS_ID AW-702540316`, `ADS_SEND_TO ''` (Frage 5), `CONTENT_NAME affoltern-29n`, `CAL_LINK https://cal.com/team/amanthos/affoltern-rueckruf`, `PHONE +41 43 217 86 87`, `EMAIL hotel@amanthos.com` (Entscheid Bogdan 26.10.), `NIGHTS_MAX 29`, `NIGHTS_89_ENABLED false`, `ROOMS_MAX 30`, `PRICES` wie K3 ohne `FIRMENPREISE`. Backend: `contact_affoltern.NAECHTE_89_AKTIV = False`, `AFFOLTERN_RECIPIENTS` (Vorgabe `hotel@amanthos.com, sales@amanthosliving.com`, damit der jarvis-Scan die Mail sieht), `AFFOLTERN_SMS_TO` (leer heisst keine SMS). Betreff `Anfrage Affoltern: <n> Zimmer, Anreise <datum>, <naechte>`; Fusszeile `Gesendet ueber das Formular auf www.amanthos.com/affoltern/ ... Referenz <event_id>`; Zeile `Firmenlink <id[:8]>` nur bei Firmenlink.

```bauplan-kriterien segment=0
- [ ] test_hotel_briefe: berechnen() liefert 1'590/1'880/1'890/2'180 und ab 5 Zimmern 1'390/1'690 je Saison, Gesamtbetrag = Zimmer mal Zimmerpreis, None ohne Datum oder Zimmer; Grenzfaelle 28.02., 01.03., 31.10., 01.11.
- [ ] Rot zuerst: offerte(firmen) traegt 1'390 und sperrwort_treffer(text, betraege=False) == []; angebot()/BRIEF tragen nie 1'390 (bestehender Guard bleibt rot bei Sabotage); Woerter-Guard rot mit leerer Liste, Testname und Zahl im Beweis
- [ ] angebot() DE/EN nennt CHF 2'180 fuer zwei Personen ab Maerz; test_zweierpreis_nie_ohne_die_februar_bedingung und test_preise_sind_die_entscheide mit Begruendung angepasst, Betragsmenge jedes Textes == PREISE.values()
- [ ] lead_kontrakt.WebAnfrage importiert ohne neue Abhaengigkeit (test_lead_kontrakt pinnt hashlib/os); pytest website-backend Exit 0, Zahl zitiert
```

## 3. Segmente (seriell, ein Kopf, beide vom Orchestrator; Sonnet nur fuer Textbausteine unter fixiertem Kontrakt)

### Segment 1: Backend Formularart affoltern (Repo platform, Branch `segment/prize-anfrageseite/1-backend`, PR A mit Segment 0, geschaetzt rund 330 Produktivzeilen ohne Tests)

- **Datei-Scope (exklusiv):**
  ```bauplan-scope segment=1
  website-backend/contact_affoltern.py
  website-backend/lead_fakten.py
  website-backend/lead_antwort_texte.py
  website-backend/tests/test_contact_affoltern.py
  website-backend/tests/test_lead_affoltern.py
  website-backend/tests/test_lead_fakten.py
  website-backend/tests/test_lead_antwort_texte.py
  ```
- **Auftrag:** `contact_affoltern.py` nach `contact_glattbrugg.py` (parse, subject, rows, footer, sms_text, source_url, CONTENT_NAME, SEITEN, Guards fuer Datum, Zimmer, Personen, Naechte, Firmenlink). `lead_fakten.fakten` rechnet fuer affoltern mit `hotel_briefe.berechnen(einzug, zimmer, personen)` und faellt auf `dict(PREISE)` zurueck; `lead_antwort_texte._affoltern` nimmt `hotel_briefe.offerte` sobald `fakten['zimmerpreis']` da ist, sonst `angebot` wie heute (Meta-Pfad unveraendert). Kein Eintrag in server.py (Sammelstelle).
- **Akzeptanzkriterien:**
  ```bauplan-kriterien segment=1
  - [ ] parse: Name und E-Mail hart, jedes Nebenfeld faellt bei Formatfehler auf leer; 30 bis 89 Naechte fallen bei NAECHTE_89_AKTIV=False weg (Rotbeweis: Test rot mit True); Anreise ausserhalb heute..+365 leer; firmenlink nur 32 Hex
  - [ ] subject traegt "Affoltern", footer "Formular auf www.amanthos.com/affoltern/" (jarvis-Slug), sms_text ohne Personendaten, rows ohne gclid/fbclid, Zeile Firmenlink nur gekuerzt
  - [ ] test_lead_affoltern: Web-Anfrage (quelle website, Datum, 2 Zimmer, 2 Personen) ergibt genau eine Mail mit Gesamtbetrag, Cal-Link einmal, Betreff hotel_briefe.BETREFF, Absender hotel@; 6 Zimmer ergibt Firmenpreis; Meta-Lead (einzug jan) ergibt den bisherigen Brief byte-gleich; mit LEAD_ANTWORT=an und LEAD_ANTWORT_AFFOLTERN ungesetzt null Mails
  - [ ] Sperrwort-Grep ueber jede erzeugte Offerte 0 Treffer (Woerter), kein Gedankenstrich, Schweizer ss; ruff, mypy website-backend, pytest Exit 0 mit Zahl
  ```
- **Out-of-Scope:** server.py, render.yaml, .env.example, DOKUMENTATION.md, Meta-Routen, Nachfass, Migrationen, Offerte-PDF, Zahlungslink.
- **Testplan:** `cd website-backend && pytest tests/test_contact_affoltern.py tests/test_lead_affoltern.py tests/test_hotel_briefe.py tests/test_lead_fakten.py tests/test_lead_antwort_texte.py -q`, dann volle Suite `pytest -q` vor dem Push; `ruff check website-backend`; `mypy website-backend` wie ci.yml L2.
- **Haengt ab von:** Segment 0.

### Segment 2: Seite, Formular, Firmenlink, Wortregel-Gate (Repo group-website, Branch `segment/prize-anfrageseite/2-seite`, Plankopie erster Commit; PR B1 Logik und PR B2 Seiten gestapelt, je unter 400 Produktivzeilen, oder ein PR B mit begruendeter Ausnahme "HTML-Text")

- **Datei-Scope (exklusiv):**
  ```bauplan-scope segment=2
  affoltern/*
  images/affoltern/*
  scripts/firmenlinks.mjs
  scripts/wortregel.sh
  tests/*
  .github/workflows/tests.yml
  docs/bauplan-prize-anfrageseite-2026-10-26.md
  ```
- **Auftrag:** `affoltern/index.html` (DE) und `affoltern/en/index.html` (EN) nach dem Muster `investment/bad-wiessee/index.html` (Kopf, consent.js synchron vor gtag, `js/meta.js` defer, Plausible, Fonts) und dem Living-Formular (DOM-Kontrakt mit ids `af-form`, `af-name`, `af-email`, `af-phone`, `af-company`, `af-arrival`, `af-rooms`, `af-persons`, `af-nights`, `af-company-website`, `af-submit`, `af-status`, `af-success`, `af-consent`): Preisleiter zuerst (1'590/1'890, zu zweit 1'880/2'180, Fruehstueck 12, Tiefgarage 20 je Tag, Anreisetag bestimmt den Preis, kuerzer auf Anfrage), drei bis vier Fotos aus `~/Projects/werbemittel/prize-29n-2026-11/bestand/hires` als `images/affoltern/*.webp` (1600 und 960 px), Fakten (Obstgartenstrasse 7, Bahnhof 4 Gehminuten, Zuerich HB 28 Min., Zug 16 Min., Zwischenreinigung alle 14 Tage, WLAN, Rezeption), Danke-Block mit Cal-Link, Telefon und hotel@, `noscript`, canonical, hreflang, Impressum und Datenschutz. `affoltern/affoltern.css` gemeinsam, `affoltern/js/affoltern-config.js` (K5), `affoltern/js/affoltern-page.js` (buildPayload mit 19 Schluesseln, readCampaign, newEventId, statusText, arrivalBounds, leadEvents nur nach 200 und mit Einwilligung: GA4 generate_lead, Ads conversion nur bei ADS_SEND_TO, fbq Lead mit eventID, Plausible; `entschluesseln(token, eintraege)` und Vorausfuellung; 30 bis 89 Naechte nur bei NIGHTS_89_ENABLED), `scripts/firmenlinks.mjs` (K4, exportiert `kennung`, `verschluesseln`), `scripts/wortregel.sh` (grep -i -w ueber `affoltern/**/*.html` und `affoltern/js/*.js`, Liste aus Kopf ohne Betraege, Exit 1 bei Treffer), `.github/workflows/tests.yml` (`pull_request` ohne Branchfilter und `push main`: `node --test tests/` und `scripts/wortregel.sh`). `firmen.json` entsteht durch einen Generatorlauf des Orchestrators gegen `firmenliste.csv` aus amanthos-creative PR #73.
- **Akzeptanzkriterien:**
  ```bauplan-kriterien segment=2
  - [ ] tests/affoltern-seiten.test.mjs: sichtbarer Text DE und EN ohne Sperrwort, ohne Radisson, ohne 1'390/1'690, ohne "jede Woche"/"woechentlich"/"weekly", ohne "89"; nennt 1'590, 1'890, 1'880, 2'180, 12, 20, "29", die vier Fakten und den Cal-Link; DOM-ids genau einmal; consent.js vor gtag; hreflang de/en und canonical korrekt
  - [ ] tests/affoltern-page.test.mjs: Payload genau die 19 Schluessel von K1 in dieser Reihenfolge, Nebenfeld-Guards wie K1, Naechte 30..89 fallen bei NIGHTS_89_ENABLED=false weg (Rotbeweis mit true), leadEvents ohne Einwilligung kein fbq und kein Ads-Aufruf, Firmenlink-Roundtrip Generator zu Seite mit WebCrypto, falscher Token ergibt null
  - [ ] tests/affoltern-firmenlinks.test.mjs: 48 Zeilen ergeben 48 Eintraege, Token 22 Zeichen base64url, kein Firmenname und keine Adresse im JSON-Klartext, Link traegt die drei UTM-Werte und #f=
  - [ ] scripts/wortregel.sh Exit 0 mit "0 Treffer" auf affoltern/, Exit 1 bei einem eingeschleusten Sperrwort (Rotbeweis); node --test tests/ Exit 0 mit Zahl; Lighthouse und axe fuer /affoltern/ erst nach dem Deploy (Verdrahtung)
  ```
- **Out-of-Scope:** index.html der Startseite (Link Affoltern bleibt radissonhotels bis Bogdan entscheidet, Frage 7), sitemap.xml, llms.txt, quality.yml, Broschuere, B2B-Mailtexte, Versand der Firmenlinks, Google-Ads-Conversion-Aktion, Meta-Formulare.
- **Testplan:** `node --test tests/` und `scripts/wortregel.sh` lokal (Node 22); Seite im Browser gegen `https://amanthos-website-api.onrender.com` erst in der Verdrahtung; Bildgroessen unter 300 KB je Datei (binaer, zaehlt nicht als Diff).
- **Haengt ab von:** Segment 0 (Kontrakt K1, K4, K5 stehen im Plan; kein Code aus platform noetig).

## 4. Sammelstellen (nur Verdrahtung fasst sie an; platform auf `feature/prize-anfrageseite-verdrahtung` als PR C, group-website gleichnamig als PR D)

```bauplan-scope sammelstellen
website-backend/server.py
website-backend/tests/test_affoltern_web_verdrahtung.py
render.yaml
.env.example
DOKUMENTATION.md
sitemap.xml
llms.txt
.github/workflows/quality.yml
index.html
```

`server.py`: `affoltern` in die Formular-Whitelist, Import `contact_affoltern`, Zweige wie `glattbrugg` (parse, Betreff, Zeilen, Fusszeile, Absendername `hotel_briefe.ANZEIGENAME`, Empfaenger `AFFOLTERN_RECIPIENTS`, Trichterblock `mail_block_html(objekt=form)`), danach zwei Threads: CAPI `send_lead(site='')` nur bei `consent=granted`; `upsert_lead(event_id, 'website', wohnung=rooms, einzug=arrival, kampagne=utm_campaign, objekt='affoltern')`, `sms_alert(AFFOLTERN_SMS_TO)`, dann `lead_antwort.senden(WebAnfrage, email, name, personen=...)`, Fehler nur als Klassenname im Log. `test_affoltern_web_verdrahtung.py`: echter Code auf echten Code wie `test_glattbrugg_verdrahtung.py` (`server.Handler._handle_contact` mit `form=affoltern`, SMTP- und urlopen-Recorder, Socket gesperrt): interne Mail an beide Empfaenger, POST grenchen_leads objekt affoltern, mit `LEAD_ANTWORT_AFFOLTERN=an` genau eine Mail an den Interessenten mit Gesamtbetrag (2 Zimmer) und Firmenpreis (6 Zimmer), ohne den Schalter null, Sabotage: ohne Trichterzeile Marke `schon`. `render.yaml`: `AFFOLTERN_RECIPIENTS` und `AFFOLTERN_SMS_TO` mit `sync: false` bei `amanthos-website-api`, Kommentar, dass die Affoltern-Schluessel dort dieselben Werte wie beim Cron brauchen. `.env.example`: die zwei Zeilen neben `LEAD_KOPIE_AFFOLTERN`. `DOKUMENTATION.md`: Abschnitt "Anfragen Affoltern (Formularart `affoltern`)" neben Glattbrugg. `sitemap.xml`: `/affoltern/` und `/affoltern/en/`. `llms.txt`: eine Zeile. `quality.yml`: beide URLs in die axe-Liste. `index.html`: unberuehrt, bis Bogdan den Link freigibt (Frage 7).

## 5. Verdrahtung (ein Kopf, sequenziell; jeder Schritt mit Aussenwirkung nur mit Freigabe Bogdan, zitiert mit Befehl und Zahl)

1. **Reihenfolge:** PR A (Segment 0 und 1) mergen, aendert ohne server.py nichts; PR C (platform-Sammelstellen) mergen, Render-Deploy abwarten, `GET /api/health` und `curl -X POST .../api/contact` mit `form=affoltern`, `name Testperson`, `email development@amanthos.com` liefert 200 (Rezeption vorab informiert); dann Env auf `amanthos-website-api` durch Bogdan oder mit seiner Freigabe: `HOTEL_SENDER_EMAIL`, `HOTEL_REPLY_TO`, `LEAD_KOPIE_AFFOLTERN`, `LEAD_ANTWORT_AFFOLTERN=probe`, `LEAD_ANTWORT_PROBE_TO` (steht), Voraussetzung "Senden als hotel@" (Frage 6); dann Generatorlauf, PR B1, PR B2 (gestapelt, Rebase vor jedem Merge), PR D; Pages-Deploy, `curl -sL -o /dev/null -w '%{http_code}' https://www.amanthos.com/affoltern/` = 200, Lighthouse und axe fuer beide URLs zitiert.
2. **Kombinationslauf:** Verdrahtungs-Worktree je Repo von `origin/main`, Segment-Branch rebasen (Konflikt heisst Schnitt falsch, anhalten), volle Suite als Hintergrund-Bash mit Ausgabe nach `$CLAUDE_JOB_DIR/tmp/gate-<nr>.txt`: platform `pytest -q` (Exit und Zahl), group-website `node --test tests/` und `scripts/wortregel.sh` (Exit und "0 Treffer").
3. **Testlead durch die ganze Kette (DoD):** Seite im Browser mit Einwilligung, Name `Testperson`, `development@amanthos.com`, 2 Zimmer, 2 Personen, Anreise in 10 Tagen; Nachweise zitiert: Render-Log `Contact form: affoltern delivered` mit Referenz, interne Mail in hotel@ und sales@ mit Betreff `Anfrage Affoltern: 2 Zimmer ...`, Zeile `grenchen_leads objekt=affoltern quelle=website`, Probe-Mail an `LEAD_ANTWORT_PROBE_TO` mit CHF 3'760 bzw. 4'360 je Saison und Cal-Link, `grep -i` der Sperrwortliste ueber die Probe-Mail 0 Treffer, Meta Events Manager zeigt Lead mit derselben `event_id` aus Browser und Server, `sales_leads objekt=affoltern` zeigt den Lead als Test (Lokalteil development); zweiter Testlead ueber einen Firmenlink mit 6 Zimmern (Probe-Mail nennt 1'390 bzw. 1'690, Zeile Firmenlink, Kampagne `firmenlink / email / prize-29n-b2b`). Danach Testzeilen aus `grenchen_leads` loeschen (SQL, Freigabe Bogdan, Frage 8). `LEAD_ANTWORT_AFFOLTERN=an` legt nur Bogdan um.
4. **Gates:** platform `plan-abgleich`, `Summary`, `review / L4` gruen; group-website `plan-abgleich` gruen und `tests.yml` gruen (als Required Check eintragen: Verdrahtungsschritt mit `gh api`, Freigabe Bogdan); Secret-Scan und PII-Grep (`development@`, `example.invalid` erlaubt, sonst keine Adresse) je PR zitiert.
5. **Merge-Form:** FL-3, Handmerge je PR nach Einzelfreigabe Bogdan (`gh pr merge <n> --rebase`), nie `--auto`; vor jedem Merge `git fetch origin main` und Rebase-Bedarf nach Merge-Regel Punkt 2; ein Smoke je Merge-Welle. **Stufe 2, nur Vormerkung (eigener Plan, FL-3 Payments und Apaleo-Writes):** `hotel_briefe.offerte_pdf(anfrage, fakten) -> bytes` nach `contract_pdf.py`, `zahlungslink(lead_id, gesamt)` ueber den bestehenden Zahlungsweg, Felder `angebot_nr`, `gesamt`, `zahlung_status` an der Trichterzeile; K1 bis K3 bleiben dafuer unveraendert.

## Offene Fragen (Bogdan)

Freigabe Plan und status aktiv: Bogdan 26.10.2026 per AskUserQuestion.

1. ~~Firmenpreis zu zweit~~ entschieden 26.10.: plus 290 je Zimmer (1'680 / 1'980).
2. ~~Personen je Zimmer~~ entschieden 26.10.: Frage bleibt, Vorgabe 1.
3. ~~hotel@ oder booking@~~ entschieden 26.10.: hotel@amanthos.com auf Seite und im Brief.
4. Nach dem Umlegen des 89-Schalters fehlt ein Preis je Nacht fuer 30 bis 89 Naechte; der Brief sagt dann "Preis persoenlich". Blockiert nichts, Schalter bleibt aus.
5. Google-Ads-Conversion-Aktion fuer /affoltern/ anlegen (bis dahin `ADS_SEND_TO` leer, keine Ads-Zaehlung)? Blockiert nichts.
6. "Senden als hotel@amanthos.com" im Postfach von `SMTP_USER` eingerichtet (Prize-Plan Frage 5)? Blockiert Verdrahtung Schritt 1 (Probe), nicht den Bau.
7. Startseiten-Link Affoltern auf `/affoltern/` statt radissonhotels.com (ILA)? Blockiert nichts, `index.html` bleibt unberuehrt bis zum Ja.
8. Testzeilen in `grenchen_leads` nach dem Testlead loeschen (SQL im Prod-Projekt)? Blockiert Verdrahtung Schritt 3 Abschluss, nicht den Bau.

## Nachtrag 1 (30.10.2026): 29 bis 89 Naechte

Grundlage: Mail Stadt Affoltern am Albis 29.10.2026 (Hotelnutzung bis 89 Naechte ohne Wohnsitz), amanthos-tax PR #604,
Kampagne seit 29.10. live auf 29 bis 89 (amanthos-creative PR #74, UMSTELLUNG-89.md). Entscheide Bogdan 30.10.2026
(AskUserQuestion): umstellen mit Staffel; Naechte als freie Zahl 29 bis 89, "kuerzer" bleibt mit Preis auf Anfrage;
im Fenster mit hoechstens 88 Naechten gilt 10 % auch fuer 88; Seite nennt Bettwaeschewechsel woechentlich und
Zwischenreinigung alle 14 Tage. Firmenlink-Tokens unveraendert. Branches `feature/affoltern-89-naechte` je Repo, ein PR
je Repo, FL-3, Handmerge nach Freigabe; Backend zuerst.

**K3 v2 (hotel_briefe):** `MIN_NAECHTE 29`, `MAX_NAECHTE 89`, `STAFFEL ((89, 0.10), (59, 0.05))`, `PFLICHTZUSATZ`
de/en ("Hoechstens 89 Naechte je Gast in 12 Monaten. Keine Wohnsitznahme, keine Anmeldung beim Einwohneramt."; einzige
erlaubte Stelle fuer den Stamm "wohn" in einem Brief). `max_naechte(anreise_iso)`: Tage bis zum gleichen Kalendertag
drei Monate spaeter (Tag geklemmt) minus 1, hoechstens 89. `rabatt(naechte, anreise_iso)`: 0.10 ab 89 oder bei 88 =
max_naechte, 0.05 ab 59, sonst 0. `berechnen(anreise, zimmer, personen=1, naechte=29)`: naechte ganzzahlig
29..max_naechte, sonst None; `zimmerpreis = round5(basis * naechte / 29 * (1 - rabatt))`, basis wie bisher (Saison,
zu zweit +290, Firmenpreis ab 5 Zimmern); `gesamt = round5(zimmer * zimmerpreis)`; neu im Ergebnis `rabatt_prozent`.
`chf()` ohne Dezimalen bei ganzen Betraegen, sonst zwei. `offerte` nennt Naechte, Preis, Staffel-Satz (wenn < 89),
Pflichtzusatz statt "Anmeldung bei der Gemeinde". `angebot`/`BETREFF` (Meta): "29 bis 89 Naechte", Preis fuer 29,
Staffel-Satz, Pflichtzusatz; keine neue Feldzuordnung fuer das neue Meta-Formular (Naechte-Frage), bewusst.
Pinnwerte: 89 Naechte Winter 1 Person CHF 4'391.70 (Preisblatt UMSTELLUNG-89.md Punkt 3).

**K1 v2 (contact_affoltern):** `NAECHTE_89_AKTIV` entfaellt; `nights` = `kuerzer` oder 29..89, ueber
`max_naechte(arrival)` wird auf das Maximum geklemmt (Lead geht nie verloren); Fusszeile "29 bis 89 Naechte".

**K5 v2 (Seite):** `NIGHTS_MIN 29`, `NIGHTS_MAX 89`, Zahlenfeld `af-nights` (min/max je Anreise, Vorgabe 29) plus
Kasten `af-nights-shorter` ("Kuerzer als 29 Naechte, Preis auf Anfrage" -> `kuerzer`); Texte "29 bis 89 Naechte",
Staffel-Satz, Beispiel 89 Naechte mit den Pinnwerten, Pflichtzusatz, Reinigungszeile; Wortregel sperrt statt
"woechentlich"/"weekly"/"jede Woche" nur noch "Reinigung jede Woche", "woechentliche Reinigung", "weekly cleaning",
"cleaning every week"; "Wohnsitz" bleibt als ganzes Wort gesperrt (Wohnsitznahme erlaubt, nur im Pflichtzusatz).

```bauplan-scope segment=3
website-backend/hotel_briefe.py
website-backend/contact_affoltern.py
website-backend/lead_fakten.py
website-backend/tests/test_hotel_briefe.py
website-backend/tests/test_contact_affoltern.py
website-backend/tests/test_lead_affoltern.py
website-backend/tests/test_affoltern_web_verdrahtung.py
affoltern/*
scripts/wortregel.sh
tests/*
docs/bauplan-prize-anfrageseite-2026-10-26.md
```

```bauplan-kriterien segment=3
- [ ] Rot zuerst: berechnen mit naechte 45/59/88/89 und max_naechte fuer 31.01., 01.02., 28.02., 01.03.2027, 01.11.2026; 89 Winter = 4'391.70
- [ ] Meta-Brief und Offerte: 0 Sperrwoerter (Woerter; Stamm "wohn" nur im Pflichtzusatz), 29 bis 89, Pflichtzusatz genau einmal
- [ ] parse: 45 kommt durch, 90 faellt, 89 bei Anreise 15.02. wird 88; Verdrahtungstest mit 59 Naechten nennt den Staffelpreis
- [ ] Seite DE/EN: node --test gruen, wortregel 0 Treffer, Pflichtzusatz einmal, Zahlenfeld 29..89, Firmenlink fuellt weiter vor
```
