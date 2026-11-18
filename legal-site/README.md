# Rechtstexte-Webseite

Statische Seiten für Datenschutzerklärung, Impressum und Konto-Löschung. Keine externen Schriften, Skripte oder Cookies. `_headers` setzt Sicherheits-Header für Cloudflare Pages.

| Seite | Verwendet für |
| --- | --- |
| `datenschutz.html` | App Store Connect, Google Play, `EXPO_PUBLIC_PRIVACY_URL` |
| `impressum.html` | `EXPO_PUBLIC_IMPRINT_URL` |
| `konto-loeschen.html` | Google Play (Konto-Löschung ohne App) |
| `index.html` | Übersicht, als Support-URL bei Apple nutzbar |

Gelb markierte `[Platzhalter]` vor der Veröffentlichung ersetzen. `npm run check:legal` schlägt fehl, solange noch welche drin sind.

## Veröffentlichen mit Cloudflare Workers (kostenlos)

`wrangler.jsonc` im Repo-Stamm beschreibt einen Worker `schafkopfrechner-app`, der nur den Ordner `legal-site/` ausliefert. `.assetsignore` hält diese README aus der Veröffentlichung heraus, `404.html` ist die Fehlerseite.

Einstellungen im Cloudflare-Dashboard unter **Workers & Pages → schafkopfrechner-app → Einstellungen → Build**:

- Build-Befehl: `node scripts/check-legal-site.cjs`
- Bereitstellungsbefehl: `npx wrangler deploy`
- Zweig: `main` (bis zum Merge von #45: `claude/admiring-einstein-pdijow`)

Der Build schlägt absichtlich fehl, solange Platzhalter offen sind.

Die Seiten sind danach unter kurzen Adressen erreichbar; `.html`-Adressen leiten dorthin weiter:

- `EXPO_PUBLIC_PRIVACY_URL=https://schafkopfrechner-app.<konto>.workers.dev/datenschutz`
- `EXPO_PUBLIC_IMPRINT_URL=https://schafkopfrechner-app.<konto>.workers.dev/impressum`
- Konto löschen (Google Play): `…/konto-loeschen`

Die genaue `workers.dev`-Adresse zeigt das Dashboard. Eine eigene Domain lässt sich unter **Domains & Routes** ergänzen.

Lokal testen: `npx wrangler dev`, dann http://localhost:8787 öffnen.
