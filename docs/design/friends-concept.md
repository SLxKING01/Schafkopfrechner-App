# Konzept: Freunde und Kontaktanfragen (#26)

Stand: 03.11.2026 · Implementiert; technische Details und Prüfung siehe [Umsetzungsbericht](friends-implementation.md).

Grundlage: [Issue #26](https://github.com/SLxKING01/Schafkopfrechner-App/issues/26) und die Profilgrundlage aus #25. Der Nutzer hat das vorgeschlagene Freundschaftsmodell bestätigt und ausdrücklich gewünscht, Blockieren in das Konzept aufzunehmen. Die folgenden Details konkretisieren dieses Modell; technische Namen und Ausführungsdetails sind Vorschläge für die Umsetzung.

## Ziel und Umfang

Nutzer finden andere Accounts eindeutig, senden und verwalten Freundschaftsanfragen und sehen angenommene Freunde in einer eigenen Liste. Blockieren gehört zum ersten Umfang. Ein gefundenes oder bereits am Tisch zugeordnetes Konto ist nicht automatisch ein Freund.

Freundschaft entsteht ausschließlich nach ausdrücklicher Annahme. Alle Beziehungen verwenden stabile Account-IDs; Anzeigenamen, Fotos und Freundescodes vergeben weder Identität noch Tischrechte.

Enthalten: Freundescode, exakte Suche, Identitätsvorschau, eingehende und ausgehende Anfragen, Annahme/Ablehnung, Zurückziehen, Freundesliste, Entfernen, Blockieren und Entblockieren. Push- und E-Mail-Benachrichtigungen sind nicht Voraussetzung und werden hier nicht ergänzt.

## Andere finden

- Jeder Account erhält einen persönlichen, zufällig erzeugten Freundescode mit Kopierfunktion. Der Code ist vom frei gewählten Anzeigenamen unabhängig.
- Vorschlag zur Darstellung: zwölf gut unterscheidbare Großbuchstaben/Ziffern, in drei Gruppen lesbar. Groß-/Kleinschreibung, Trennzeichen und Leerzeichen werden bei der Eingabe normalisiert. Die konkrete Alphabetwahl und Länge sind Implementierungsdetails; Eindeutigkeit wird serverseitig abgesichert.
- Die Suche arbeitet mit dem vollständigen Code. Es gibt keine Präfixsuche oder öffentliche Liste aller Freundescodes.
- Ein gültiger, kontaktierbarer Treffer zeigt Anzeigename und Profilbild, bevor eine Anfrage gesendet wird. Gleichnamige Accounts bleiben unterscheidbar; der Nutzer soll die Vorschau vor dem Senden prüfen.
- Vorname, Nachname, Geburtsdatum und E-Mail sind kein Bestandteil von Suche, Treffervorschau oder Freundesliste.
- Der eigene Code kann nicht zur Selbstanfrage verwendet werden. Bei vorhandener Freundschaft oder Anfrage wird der bestehende Zustand angezeigt.
- Ein Code ist ein Kontaktmerkmal, kein Passwort. Die Annahme durch den Empfänger bleibt erforderlich. Such- und Anfrageversuche werden serverseitig begrenzt; Wiederholungen nach Fehlern erzeugen keine doppelten Beziehungen.
- Codewechsel ist für die erste Version nicht erforderlich. Eine spätere Erneuerung darf bestehende Freundschaften oder Blockierungen nicht umgehen, da diese an Account-IDs hängen.

## Freundschaftsmodell

Für ein Accountpaar gibt es höchstens eine aktive Anfrage beziehungsweise eine angenommene Freundschaft. Eine offene Anfrage merkt sich ihre Richtung. Eine Freundschaft ist gegenseitig; Blockierungen sind davon getrennte, gerichtete Einstellungen.

| Ausgangslage | Aktion | Ergebnis |
| --- | --- | --- |
| Keine Verbindung | Anfrage senden | Beim Sender ausgehend, beim Empfänger eingehend |
| Eingehende Anfrage | Annehmen | Eine gegenseitige Freundschaft, keine weitere offene Anfrage |
| Eingehende Anfrage | Ablehnen | Anfrage erledigt, keine Freundschaft |
| Eigene ausgehende Anfrage | Zurückziehen | Anfrage erledigt, keine Freundschaft |
| Bereits eigene Anfrage offen | Erneut senden oder Netzwerk-Retry | Bestehende Anfrage verwenden, keine zweite erzeugen |
| Gegenanfrage offen | Freund hinzufügen | Gegenanfrage zur ausdrücklichen Annahme anbieten; keine automatische Annahme durch einen gewöhnlichen Sendeversuch |
| Freundschaft vorhanden | Freund entfernen | Freundschaft endet für beide Seiten |

Entfernen erfordert eine kurze Bestätigung mit Anzeigename. Danach ist grundsätzlich eine neue Anfrage möglich. Eine erfolgreiche Entfernung stellt keine Tischrechte um und verändert keine bisherigen Spiele oder Abrechnungen.

## Blockieren ist Bestandteil von #26

**Freund entfernen** beendet die bestehende Beziehung. **Blockieren** verhindert zusätzlich weitere Kontaktanfragen zwischen den beiden Accounts, solange mindestens eine Blockierung aktiv ist.

### Wirkung

- A kann B blockieren, auch wenn keine Freundschaft besteht. Die Aktion ist bei einem gefundenen Kontakt, einer Anfrage und einem vorhandenen Freund erreichbar.
- Eine Blockierung wird serverseitig gespeichert. Gerätewechsel, Neuinstallation, Namenswechsel und ein späterer Codewechsel heben sie nicht auf.
- Bestehende Freundschaft und offene Freundschaftsanfragen in beiden Richtungen werden beim Blockieren atomar beendet. Nach einem Fehler darf die Oberfläche weder erfolgreiches Blockieren behaupten noch eine nur teilweise entfernte Verbindung zeigen.
- Solange A B oder B A blockiert, kann in keiner Richtung eine neue Freundschaftsanfrage gesendet oder eine alte Anfrage angenommen werden. Das gilt auch für offene Bildschirme und direkte API-Aufrufe.
- Die Freundescodesuche bietet für eine gesperrte Paarung keinen kontaktierbaren Treffer. Der Code allein kann die Blockierung nicht umgehen.
- Der blockierte Account erhält keine besondere Benachrichtigung über die Blockierung. Fehlermeldungen nennen keinen privaten Blockierungsgrund. Dass eine bisherige Freundschaft nicht mehr besteht, kann trotzdem sichtbar werden; unsichtbare Blockierung wird nicht versprochen.
- Die blockierende Person sieht ihre eigene Liste blockierter Accounts. Es gibt keine Anzeige „Diese Personen haben dich blockiert“.

### Entblockieren

- A kann ausschließlich die eigene Blockierung von B aufheben. Hat B ebenfalls A blockiert, bleibt diese zweite Blockierung wirksam.
- Entblockieren stellt weder eine alte Freundschaft noch frühere Anfragen automatisch wieder her. Falls keine Blockierung mehr besteht, kann eine neue Anfrage gesendet werden.
- Die Oberfläche bestätigt vor dem Entblockieren: „Danach sind neue Freundschaftsanfragen wieder möglich. Ihr werdet nicht automatisch Freunde.“

### Bestätigung und Bedienung

Vor dem Blockieren zeigt die App den betreffenden Anzeigenamen und die Folgen:

> „Kontakt blockieren? Eine bestehende Freundschaft und offene Freundschaftsanfragen werden entfernt. Neue Kontaktanfragen sind danach in beide Richtungen gesperrt. Gemeinsame Tische und bestehende Tischrechte bleiben erhalten.“

Aktionen: **Abbrechen** und **Blockieren**. Blockieren wird erst nach Serverbestätigung als erfolgreich angezeigt. Währenddessen sind Mehrfachtipps gesperrt. Fehler lassen sich erneut versuchen.

## Freundschaft, Blockierung und Tische

| Aktion | Freundschaft/Anfragen | Bereits gewährte Tischrechte |
| --- | --- | --- |
| Freundschaft annehmen | Freundschaft entsteht | Keine automatische Berechtigung |
| Freund entfernen | Freundschaft endet | Bleiben bestehen |
| Kontakt blockieren | Freundschaft und offene Anfragen enden; neue Anfragen gesperrt | Bleiben bestehen |
| Kontakt entblockieren | Neue Anfrage wieder möglich, falls keine Gegenblockierung besteht | Unverändert |

Einladungen zum Tisch folgen in #27. Dort wird vor Senden und Annehmen zusätzlich geprüft, ob zwischen Einladendem und Empfänger eine Blockierung besteht. Eine zwischenzeitliche Blockierung muss auch eine bereits offene Einladung unwirksam für die Annahme machen. Bereits angenommene Tischmitgliedschaften werden dadurch nicht rückwirkend entfernt.

Tischzugriff entziehen, einen Tisch verlassen und persönliche Abrechnung erhalten bleiben Gegenstand von #24. Blockieren ist kein Ersatz für diesen Ablauf. Gemeinsame historische Spiele und erforderliche Teilnehmerinformationen verschwinden nicht aus Tisch oder Abrechnung.

Die bisherige direkte Kontozuordnung am Tisch ist technisch von Freundschaftsanfragen getrennt. #26 darf vorhandene Zuordnungen nicht still entfernen oder die bereits abgestimmten Erstellerrechte ändern. Bei #27 sind die bisherigen Einstiegspunkte ausdrücklich mit dem zustimmungsbasierten Einladungsablauf abzugleichen; eine bloße Prüfung im neuen Freundesdialog reicht dafür nicht.

## Oberfläche

Eine eigene Ansicht **Freunde** ist über das Profil erreichbar. Ein zusätzlicher Haupttab ist nicht erforderlich.

Die Ansicht enthält:

1. **Freunde:** angenommene Kontakte mit Anzeigename, Bild und Kontaktmenü für Entfernen/Blockieren.
2. **Anfragen:** eingehende und ausgehende Anfragen klar getrennt. Eingehend: Annehmen, Ablehnen, Blockieren. Ausgehend: Zurückziehen und Kontaktmenü.
3. **Freund hinzufügen:** vollständigen Code eingeben, Treffer prüfen und Anfrage senden beziehungsweise bestehende Gegenanfrage öffnen.
4. **Mein Freundescode:** eigener Code mit Kopierfunktion.
5. **Blockierte Kontakte:** separat erreichbar, nur eigene Blockierungen mit Entblockieren-Aktion.

Die Suche wird erst nach abgeschlossener Anfrage als „kein Treffer“ dargestellt. Beim Laden erscheint ein Ladezustand. Ein fehlgeschlagener Abruf erhält vorhandene Listen und zeigt eine verständliche Wiederholungsmöglichkeit.

Für leere Listen gibt es konkrete Hinweise, etwa „Noch keine Freunde – füge jemanden über seinen Freundescode hinzu“. Entfernte oder zwischenzeitlich angenommene Anfragen werden nach Aktualisierung verständlich aufgelöst, statt funktionslose Buttons stehenzulassen.

## Speicherung und Parallelität

Vorgeschlagene Datenbereiche:

| Bereich | Inhalt und Zugriff |
| --- | --- |
| Freundescodes | Eindeutige Zuordnung zum Account; eigener Code und kontrollierte exakte Suche |
| Freundschaftsanfragen | Accountpaar, Sender, Zustand und Änderungsstand; nur betroffene Accounts |
| Freundschaften | Ein eindeutiges Accountpaar; nur die beteiligten Accounts |
| Blockierungen | Blockierender und blockierter Account; Liste nur für den jeweiligen Blockierenden |

Die Datenbank prüft Beteiligung und erlaubten Zustandswechsel. Ein zufällig bekannter Datensatzbezeichner berechtigt nicht zum Annehmen, Löschen oder Entblockieren. Private Profilangaben werden für diese Funktion nicht kopiert oder freigegeben.

Alle Änderungen an einem Accountpaar müssen denselben serverseitigen Konkurrenzschutz verwenden. Das betrifft insbesondere:

- gleichzeitiges Senden in beide Richtungen;
- Annehmen gegen Zurückziehen oder Ablehnen;
- Blockieren gegen Senden oder Annehmen;
- Entfernen gegen wiederholte Annahme;
- gleichzeitige eigene und fremde Blockierung beziehungsweise deren Aufhebung.

Eine aktive Blockierung muss nach einer solchen Konkurrenzsituation neue Freundschaft und offene Anfrage ausschließen. Bei Aufhebung nur einer von zwei Blockierungen bleibt der Kontakt gesperrt. Wiederholte Speicheraufträge werden idempotent behandelt.

Bestätigte Zustände werden beim Öffnen und bei Rückkehr in die App aktualisiert. Noch unbestätigte Aktionen bleiben als laufend erkennbar; bei Fehlern wird kein Erfolg vorgetäuscht. Offline können vorhandene Listen angezeigt und Codes eingegeben werden, neue Beziehungen oder Blockierungsänderungen werden erst nach Serverbestätigung wirksam. Eingaben bleiben bei einem Fehler für einen erneuten Versuch erhalten. Cache und verspätete Antworten werden strikt nach Account getrennt.

## Abnahme

- Vollständiger und falsch formatierter Code, nicht vorhandener Code, eigener Code, gleichnamige Accounts und Treffer ohne Profilbild.
- Anfrage senden, annehmen, ablehnen, zurückziehen sowie doppelte und gegensätzliche Anfragen.
- Freund entfernen und anschließend erneut anfragen; Entfernen verändert keine Tischmitgliedschaft.
- Aus Treffer, Anfrage und Freundschaft blockieren. Bestehende Beziehung und Anfragen enden gemeinsam; kein neuer Kontakt in irgendeiner Richtung.
- Blockieren parallel zu Annahme/Senden sowie veraltete offene Dialoge und direkte API-Aufrufe.
- Eigene Blockierung aufheben; andere Blockierung nicht aufhebbar; gegenseitige Blockierung bleibt nach einseitigem Entblockieren wirksam.
- Entblockieren stellt frühere Freundschaften und Anfragen nicht wieder her.
- Eigene Blockierliste bleibt privat. Keine privaten Profilfelder, fremden Anfragen oder fremden Freundeslisten über Suche oder direkte API abrufbar.
- Neustart, zweites Gerät, Offlinefehler, Retry, Doppeltipps und Kontowechsel während einer Anfrage.
- iPhone und Web: Tastatur, große Schrift, lange Namen, leere Listen, Lade- und Fehlerzustände.
- Als Anschlussabnahme für #27: Blockierungen vor Senden/Annehmen einer Tischeinladung prüfen; bestehende Tischrechte und historische Abrechnung unverändert lassen.

## Anschluss

Nach #26 folgt [#27 – Tischeinladungen](https://github.com/SLxKING01/Schafkopfrechner-App/issues/27). Die Rechte-/Abrechnungsfolgen beim Verlassen und Entzug folgen [#24](https://github.com/SLxKING01/Schafkopfrechner-App/issues/24). Blockieren ist hier bereits beauftragt und wird nicht lediglich als unbestimmtes Folgefeature verschoben.
