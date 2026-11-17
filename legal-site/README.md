# Rechtstexte-Webseite

Statische Seiten für Datenschutzerklärung, Impressum und Konto-Löschung. Keine externen Schriften, Skripte oder Cookies. `_headers` setzt Sicherheits-Header für Cloudflare Pages.

| Seite | Verwendet für |
| --- | --- |
| `datenschutz.html` | App Store Connect, Google Play, `EXPO_PUBLIC_PRIVACY_URL` |
| `impressum.html` | `EXPO_PUBLIC_IMPRINT_URL` |
| `konto-loeschen.html` | Google Play (Konto-Löschung ohne App) |
| `index.html` | Übersicht, als Support-URL bei Apple nutzbar |

Gelb markierte `[Platzhalter]` vor der Veröffentlichung ersetzen. `npm run check:legal` schlägt fehl, solange noch welche drin sind.

## Veröffentlichen mit Cloudflare Pages (kostenlos)

1. Auf [dash.cloudflare.com](https://dash.cloudflare.com) ein kostenloses Konto anlegen.
2. **Workers & Pages → Erstellen → Pages → Mit Git verbinden**, GitHub verbinden und das Repo `Schafkopfrechner-App` wählen.
3. Einstellungen:
   - Projektname: `schafkopfrechner` (ergibt `https://schafkopfrechner.pages.dev`)
   - Produktionszweig: `main`
   - Framework: keines
   - Build-Befehl: `node scripts/check-legal-site.cjs`
   - Ausgabeverzeichnis: `legal-site`
   - Umgebungsvariable: `SKIP_DEPENDENCY_INSTALL` = `true` (spart die Installation der App-Abhängigkeiten)
4. **Speichern und bereitstellen.** Der Build schlägt absichtlich fehl, solange Platzhalter offen sind; so geht keine unfertige Seite online.
5. Danach eintragen:
   - `EXPO_PUBLIC_PRIVACY_URL=https://schafkopfrechner.pages.dev/datenschutz.html`
   - `EXPO_PUBLIC_IMPRINT_URL=https://schafkopfrechner.pages.dev/impressum.html`

Jeder Push auf `main` veröffentlicht Änderungen automatisch. Eine eigene Domain lässt sich später unter **Benutzerdefinierte Domains** ergänzen; dann die URLs oben anpassen.
