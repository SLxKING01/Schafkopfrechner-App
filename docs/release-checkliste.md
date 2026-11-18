# Release-Checkliste

Stand: 18.11.2026. Code-Änderungen liegen in PR #45 (`claude/admiring-einstein-pdijow`).

## Rechtstexte
- [x] Entwürfe für Datenschutzerklärung, Impressum und Konto-Löschung in `legal-site/`
- [x] Name, Anschrift, Aufsichtsbehörde, Altersangabe eingetragen
- [x] Cloudflare-Konto angelegt und Worker `schafkopfrechner-app` mit dem GitHub-Repo verbunden (17.11.2026)
- [x] `wrangler.jsonc` liefert `legal-site/` aus (lokal mit `wrangler dev` geprüft)
- [ ] Kontakt-E-Mail eintragen (4 Platzhalter); bis dahin schlägt der Cloudflare-Build absichtlich fehl
- [ ] Build-Einstellungen im Dashboard prüfen: Build `node scripts/check-legal-site.cjs`, Deploy `npx wrangler deploy`
- [ ] Erfolgreichen Build abwarten, `workers.dev`-Adresse notieren und Seiten aufrufen
- [ ] Nach dem Merge von #45 den Build-Zweig auf `main` umstellen

## Supabase
- [x] Migrationen live: Konto löschen, Zahlungen, PayPal.Me, Meldungen
- [ ] Pro-Plan (Free pausiert nach 7 Tagen ohne Nutzung)
- [ ] Auftragsverarbeitungsvertrag (DPA) abschließen
- [ ] Leaked Password Protection einschalten
- [ ] Eigenen SMTP-Anbieter eintragen
- [ ] Redirect-URL `schafkopfrechner://passwort-zuruecksetzen` prüfen
- [ ] Zuständigkeit für Meldungen festlegen (Bearbeitung binnen 24 h), optional Webhook

## Expo / EAS
- [ ] Umgebungsvariablen für `production`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_IMPRINT_URL`
- [ ] Ersten Android-Build mit neuem Signierschlüssel erzeugen

## Stores
- [x] Store-Texte und Screenshots (`store-screenshots/`, Store-Dokument)
- [ ] Apple Developer Program und Google Play Console
- [ ] Store-Einträge, Datenschutz-Angaben, Altersfreigabe (Google-Zielgruppe 13+)
- [ ] Test-Konto und Prüfnotizen für Apple
- [ ] TestFlight; Google: geschlossener Test mit 12 Testern über 14 Tage

## Test und Merge
- [ ] Production-Build auf Geräten: Konto löschen mit Foto, Melden, Zahlungen/PayPal.Me, Passwort-Reset, Widget, Icon und Splash
- [ ] PR #45 mergen
