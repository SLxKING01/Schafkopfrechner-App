# Spielrollen für die Statistik

Beim Öffnen der Spieleingabe über einen Spielernamen ist dieser Spieler der Spielmacher. Die Rollen werden über stabile Spieler-IDs gespeichert, unabhängig von Kontozuordnung oder Anzeigenamen.

- `declarerId`: der Spielmacher bzw. Alleinspieler.
- `partnerId`: der gesuchte Mitspieler bei Rufspiel/Sauspiel, Hochzeit und Kreuzbock. Der Partner ist die andere Person in der Partei des Spielmachers.
- `declarerWon`: `true`, wenn die Spielerpartei gewonnen hat, sonst `false`. Beim Speichern und Korrigieren wird dieser Wert aus den tatsächlichen Gewinnern abgeleitet und auf Konsistenz geprüft.

Wenz, Solo, Geier und deren verwandte Alleinspiele haben keinen `partnerId`. Dass die Gegenspieler gemeinsam gewinnen, macht sie nicht zu Spielmachern. Stockbuchungen erhalten keine Spielmacherrolle.

Die Rollen und das Ergebnis bleiben in der Gerätesicherung, dem gemeinsamen Tisch und beim Abschließen des Spieltags erhalten. Tarifänderungen ändern diese Angaben nicht. Beim Korrigieren der Partner werden ein bekannter Spielmacher beibehalten und der zugehörige Partner und das Ergebnis aktualisiert.

Die Statistik kann damit selbst gespielte Runden, die zugehörigen Siege/Niederlagen und die Rolle als Gesuchter unterscheiden. Bei älteren Alleinspielen lässt sich der Spielmacher aus der eindeutigen Ein-Personen-Partei ableiten. Bei älteren Partnerspielen ohne Rollenangaben wird kein Spielmacher geraten; diese Rolle bleibt unbekannt.
