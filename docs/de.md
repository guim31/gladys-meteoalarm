# MeteoAlarm

Die amtlichen Wetterwarnungen aus 38 europäischen Ländern in Gladys:
Belgien, Schweiz, Luxemburg, Deutschland, Spanien, Italien, Niederlande,
Irland, Österreich… und Frankreich. Die nationalen Wetterdienste (KMI,
MeteoSchweiz, MeteoLux, DWD, AEMET, Met Éireann…) veröffentlichen sie auf
[MeteoAlarm](https://meteoalarm.org), betrieben von EUMETNET; die
Integration liest diese öffentlichen Feeds. Kein Konto, kein Schlüssel.

Diese Integration ist nicht mit EUMETNET oder MeteoAlarm verbunden. Entwickelt
wurde sie ohne Zugriff auf den Live-Feed, anhand echter veröffentlichter
Beispiele: Rückmeldungen sind im Gladys-Forum oder in den GitHub-Issues
willkommen.

## Was die Integration macht

- **Ein Gerät pro verfolgter Zone** (Provinz, Kanton, Landkreis,
  Departement…), optional eines für ein Haus von Gladys.
- Auf jedem Gerät: die **höchste aktive Warnstufe** (grün, gelb, orange,
  rot), die Stufe **pro Phänomen** (Wind, Regen, Gewitter, Schnee und
  Glätte, Hitze, Kälte, Lawinen, Waldbrand, Sturmflut, Nebel, Hochwasser,
  Starkregen und Hochwasser) und die Texte: aktuelle und kommende Warnungen,
  Beschreibung, Beginn und Ende.
- Ein **Dashboard-Widget** mit den Warnungen einer Zone, ihrer Farbe, ihrem
  Phänomen, ihren Zeiten und ihrem ganzen Text.
- Zwei **Szenen-Auslöser**: „Neue Wetterwarnung“ (oft am Vortag ihres
  Beginns) und „Wetterwarnung aufgehoben“.
- Nur lesend: Die Integration steuert nichts.

Für Frankreich verfolgt die Météo-France-Integration (anderer Autor) die
Vigilance der Departements genauer. Diese hier richtet sich vor allem an die
Nachbarländer und an Grenzgänger, mit demselben Werkzeug auf beiden Seiten
der Grenze.

## Voraussetzungen

- Gladys **5.2.0** oder neuer.
- Internetzugang vom Gladys-Rechner: Die Feeds liegen auf
  `feeds.meteoalarm.org`.
- Um ein Haus zu verfolgen: ein in Gladys **verortetes** Haus (Einstellungen
  → Zuhause), in einem Land, dessen Wetterdienst die Umrisse seiner
  Warnzonen liefert (siehe [Einschränkungen](#einschränkungen)).

## Konfiguration

1. Installiere die Integration: **Integrationen → Von GitHub installieren**,
   Adresse `https://github.com/guim31/gladys-meteoalarm`.
2. Wähle im Tab **Konfiguration** das **Land**.
3. Gib deine **Zonen** ein, durch Kommas getrennt (höchstens 10): den Namen
   der Zone wie auf meteoalarm.org (z. B. `Liège`, `Haute Savoie`,
   `Strathclyde`) oder ihren Code (die `EMMA_ID` von MeteoAlarm wie `BE009`
   oder den nationalen Code des Feeds wie `FR718`). Akzente,
   Großschreibung und Bindestriche spielen keine Rolle, aber der Name muss
   vollständig sein: `Savoie` ist nicht `Haute Savoie`.
4. Wähle optional ein **Haus**: Die Integration verfolgt dann die Warnungen,
   deren Zone es enthält.
5. Wähle die **Sprache** der Funktionsnamen und Texte (standardmäßig
   Französisch) und die **Abfrage** (alle 10 oder 15 Minuten).
6. Speichere und füge die Geräte dann im Tab **Entdecken** hinzu.

Die Aktion **Zonen auflisten** liest den Feed sofort und listet die
bekannten Zonen des Landes mit ihrem Code auf, und ob deine gefunden wurden.
Ein Feed listet nur die Zonen, die heute eine Warnung haben: Die Liste
wächst mit jeder seit der Installation gesehenen Warnung, und „noch nicht
gesehen“ neben einer deiner Zonen heißt nur, dass sie seitdem keine Warnung
hatte. Prüfe in dem Fall ihre Schreibweise auf meteoalarm.org.

Die Kennung eines Zonengeräts kommt aus deiner Eingabe (Akzente und
Großschreibung egal): `BE009` statt `Liège` legt ein anderes Gerät an.

## Abfrage und Nutzungsbedingungen

- Der Feed des Landes wird **alle 10 oder 15 Minuten** gelesen (eine Anfrage
  für alle deine Zonen), mit `If-None-Match` / `If-Modified-Since`: Ein
  unveränderter Feed kostet eine 304-Antwort.
- Die Details einer Warnung (CAP-Dokument: Texte, Sprachen, Umrisse der
  Zonen) werden **einmal** pro Fassung der Warnung gelesen, und nur für die
  verfolgten Zonen. Ein Haus braucht die Details aller Warnungen des Landes,
  höchstens 40 pro Abfrage.
- Zwischen zwei Abfragen werden Beginn und Ende **jede Minute** ohne Anfrage
  geprüft: Eine Warnung tritt minutengenau in Kraft und endet minutengenau.
- Die Integration verlässt sich nicht darauf, dass Gladys ihre Geräte
  abfragt, sondern aktualisiert sich selbst.
- MeteoAlarm veröffentlicht diese Feeds zur öffentlichen Nutzung und nennt
  kein Anfragekontingent; die Integration bleibt weit unter einer Anfrage pro
  Minute, gibt sich zu erkennen (User-Agent) und nennt ihre Quelle im Widget.
  Lies die Nutzungsbedingungen auf meteoalarm.org. Die Warnungen bleiben die
  der nationalen Wetterdienste: Halte dich bei jeder Entscheidung an deren
  offizielle Kanäle.

## Geräte

Jede Zone (oder jedes Haus) ergibt ein Gerät „MeteoAlarm <Zone>“. Die
Funktionsnamen werden beim Hinzufügen des Geräts in der eingestellten
Sprache festgelegt.

| Funktion                         | Typ         | Wert                                                             |
| -------------------------------- | ----------- | ---------------------------------------------------------------- |
| Höchste Warnstufe                | Risikostufe | 0 grün (keine Warnung), 1 gelb, 2 orange, 3 rot                  |
| Warnstufe Wind, Warnstufe Regen… | Risikostufe | dasselbe, für ein Phänomen (12 Funktionen)                       |
| Aktuelle und kommende Warnungen  | Text        | „Orange: Wind (Do., 15. Okt., 06:00 → Do., 15. Okt., 21:00) · …“ |
| Beschreibung der Warnung         | Text        | Überschrift und Beschreibung der Hauptwarnung                    |
| Beginn, Ende der Warnung         | Text        | ihr Zeitraum, in der Zeitzone von Gladys                         |

Gladys zeigt die Risikostufen als farbige Plaketten: „Kein Risiko“ grün,
„Niedrig“ gelb, „Mittel“ orange, „Hoch“ rot — die Farben von MeteoAlarm.

Die Stufen-Funktionen zählen nur die **aktiven** Warnungen. Eine für morgen
angekündigte Warnung erscheint sofort im Text, im Widget und im Auslöser
„Neue Wetterwarnung“. Die Hauptwarnung ist die höchste aktive, sonst die
nächste angekündigte. Die Texte sind in der eingestellten Sprache, wenn der
Herausgeber sie schreibt, sonst auf Englisch, sonst in der Sprache des
Landes.

## Dashboard-Widget

Füge das Widget **Wetterwarnungen** zu einem Dashboard hinzu und wähle in
seinen Einstellungen eine Zone. Es zeigt die höchste Stufe, dann die aktiven
Warnungen (die höchste zuerst) und die angekündigten, jeweils mit Farbe,
Phänomen und Zeitraum. Ein Tippen auf eine Warnung öffnet ihren ganzen Text:
Überschrift, Beschreibung und Empfehlungen des Wetterdienstes. Die Texte
folgen der Sprache des Dashboards, wenn der Herausgeber sie schreibt. Die
letzte Zeile nennt die Quelle, oder sagt, dass MeteoAlarm nicht antwortet und
die angezeigten Warnungen veraltet sein können.

## Szenen-Auslöser

Im Szenen-Editor (Kategorie Integrationen):

- **Neue Wetterwarnung**: Eine Warnung erscheint für eine Zone oder ihre
  Stufe steigt (gelber Wind, dann oranger Wind: zweimal gemeldet; eine
  niedrigere Stufe ist keine Neuigkeit). Oft am Vortag des Beginns. Filter:
  die Zone, die Stufen (gelb, orange, rot), die Phänomene. Variablen:
  `{{triggerEvent.data.zone}}`, `level` (`yellow`, `orange`, `red`),
  `level_label`, `phenomenon`, `phenomenon_label`, `in_force` (wahr, wenn
  schon aktiv), `period` (ausgeschrieben), `onset` und `expires`
  (ISO-Daten), `headline`, `description`, `instruction`.
- **Wetterwarnung aufgehoben**: Eine Zone hat für ein Phänomen keine Warnung
  mehr, abgelaufen oder zurückgezogen. Filter: die Zone, die Phänomene.
  Variablen: `zone`, `level`, `level_label` (die letzte Stufe), `phenomenon`,
  `phenomenon_label`.

Die erste Abfrage nach der Installation bleibt still (eine Installation
mitten im Sturm startet nicht alle Szenen auf einmal), und ein Neustart
meldet nicht noch einmal, was schon gemeldet wurde. Um auf eine **aktive**
Stufe zu reagieren, nimm den üblichen Auslöser „Gerätewert“ auf den
Stufen-Funktionen.

## Szenen-Beispiele

- **Wind angekündigt**: Auslöser „Neue Wetterwarnung“, Stufen orange und
  rot, Phänomen Wind → Nachricht senden „Warnung
  {{triggerEvent.data.level_label}}, {{triggerEvent.data.phenomenon_label}}:
  {{triggerEvent.data.period}}. {{triggerEvent.data.headline}}“.
- **Orange oder rot aktiv**: Auslöser „Gerätewert“ auf „Höchste Warnstufe“
  deiner Zone, größer oder gleich 2 → die Flurlampe orange schalten; eine
  andere Szene bei 0 schaltet sie aus.
- **Hitze**: „Warnstufe Hitze“ größer oder gleich 1 → die Rollläden auf der
  Südseite um 11 Uhr schließen, solange sie dauert.
- **Ende der Warnung**: Auslöser „Wetterwarnung aufgehoben“ → senden „Die
  Warnung {{triggerEvent.data.phenomenon_label}} ist für
  {{triggerEvent.data.zone}} vorbei“.

## Fehlerbehebung

- **„Wähle das Land deiner Zonen“ / „Gib mindestens eine Zone ein“**: Die
  Konfiguration ist unvollständig.
- **„MeteoAlarm hat keinen Feed für dieses Land“**: Die Feed-Adresse hat 404
  geantwortet. Melde es: MeteoAlarm hat sie vielleicht umbenannt.
- **„MeteoAlarm antwortet nicht“**: Netzwerk oder Dienst gestört. Die letzte
  Abfrage bleibt bestehen, und die Integration versucht es bei jeder Abfrage
  erneut; die Protokolle sagen es einmal, und einmal, wenn er wieder
  antwortet.
- **Eine Zone bleibt grün, obwohl meteoalarm.org eine Warnung zeigt**: Starte
  **Zonen auflisten** und vergleiche die Schreibweise, oder gib den dort
  angezeigten Code ein.
- **Keine Beschreibung, nur der Titel**: Die Details der Warnung waren nicht
  lesbar; sie werden nach der nächsten Abfrage des Feeds erneut versucht.
- **„Der Feed dieses Landes liefert keine Zonenumrisse“**: Das Haus lässt
  sich nicht verorten; verfolge stattdessen Zonen.
- **Das Haus hat keinen Standort**: Lege ihn unter Einstellungen → Zuhause
  fest.
- Ausführliche Protokolle: Starte die Integration mit `LOG_LEVEL=debug`. Ein
  normaler Zyklus schreibt nichts auf der Info-Stufe.

## Einschränkungen

- Ohne Zugriff auf den Live-Feed entwickelt (die Entwicklungsumgebung
  erreichte ihn nicht): getestet mit echten Feeds, die mit der Bibliothek
  `meteoalert-api` veröffentlicht wurden (Frankreich, Irland, Vereinigtes
  Königreich, 2022), und mit einem synthetischen belgischen Feed. Die
  Länderliste folgt den Adressen dieser Bibliothek. Rückmeldungen sind
  willkommen.
- Ein Feed listet nur die Zonen mit einer Warnung: Es gibt keine
  vollständige Liste der Zonen eines Landes, daher die einzugebenden Namen
  und Codes.
- Ein Haus lässt sich nur verfolgen, wenn der Wetterdienst die Umrisse seiner
  Zonen in den Warnungsdetails liefert (Irland tut es, Frankreich und das
  Vereinigte Königreich taten es in den Beispielen nicht).
- Ein Land pro Installation, höchstens 10 Zonen.
- Die Texte sind die der Wetterdienste, die Sprache hängt vom Herausgeber
  ab.
- MeteoAlarm nennt diesen Atom-Feed „legacy“: Wird er abgeschaltet, muss die
  Integration nachziehen.
- Kein amtliches Warnsystem: Halte dich bei jeder Entscheidung an den
  nationalen Wetterdienst.
