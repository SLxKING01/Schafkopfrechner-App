# Rechtstexte-Webseite

Statische Seiten für Datenschutzerklärung, Impressum und Konto-Löschung. Keine externen Schriften, Skripte oder Cookies.

- `index.html` – Übersicht
- `datenschutz.html` – Datenschutzerklärung (URL für App Store Connect, Google Play und `EXPO_PUBLIC_PRIVACY_URL`)
- `impressum.html` – Impressum (`EXPO_PUBLIC_IMPRINT_URL`)
- `konto-loeschen.html` – Löschanleitung, auch ohne App (Google Play verlangt diese URL)

Gelb markierte `[Platzhalter]` vor der Veröffentlichung ersetzen. `npm run check:legal` schlägt fehl, solange noch welche drin sind.

Veröffentlichen: den Ordner `legal-site/` als statische Seite hosten, z. B. bei Cloudflare Pages oder Netlify (Build-Befehl leer, Ausgabeordner `legal-site`).
