# Änderungsprotokoll

## [2.2.0] - July 2026

**Zusammenfassung:** Integration der System-Zwischenablage in andere Apps, Rahmenauswahl, verknüpfte geteilte Ansicht, Link-Verwaltung, passwortgeschützte ZIP-Archive, native Eigenschaften unter Windows, Erweiterungen der Extension-API, Unterstützung für Hebräisch und Verbesserungen am Navigator.

- [Neue Funktionen](#neue-funktionen)
  - [System-Zwischenablage](#system-zwischenablage)
  - [Rahmenauswahl](#rahmenauswahl)
  - [Verknüpfte geteilte Ansicht](#verknüpfte-geteilte-ansicht)
  - [Link-Verwaltung](#link-verwaltung)
  - [Native Eigenschaften](#native-eigenschaften)
  - [Spalten in der Listenansicht anpassen](#spalten-in-der-listenansicht-anpassen)
  - [Adresse „Standorte“](#adresse-standorte)
- [Erweiterungen](#erweiterungen)
  - [Extension-APIs und Ansichten](#extension-apis-und-ansichten)
- [Neue Einstellungen](#neue-einstellungen)
- [Neue Tastenkürzel](#neue-tastenkürzel)
- [Neue Sprachen](#neue-sprachen)
- [UX-Verbesserungen](#ux-verbesserungen)
  - [Archivextraktion](#archivextraktion)
  - [Raster-Sortierung](#raster-sortierung)
  - [Shell-Erweiterungen](#shell-erweiterungen)
  - [Sitzungsspeicher](#sitzungsspeicher)
  - [Navigator-Leistung](#navigator-leistung)
  - [Startseite und Kontextmenüs](#startseite-und-kontextmenüs)
- [UI-Verbesserungen](#ui-verbesserungen)
- [Fehlerbehebungen](#fehlerbehebungen)

### Neue Funktionen

#### System-Zwischenablage

Dateien, Ordner und Bilder lassen sich über die System-Zwischenablage zwischen Sigma File Manager und anderen Apps kopieren und einfügen.

- **Dateiübertragung zwischen Apps**: Elemente in SFM kopieren oder ausschneiden und in Apps wie den Datei-Explorer einfügen oder mit `Ctrl+V` Pfade und Dateien aus anderen Apps in den Navigator einfügen;
- **Bilder einfügen**: aus Browsern und anderen Apps kopierte Bilder direkt in einen Ordner einfügen;
- **Konfliktdialoge**: wenn eingefügte Elemente bereits vorhanden sind, `Umbenennen` oder `Zusammenführen` wählen und einzelne Dateikonflikte mit Ersetzen, Überspringen, Beide behalten oder Auf alle anwenden lösen;
- **Zwischenablage-Symbolleiste**: optionale Symbolleistenvorschau für Bilder und Dateipfade, die in anderen Apps kopiert wurden;

Die Symbolleiste lässt sich unter `Einstellungen > Erscheinungsbild > Zwischenablage` ein- und ausblenden. Das Einfügen mit `Ctrl+V` funktioniert auch bei ausgeblendeter Symbolleiste.

![system-clipboard](./public/changelog/assets/2.2.0/system-clipboard.webp)

#### Rahmenauswahl

Ziehen Sie im leeren Bereich des Navigators einen Auswahlrahmen auf, um mehrere Elemente auszuwählen.

- **Zusatztasten**: `Ctrl` oder `Shift` gedrückt halten, um Elemente zur aktuellen Auswahl hinzuzufügen; mit `Alt` wird die Auswahl umgekehrt;
- **Einfachere Auswahl**: optional die Abstände in Listen und Rastern vergrößern, damit sich der Auswahlrahmen leichter aufziehen lässt;

Aktivieren Sie diese Funktion unter `Einstellungen > Allgemein > Dateiansicht > Rahmenauswahl aktivieren`.

![box-selection](./public/changelog/assets/2.2.0/box-selection.webp)

#### Verknüpfte geteilte Ansicht

Der neue Modus `Verknüpft` vereinfacht Arbeitsabläufe in Spalten: Ein Klick auf einen Ordner im ersten Bereich zeigt dessen Inhalt im zweiten Bereich.

Der bestehende unabhängige Modus `Geteilt` bleibt unverändert. Der Modus lässt sich im Optionsmenü des Navigators unter `Modus der geteilten Ansicht` auswählen; mit `Ctrl+S` wird die geteilte Ansicht ein- oder ausgeschaltet.

Das Symbol des Infobereichs wurde ebenfalls aktualisiert, damit es sich leichter vom Symbol der geteilten Ansicht unterscheiden lässt.

![linked-split-view](./public/changelog/assets/2.2.0/linked-split-view.webp)

#### Link-Verwaltung

Im Navigator lassen sich Dateisystem-Links erstellen und prüfen.

- **Link erstellen**: symbolische Links, Verknüpfungen, Hardlinks und Junctions über das Kontextmenü erstellen (`Link erstellen`);
- **Link-Spalten**: optionale Listenspalten für Art, Links, Linkziel und Linkstatus (`Gültig`, `Defekt`, `Unbekannt`, `Nicht unterstützt`);
- **Öffnen**: Verzeichnisverknüpfungen und Symlink-Ordner führen zu ihren Zielen; andere Linkziele werden mit der Standard-App geöffnet;

![link-handling](./public/changelog/assets/2.2.0/link-handling.webp)

#### Native Eigenschaften

Unter Windows lässt sich der native Dialog `Eigenschaften` für ausgewählte Elemente über das Kontextmenü, das Aktionsmenü, `Alt+Enter` oder `Alt` + Doppelklick öffnen.

![native-properties](./public/changelog/assets/2.2.0/native-properties.webp)

#### Spalten in der Listenansicht anpassen

Spalten der Listenansicht können in der Breite geändert und neu angeordnet werden.

- **Größe ändern**: Spaltenränder ziehen, um die Breite zu ändern;
- **Reihenfolge und Sichtbarkeit**: Reihenfolge und Sichtbarkeit über das Menü `Spalten` in der Kopfzeile der Liste verwalten;
- **Breitenoptionen**: `Verfügbare Breite füllen` und `Mindestbreiten festlegen`;

![list-column-resize](./public/changelog/assets/2.2.0/list-column-resize.webp)

#### Adresse „Standorte“

Über die Stammadresse `Standorte` lassen sich Laufwerke und virtuelle Orte schneller aufrufen.

- **Adressleiste**: von der Stammebene eines Laufwerks eine Ebene nach oben wechseln oder `Standorte` über die Adressleiste oder den Adresseditor öffnen;
- **Favoriten und Tags**: Standorte können wie andere Verzeichnisse zu den Favoriten hinzugefügt und mit Tags versehen werden;
- **Geteilte Ansicht**: besonders nützlich, um Laufwerke zwischen Bereichen zu wechseln, ohne den Navigator zu verlassen;

![root-locations-address](./public/changelog/assets/2.2.0/root-locations-address.webp)

### Erweiterungen

#### Extension-APIs und Ansichten

Erweiterungen erhalten zusätzliche Hostfunktionen und UI-Bausteine.

- **Lokale Binärdateien**: Erweiterungsabhängigkeiten mit automatischer Einrichtung oder manuell gewählten lokalen Binärdateien konfigurieren (`Erweiterungen > Abhängigkeiten`);
- **HTTP-Anfragen**: Erweiterungen können HTTP-Anfragen an Hosts senden, die in ihrem Manifest erlaubt sind;
- **Ansichtssteuerung**: Erweiterungen können Layout- und Sortiereinstellungen des Navigators anwenden (mit der Berechtigung für Ansichten);
- **Zwischenablage-API**: Erweiterungen können die Zwischenablage lesen und schreiben (mit Berechtigung);
- **Listen-Detail-Ansicht**: neues UI-Muster für Erweiterungen mit einer Liste mit Suchfunktion und einem Detailbereich;

![extension-local-binaries](./public/changelog/assets/2.2.0/extension-local-binaries.webp)

![extension-dependency-config](./public/changelog/assets/2.2.0/extension-dependency-config.webp)

![extension-list-detail](./public/changelog/assets/2.2.0/extension-list-detail.webp)

![extension-http-api](./public/changelog/assets/2.2.0/extension-http-api.webp)

### Neue Einstellungen

- **Rahmenauswahl aktivieren**: in einem leeren Bereich ziehen, um mehrere Elemente auszuwählen;
  `Einstellungen > Allgemein > Dateiansicht > Rahmenauswahl aktivieren`
- **Abstände in der Dateiansicht vergrößern**: größere Abstände in Listen und Rastern erleichtern das Aufziehen eines Auswahlrahmens;
  `Einstellungen > Allgemein > Dateiansicht > Abstände in der Dateiansicht vergrößern`
- **Schnellansicht-Fenster im Speicher behalten**: Schnellansicht geladen halten, damit sie sich sofort öffnet (etwa 200 MB);
  `Einstellungen > Allgemein > Leistung > Schnellansicht-Fenster im Speicher behalten`
- **Druckfenster im Speicher behalten**: Druckfenster geladen halten, damit es sich sofort öffnet (etwa 200 MB);
  `Einstellungen > Allgemein > Leistung > Druckfenster im Speicher behalten`
- **Zwischenablage-Symbolleiste für externe Bilder**: Zwischenablage-Symbolleiste für in anderen Apps kopierte Bilder anzeigen;
  `Einstellungen > Erscheinungsbild > Zwischenablage`
- **Zwischenablage-Symbolleiste für externe Pfade**: Zwischenablage-Symbolleiste für in anderen Apps kopierte Dateipfade anzeigen;
  `Einstellungen > Erscheinungsbild > Zwischenablage`
- **Dynamische Größe des Infobereichs**: Größe des Infobereichs automatisch anpassen lassen oder die Funktion durch manuelles Ändern der Größe deaktivieren;
  `Einstellungen > Erscheinungsbild > Infobereich > Dynamische Größe des Infobereichs`
- **Bild in voller Größe in der Vorschau des Infobereichs anzeigen**: Bilder in voller Auflösung im Infobereich anzeigen;
  `Einstellungen > Erscheinungsbild > Infobereich > Bild in voller Größe in der Vorschau des Infobereichs anzeigen`
- **Videovorschau standardmäßig stummschalten**: Videovorschauen im Infobereich beim Durchsuchen stummschalten;
  `Einstellungen > Erscheinungsbild > Infobereich > Videovorschau standardmäßig stummschalten`
- **Videovorschauen automatisch abspielen**: Videos im Infobereich bei Auswahl automatisch abspielen;
  `Einstellungen > Erscheinungsbild > Infobereich > Videovorschauen automatisch abspielen`

### Neue Tastenkürzel

- **Native Eigenschaften** (`Alt+Enter`): unter Windows den nativen Eigenschaften-Dialog für ausgewählte Elemente öffnen;

### Neue Sprachen

- **Hebräisch** (`עברית`): vollständige Übersetzung mit Rechts-nach-links-Layout (`Einstellungen > Allgemein > Sprache`);

### UX-Verbesserungen

#### Archivextraktion

Die ZIP-Extraktion unterstützt jetzt verschlüsselte Archive und Dateinamen mit einer anderen Kodierung als UTF-8.

- **Passwortgeschützte ZIP-Archive**: Archivpasswort eingeben, wenn die Extraktion es erfordert;
- **Dateinamenskodierung**: Kodierung unter `Optionen zur Archivextraktion` auswählen; die automatische Erkennung wird bevorzugt, regional gruppierte Kodierungen stehen als Alternativen zur Verfügung;

![archive-extraction-options](./public/changelog/assets/2.2.0/archive-extraction-options.webp)

![archive-extraction-encoding](./public/changelog/assets/2.2.0/archive-extraction-encoding.webp)

#### Raster-Sortierung

Das Rasterlayout verfügt jetzt über eigene Steuerelemente zum Sortieren im Optionsmenü des Navigators.

- **Sortieren nach**: Name, Elemente, Größe, Geändert, Erstellt, Tags, Art, Links und Linkstatus;
- **Richtung**: aufsteigend oder absteigend, getrennt von der Sortierung der Listenansicht gespeichert;

![grid-sorting](./public/changelog/assets/2.2.0/grid-sorting.webp)

#### Shell-Erweiterungen

Das Kontextmenü kann moderne Aktionen von Shell-Erweiterungen laden, die andere Apps unter `Shell-Erweiterungen` registriert haben.

![shell-extensions](./public/changelog/assets/2.2.0/shell-extensions.webp)

#### Sitzungsspeicher

Scrollpositionen und aktive Tabs werden wiederhergestellt, wenn Sie während derselben Sitzung eine Seite oder einen Bereich verlassen und zurückkehren.

#### Navigator-Leistung

Das Durchsuchen großer Ordner und Medien ist schneller und speicherschonender.

- **Erstmaliges Laden**: Verzeichnisse werden beim ersten Öffnen schneller geladen;
- **Symbole laden**: benutzerdefinierte Symbole und Systemsymbole erscheinen schneller;
- **Scrollen in Listen**: flüssigeres Scrollen in großen Verzeichnissen;
- **Medienvorschauen**: Bild-, GIF- und Videovorschauen reagieren schneller und nutzen weniger Speicher;
- **Indexierung**: stabilere globale Suchindexierung;

#### Startseite und Kontextmenüs

- **Trennen**: Netzwerkverbindungen oder Wechseldatenträger über das Kontextmenü trennen, sofern dies unterstützt wird;
- **Alle Duplikate schließen**: der Tab-Menüpunkt `Alle Duplikate schließen` schließt jetzt alle mehrfach geöffneten Pfade im Arbeitsbereich, nicht nur Duplikate des aktuellen Tabs;
- **Auswahl per Rechtsklick aufheben**: ein Rechtsklick auf den leeren Hintergrund des Navigators hebt die aktuelle Auswahl auf, bevor das Hintergrundmenü geöffnet wird;
- **Startseiten-Aktionen**: Kontextmenüs der Startseite schließen sich nach dem Ausführen einer Aktion, `In neuem Tab öffnen` öffnet den Navigator und die Tab-Leiste scrollt automatisch zu neuen Tabs;
- **Ziehbereich des Fensters**: bei Titelleisten im Linux-Stil erstreckt sich der Ziehbereich über die Schaltflächen der Symbolleiste, damit sich das Fenster leichter verschieben lässt;

![window-drag-region](./public/changelog/assets/2.2.0/window-drag-region.webp)

### UI-Verbesserungen

- **Anzeige des aktiven Bereichs**: klarere Markierung des aktiven Bereichs in der Statusleiste bei aktivierter geteilter Ansicht;
- **Größe des Infobereichs änderbar**: Breite des Infobereichs und Aufteilung zwischen Vorschau und Details durch Ziehen anpassen;
- **Kompakter Infobereich**: dichteres Eigenschaftslayout im Infobereich;
- **Kontextmenü-Aktionen**: `Karte bearbeiten` wird als Aktionsschaltfläche angezeigt; außerdem sind alle Aktionsschaltflächen kleiner;
- **Darstellung des Navigators**: verbessertes adaptives Layout, deutlichere Hervorhebung aktiver Tabs in der geteilten Ansicht und überarbeitete Erweiterungsansicht in der Befehlspalette;
- **RTL-Layout**: sauberere Ausrichtung für Rechts-nach-links-Sprachen;

![resizable-info-panel](./public/changelog/assets/2.2.0/resizable-info-panel.webp)

![compact-info-panel](./public/changelog/assets/2.2.0/compact-info-panel.webp)

### Fehlerbehebungen

- **Suche beim Tippen**: die Schnellsuche wird jetzt auch bei nicht-lateinischen Tastaturlayouts aktiviert;
- **Verzeichnis laden**: Einträge werden nach dem Laden eines Verzeichnisses nicht mehr neu angeordnet;
- **Benutzerdefinierte Symbole**: benutzerdefinierte Symbole laden ohne spürbare Verzögerung;
- **Rasterkarten**: Rasterlayout-Karten ändern ihre Größe beim Laden nicht mehr;
- **Raster-Scrollleiste**: Raster-Scrollleiste versteckt sich nicht mehr hinter fixierten Kopfzeilen;
- **Schnellauswahl**: bei der Schnellauswahl von Dateien wird nicht mehr versehentlich eine Datei geöffnet;
- **Terminal-Kürzel**: `Alt+T` öffnet das Terminal jetzt für den ausgewählten Eintrag und nicht mehr für das aktuelle Verzeichnis;
- **Dateien öffnen**: Dateien werden jetzt mit dem richtigen Arbeitsverzeichnis geöffnet;
- **SMB-Freigaben**: Dateien auf SMB-Freigaben können wieder geöffnet werden;
- **WSL-Pfade**: Verarbeitung von UNC-Pfaden des WSL-Hosts unter Windows korrigiert, einschließlich `//wsl.localhost` als virtuelle Liste der Distributionen;
- **Standard-Dateimanager**: Die Einstellung bleibt für direkte Windows-Installationen verfügbar; in der Microsoft Store-Version wird sie als nicht verfügbar angezeigt;
- **AppImage (Linux)**: `Could not create default EGL display: EGL_BAD_PARAMETER` behoben;
- **Erweiterungsinstallation (Linux)**: Installationsfehler bei Erweiterungen mit mehreren Dateien im Verzeichnis `dist` behoben;
- **Erweiterungsdetails**: Ausrichtung der Übersichtsseite korrigiert;
- **Geräte-Aufwachen**: App bleibt nach dem Aufwachen des Geräts nicht mehr im Ladezustand stecken;
- **Update-Benachrichtigungen**: Update-Benachrichtigungen erscheinen nicht mehr für unveröffentlichte Versionen;
- **RTL**: Probleme mit dem Rechts-nach-links-Layout behoben;
- **Übersetzungen**: fehlende und fehlerhafte Übersetzungstexte korrigiert;

---

## [2.1.0] - May 2026

**Zusammenfassung:** Leistungsverbesserungen im Navigator, generierte Miniaturansichten, Erweiterungsthemen, Drucken, Dateivorschauen, neue Tastenkürzel, Verbesserungen am Adresseditor, Neugestaltung des Statuscenters sowie Verfeinerungen von Tabs und Navigation.

- [Neue Funktionen](#neue-funktionen)
  - [Drucken](#drucken)
  - [Dateien auf Tabs ziehen](#dateien-auf-tabs-ziehen)
  - [Dateivorschau im Infobereich](#dateivorschau-im-infobereich)
  - [Navigator-Listenspalten](#navigator-listenspalten)
- [Erweiterungen](#erweiterungen)
  - [App-Themes aus Erweiterungen](#app-themes-aus-erweiterungen)
  - [Symbol-Themes aus Erweiterungen](#symbol-themes-aus-erweiterungen)
- [Neue Einstellungen](#neue-einstellungen)
- [Neue Tastenkürzel](#neue-tastenkürzel)
- [UX-Verbesserungen](#ux-verbesserungen)
  - [Leistung bei großen Verzeichnissen](#leistung-bei-großen-verzeichnissen)
  - [Schnellsuche](#schnellsuche)
  - [Adresseditor](#adresseditor)
  - [Statuscenter](#statuscenter)
  - [Navigation und Tabs](#navigation-und-tabs)
  - [Tastenkürzel-Verwaltung](#tastenkürzel-verwaltung)
- [UI-Verbesserungen](#ui-verbesserungen)
- [Fehlerbehebungen](#fehlerbehebungen)

### Neue Funktionen

#### Drucken

Ausgewählte Dateien lassen sich direkt aus dem Navigator über das Kontextmenü, das Aktionsmenü oder `Ctrl+O` drucken.

- **Unterstützte Formate**: Bilder, PDF-Dateien und Textdateien;
- **Schnelles Beenden**: Druckansicht mit `Escape` schließen;

![printing](./public/changelog/assets/2.1.0/printing.webp)

#### Dateien auf Tabs ziehen

Dateien oder Verzeichnisse lassen sich auf Tabs ziehen, um sie in das Verzeichnis eines anderen Tabs zu verschieben oder zu kopieren.

- **Tabs als Ablageziel**: Tabs werden beim Ziehen von Dateien im Navigator zu Zielen für Drag-and-drop;
- **Aktivierung beim Überfahren**: verweilt der Mauszeiger während des Ziehens über einem Tab, kann vor dem Ablegen zu diesem Tab gewechselt werden;
- **Geteilte Tabs**: Tabgruppen für Verzeichnisse behalten ihr normales Ablegeverhalten und die Tab-Struktur der geteilten Ansicht bei;

![file-drop-to-tabs](./public/changelog/assets/2.1.0/file-drop-to-tabs.webp)

#### Dateivorschau im Infobereich

Der Infobereich kann jetzt Vorschauen für alle von der Schnellansicht unterstützten Dateitypen anzeigen, nicht nur für Bilder und Videos.

- **Medienvorschauen**: Bilder nutzen generierte Miniaturansichten, Videos und Audiodateien bieten native Bedienelemente und PDF-Dateien werden direkt im Infobereich dargestellt;
- **Textvorschauen**: Textdateien zeigen eine kompakte dekodierte Vorschau mit einer sinnvollen Größenbegrenzung;
- **Ersatzdarstellung**: nicht unterstützte Dateien und Ordner werden weiterhin durch einfache Symbole dargestellt;

![info-panel-file-preview](./public/changelog/assets/2.1.0/info-panel-file-preview.webp)

#### Navigator-Listenspalten

Die Listenansicht bietet mehr optionale Spalten und eine bessere direkte Verwaltung von Metadaten.

- **Spalte `Erstellt`**: Erstellungsdatum anzeigen und danach sortieren;
- **Spalte `Tags`**: Tags direkt in der Listenansicht anzeigen und über die Spalte hinzufügen, entfernen oder bearbeiten;

![navigator-list-columns](./public/changelog/assets/2.1.0/navigator-list-columns.webp)

### Erweiterungen

#### App-Themes aus Erweiterungen

Erweiterungen können jetzt vollständige Farbschemas für die App bereitstellen. Installierte Theme-Erweiterungen erscheinen in der Theme-Auswahl.

#### Symbol-Themes aus Erweiterungen

Erweiterungen können jetzt Symbol-Themes für Ordner und Dateien im Navigator bereitstellen.

- **Getrennte Auswahl**: Ordner- und Datei-Symbolthemes separat unter `Einstellungen > Erscheinungsbild > Symbol-Theme` auswählen;
- **Integrierte und Erweiterungs-Themes**: das mitgelieferte Standard- oder System-Symboltheme sowie jedes aktivierte Erweiterungs-Theme verwenden;
- **Theme-Zuordnung**: bereitgestellte Themes können Symbole anhand von Dateierweiterung, Dateiname, Ordnername und geöffnetem Ordnerzustand definieren;

### Neue Einstellungen

- **Fetter Text des aktiven Tabs**: Titel des aktiven Tabs fett darstellen (`Einstellungen > Tabs > Tab-Erscheinungsbild > Fetter Text des aktiven Tabs`);

![bold-active-tab-text-setting](./public/changelog/assets/2.1.0/bold-active-tab-text-setting.webp)

### Neue Tastenkürzel

- **Geteilte Ansicht umschalten** (`Ctrl+S`): geteilte Ansicht im Navigator ein- oder ausblenden;
- **Geschlossenen Tab wiederherstellen** (`Ctrl+Shift+T`): die zuletzt geschlossene Tabgruppe wiederherstellen;
- **Datei / Verzeichnis erstellen** (`Ctrl+Shift+M` / `Ctrl+Shift+N`): eine neue Datei oder ein neues Verzeichnis im aktuellen Verzeichnis erstellen;
- **Ausgewählte Datei drucken** (`Ctrl+O`): die ausgewählte Datei drucken;
- **Kopierten Pfad öffnen** (`Ctrl+Shift+V`): einen gültigen Pfad aus der Zwischenablage öffnen;
- **Seiten wechseln** (`Alt+1` - `Alt+5`): zwischen Startseite, Navigator, Dashboard, Einstellungen und Erweiterungen wechseln;
- **Im Verzeichnisverlauf navigieren** (`Alt+Left` / `Alt+Right`): im Navigator-Verlauf zurück oder vorwärts gehen;
- **Zum übergeordneten Verzeichnis** (`Alt+Up`): zum übergeordneten Verzeichnis gehen;
- **Maustasten für den Verlauf** (`Mouse Button 4` / `Mouse Button 5`): mit den Seitentasten der Maus zurück und vorwärts navigieren;

![create-file-directory-shortcuts](./public/changelog/assets/2.1.0/create-file-directory-shortcuts.webp)

![navigator-shortcuts](./public/changelog/assets/2.1.0/navigator-shortcuts.webp)

### UX-Verbesserungen

#### Leistung bei großen Verzeichnissen

Navigation, Schnellsuche und medienreiche Ordner reagieren schneller und nutzen weniger Speicher.

- **Generierte Miniaturansichten**: Miniaturansichten für Bilder und Videos werden in kleineren Abmessungen erzeugt, sodass nicht mehr die vollständigen Mediendateien für jede Dateikarte geladen werden;
- **Progressive Bilder**: Bildkarten im Raster können eine unscharfe, niedrig aufgelöste Miniaturansicht zeigen, bevor die endgültige Miniaturansicht bereit ist;
- **Erzeugung abbrechen**: die Erzeugung von Miniaturansichten kann abgebrochen werden, wenn sich der Ordner oder die sichtbaren Einträge ändern;
- **Darstellungsleistung**: Einträge in großen Verzeichnissen werden effizienter dargestellt und die Schnellansicht nutzt generierte Miniaturansichten in einer virtuellen Liste;

![low-res-image-thumbnail-preview](./public/changelog/assets/2.1.0/low-res-image-thumbnail-preview.webp)

#### Schnellsuche

Die Schnellsuche bietet jetzt zwei Modi: passiv und aktiv:

- **Passiver Modus**: wird beim Tippen automatisch aktiviert, filtert Einträge, ohne den Eingabefokus in das Suchfeld zu setzen, und behindert die Navigation nicht;
- **Aktiver Modus**: wird mit `Ctrl+F` aktiviert, setzt den Eingabefokus in das Suchfeld und verhindert die Navigation, ermöglicht dafür aber eine genauere Steuerung der Suchanfrage;

Weitere Änderungen:

- **Tippen zum Filtern**: alphanumerische Tasten starten jetzt immer die Schnellsuche (passiver Modus) im aktiven Bereich;
- **Tastaturnavigation**: der erste passende Eintrag wird automatisch ausgewählt;
- **Suchfenster**: das Schnellsuche-Fenster ist kompakter und verdeckt weniger Verzeichniseinträge;

![quick-search](./public/changelog/assets/2.1.0/quick-search.webp)

#### Adresseditor

Mit dem Adresseditor lassen sich jetzt nicht nur Verzeichnisse, sondern generell Pfade öffnen.

- **Dateien und Verzeichnisse**: Dateien sowie Verzeichnisse aus dem Adresseditor öffnen;
- **Häufige Pfade**: in einen Modus zum schnellen Öffnen häufig genutzter Pfade wechseln;
- **Vorschläge**: Verzeichniseinträge, exakte Treffer, zuletzt verwendete Pfade, mit Tags versehene Elemente, Benutzerordner und Systemlaufwerke durchsuchen;
- **Tastaturaktionen**: im Editor zurück, vorwärts und nach oben navigieren sowie einen Eintrag im übergeordneten Verzeichnis anzeigen;

![address-editor](./public/changelog/assets/2.1.0/address-editor.webp)

#### Statuscenter

Das Statuscenter ist jetzt eine kompakte Komponente in der Symbolleiste mit übersichtlicheren Vorgangsgruppen.

- **Anzahl aktiver Vorgänge**: die Schaltfläche in der Symbolleiste erweitert sich zu einer pillenförmigen Anzeige mit der Anzahl aktiver Vorgänge;
- **Vorgangsgruppen**: aktive und abgeschlossene Vorgänge sind getrennt; abgeschlossene Vorgänge befinden sich in einem einklappbaren Bereich;
- **Alle abbrechen**: aktive Vorgänge gleichzeitig über die Kopfzeile des Bereichs abbrechen;
- **Vorgangskarten**: Vorgangskarten zeigen deutlichere Typ- und Statusbezeichnungen wie `Kopieren | Erfolg` oder `Archiv | Fehler`;
- **Wiederherstellung der Zwischenablage**: beim Einfügen wird die Zwischenablage geleert, sobald ein Vorgang in die Warteschlange gestellt wird, und bei einem Fehlschlag wiederhergestellt;

![status-center](./public/changelog/assets/2.1.0/status-center.webp)

#### Navigation und Tabs

Die Navigation und das Verhalten der Tabs sind jetzt vorhersehbarer.

- **Laufwerke in der Seitenleiste**: ein Klick auf ein Laufwerk in der Navigationsseitenleiste öffnet es im aktuellen Tab;
- **Aktuelles Verzeichnis**: der aktuelle Abschnitt der Adresse wird deutlicher hervorgehoben; sein Kontextmenü öffnet sich per Rechtsklick auf den letzten Abschnitt;
- **Geschlossene Tabs**: wiederhergestellte Tabs kehren an ihre vorherige Position zurück, behalten umbenannte Pfade und leiten gelöschte Pfade zur Startseite um;
- **Adaptives Layout**: Navigationsschaltflächen der Symbolleiste werden früher eingeklappt, Adressleisten der geteilten Ansicht wechseln in sehr schmalen Bereichen in eine zweite Zeile und kompakte Tabs behalten eine einheitliche Höhe;

![nav-sidebar-drive-current-tab](./public/changelog/assets/2.1.0/nav-sidebar-drive-current-tab.webp)

![current-directory-address-bar](./public/changelog/assets/2.1.0/current-directory-address-bar.webp)

#### Tastenkürzel-Verwaltung

Bei der Bearbeitung von Tastenkürzeln werden Konflikte und Anpassungen jetzt übersichtlicher behandelt.

- **Mehrere Tastenbelegungen**: einer Aktion mehrere Tastenkürzel zuweisen;
- **Belegungen aufheben**: die Zuweisung von Tastenkürzeln aufheben;
- **Konflikt ersetzen**: ein kollidierendes Tastenkürzel direkt über die Konfliktmeldung ersetzen;
- **Menü der Tastenkürzelliste**: Tastenkürzel über ein Kontextmenü in der Tastenkürzelliste verwalten;

![shortcut-editor](./public/changelog/assets/2.1.0/shortcut-editor.webp)

#### Drag-and-drop

Beim Ziehen kann jetzt mit `Alt+Tab` zu einer anderen App gewechselt werden. Dateien lassen sich dadurch aus Sigma File Manager herausziehen, ohne dass der Mauszeiger das Fenster verlassen muss;

### UI-Verbesserungen

- **Auswahlring**: Deckkraft und Versatz des Auswahlrings sowie die Darstellung der Bereichskopfzeile und das Verhalten des Tastaturfokus verbessert;
- **Tab-Leiste**: Darstellung der Tab-Leiste und Lesbarkeit des aktiven Tabs verbessert;
- **Theme-Auswahl**: verbessertes Design der Theme-Auswahl;
- **Schnellzugriff**: Darstellung des Schnellzugriffspanels verfeinert;
- **Startbildschirm**: beim App-Start wird jetzt ein Startbildschirm angezeigt;
- **Sichtbarkeit von Einblendmenüs**: Sichtbarkeit durchscheinender Elemente in Einblendmenüs verbessert;
- **Tooltips**: Tooltips zu weiteren Symbolleistenschaltflächen hinzugefügt;
- **Übersetzungen**: japanische und vietnamesische Texte verbessert und Lokalisierungsstruktur bereinigt;

![selection-ring](./public/changelog/assets/2.1.0/selection-ring.webp)

![tab-bar-styles](./public/changelog/assets/2.1.0/tab-bar-styles.webp)

![narrow-window-layout](./public/changelog/assets/2.1.0/narrow-window-layout.webp)

### Fehlerbehebungen

- **Zugeordnete Laufwerke**: Drag-and-drop aus zugeordneten Netzwerklaufwerken funktioniert wieder;
- **Scrollen mit der Tastatur**: die erste Zeile wird nicht mehr von der fixierten Kopfzeile verdeckt;
- **Einfrieren beim Start**: seltenes, mehrere Minuten langes Einfrieren unter Windows behoben, das durch langsame synchrone Systemaufrufe beim Start und bei Update-Prüfungen verursacht wurde;
- **Archivextraktion**: Unix-Dateimodi beim Extrahieren von Archiven beibehalten;
- **HTTP für Erweiterungen**: Verarbeitung dauerhaft fehlschlagender Nicht-2xx-Antworten wiederhergestellt und Wartezeiten vor erneuten Versuchen abbrechbar gemacht;
- **Befehlspalette**: Schaltfläche der Befehlspalette in der Symbolleiste bei geändertem Tastenkürzel korrigiert;
- **Raster-Bereichsauswahl**: die Bereichsauswahl in der Rasteransicht wählt keine Einträge über den ausgewählten Bereich hinaus mehr aus;
- **Kontextmenüs**: Kontextmenüs für ausgewähltes Element und aktuelles Verzeichnis bleiben nach Aktionsklicks nicht mehr offen;
- **Tastenkürzel-Registrierung**: Fehler bei der Registrierung von Tastenkürzeln nach dem Neuladen eines Fensters behoben;
- **Theme-Anwendung**: ausgewählte Themes werden in allen Fenstern angewendet;
- **Verschieben unter macOS**: Verarbeitung von Verschiebungen zwischen Volumes unter macOS korrigiert und Bundle-Ziele aktiviert;
- **Standard-Dateimanager**: vorherige Windows-Registry-Werte des Standard-Dateimanagers werden jetzt sicherer wiederhergestellt, wenn die Aktivierung fehlschlägt;

![keyboard-scroll-floating-header](./public/changelog/assets/2.1.0/keyboard-scroll-floating-header.webp)

---
## [2.0.0-beta.3] - April 2026

**Zusammenfassung:** Erweiterungssystem mit Marketplace, Dateifreigabe im lokalen Netzwerk, Schnellzugriffsmenü, Zip-Archive, WSL-Laufwerke, Tag-Bearbeitung, verbesserter Schnellansicht und Suche, Verbesserungen der visuellen Effekte sowie zahlreiche UX- und Stabilitätsverbesserungen.

- [Neue Funktionen](#neue-funktionen)
  - [Erweiterungssystem](#erweiterungssystem)
  - [Standard-Dateimanager](#standard-dateimanager)
  - [Freigabe im lokalen Netzwerk](#freigabe-im-lokalen-netzwerk)
  - [Schnellzugriffsmenü](#schnellzugriffsmenü)
  - [Zip-Archive](#zip-archive)
  - [WSL-Laufwerkserkennung](#wsl-laufwerkserkennung)
  - [Tag-Bearbeitung](#tag-bearbeitung)
  - [In-App-Updates](#in-app-updates)
  - [Pfad kopieren](#pfad-kopieren)
  - [Doppelte Tabs schließen](#doppelte-tabs-schließen)
  - [Kontextmenüs für Startseite und Dashboard](#kontextmenüs-für-startseite-und-dashboard)
  - [Mischmodus für visuelle Effekte](#mischmodus-für-visuelle-effekte)
- [Neue Einstellungen](#neue-einstellungen)
- [Neue Tastenkürzel](#neue-tastenkürzel)
- [Neue Sprachen](#neue-sprachen)
- [UX-Verbesserungen](#ux-verbesserungen)
  - [Verbesserungen der Schnellansicht](#verbesserungen-der-schnellansicht)
  - [Verbesserungen der Schnellsuche](#verbesserungen-der-schnellsuche)
  - [Dateioperationen](#dateioperationen)
  - [Visuelle Effekte](#visuelle-effekte)
- [UI-Verbesserungen](#ui-verbesserungen)
- [Fehlerbehebungen](#fehlerbehebungen)

### Neue Funktionen

#### Erweiterungssystem

Vollständiges Erweiterungssystem mit offenem Marketplace.

- **Marketplace**: Erweiterungen aus dem Marketplace durchsuchen, installieren und verwalten;
- **Lokale Installation**: Sie können Erweiterungen aus einem lokalen Ordner installieren;
- **Befehlspalette**: neue Möglichkeit, App- und Erweiterungsbefehle zu aktivieren;
- **Funktionen**: Erweiterungen können lokale und globale Tastenkürzel, Kontextmenüelemente, Einstellungen, ganze Seiten und Befehle registrieren;
- **Versionierung**: Sie können verschiedene Versionen von Erweiterungen installieren und automatische Updates aktivieren;
- **Lokalisierung**: Erweiterungen können Übersetzungen für verschiedene Sprachen bereitstellen;
- **Binärverwaltung**: Erweiterungen können Binärdateien verwenden (ffmpeg, deno, node, yt-dlp, 7z und jede andere existierende Binärdatei);
- **Isolierte Ausführung**: Erweiterungen laufen in isolierten ESM-Sandboxen mit granularen Berechtigungen;

#### Standard-Dateimanager

Sie können SFM jetzt unter Windows als Standard-Dateimanager festlegen (`Einstellungen > Experimentell`). Wenn diese Einstellung aktiviert ist, werden die meisten Systemdateiaktionen an SFM weitergeleitet:

- Datei-Explorer App-Symbol;
- Tastenkürzel `Ctrl+E`;
- Datei im Ordner anzeigen;
- Downloads anzeigen (wenn Sie eine Datei im Browser herunterladen);
- Terminal-Befehle: "start {Pfad}", "code {Pfad}", etc.
- Und mehr;

Native Systemansichten wie „Papierkorb", „Systemsteuerung" und andere tief integrierte Programme werden an den nativen Datei-Explorer delegiert.

#### Freigabe im lokalen Netzwerk

Teilen und streamen Sie Dateien und Verzeichnisse über Ihr lokales Netzwerk direkt aus der App.

Greifen Sie auf die LAN-Freigabe über die Schaltfläche in der Symbolleiste des Navigators oder über das Kontextmenü einer beliebigen Datei oder eines Verzeichnisses zu. Wenn eine Freigabe aktiv ist, werden ein QR-Code und teilbare URLs angezeigt. Zwei Modi sind verfügbar:

- **Streaming**: Dateien und Verzeichnisse auf jedes Gerät in Ihrem Netzwerk über einen Webbrowser streamen;
- **FTP**: Dateien über FTP für den direkten Zugriff aus anderen Apps freigeben. Sie können sowohl Dateien vom und zum Computer von einem anderen Gerät herunterladen als auch hochladen;

#### Schnellzugriffsmenü

Die Schaltfläche „Dashboard" in der Seitenleiste fungiert jetzt als Schnellzugriffsmenü. Wenn Sie darüber fahren, öffnet sich ein Panel mit Ihren Favoriten und markierten Elementen.

Alle Elemente im Panel sind echte Verzeichniseinträge – Sie können Elemente per Drag & Drop verschieben, Kontextmenüs per Rechtsklick öffnen und alle Standard-Dateioperationen durchführen.

Kann deaktiviert werden unter `Einstellungen > Erscheinungsbild > Schnellzugriffspanel beim Überfahren öffnen`.

#### Zip-Archive

Komprimieren und extrahieren Sie Zip-Archive direkt aus dem Aktionsmenü des Dateibrowsers:

- **Extrahieren**: eine `.zip`-Datei in das aktuelle Verzeichnis oder in einen benannten Ordner extrahieren;
- **Komprimieren**: ausgewählte Dateien und Verzeichnisse in ein `.zip`-Archiv komprimieren;

#### WSL-Laufwerkserkennung

Unter Windows erkennt die App jetzt automatisch installierte WSL-Distributionen und zeigt deren Laufwerke im Navigator an, sodass Sie WSL-Dateisysteme nativ durchsuchen können.

#### Tag-Bearbeitung

Sie können jetzt Tag-Namen und -Farben bearbeiten. Öffnen Sie den Tag-Selektor bei einer beliebigen Datei oder einem Verzeichnis, um Tags umzubenennen, ihre Farbe zu ändern oder sie zu löschen.

#### In-App-Updates

Sie können jetzt Updates direkt aus der Update-Benachrichtigung herunterladen und installieren, ohne die App zu verlassen.

#### Pfad kopieren

Option „Pfad kopieren" zum Kontextmenü von Dateien und Verzeichnissen hinzugefügt.

#### Doppelte Tabs schließen

Die Möglichkeit hinzugefügt, doppelte Tabs aus der Tab-Leiste zu schließen, wobei alle Tabs entfernt werden, die auf dasselbe Verzeichnis verweisen.

#### Kontextmenüs für Startseite und Dashboard

Elemente auf der Startseite und dem Dashboard haben jetzt vollständige Kontextmenüs, die der Funktionalität im Navigator entsprechen.

### Neue Einstellungen

- **Startseiten-Medienbanner anzeigen**: Medienbanner der Startseite ein- oder ausblenden (`Einstellungen > Erscheinungsbild > Medienbanner der Startseite`);
- **Tooltip-Verzögerung**: Verzögerung vor dem Erscheinen von Tooltips konfigurieren (`Einstellungen > Erscheinungsbild > Tooltips`);
- **Relative Zeit**: kürzliche Zeitstempel im relativen Format anzeigen, z.B. „vor 5 Min." (`Einstellungen > Allgemein > Datum / Uhrzeit`);
- **Datums- und Zeitformat**: Monatsformat, regionales Format, 12-Stunden-Uhr, Sekunden und Millisekunden konfigurieren (`Einstellungen > Allgemein > Datum / Uhrzeit`);
- **Dialog-Hintergrundunschärfe**: Unschärfeintensität für Dialog-Hintergründe festlegen (`Einstellungen > Erscheinungsbild > Stileinstellungen`);
- **Helligkeits- und Kontrastfilter**: Helligkeits- und Kontraststilfilter für die App-Oberfläche anpassen (`Einstellungen > Erscheinungsbild > Stileinstellungen`);
- **Medienhelligkeit der Überlagerung**: Helligkeit der visuellen Effekte-Überlagerungsmedien anpassen (`Einstellungen > Erscheinungsbild > Visuelle Effekte`);
- **Mischmodus für visuelle Effekte**: Mischmodus für visuelle Effekte anpassen, mit dem Sie wählen können, wie Hintergrundmedien mit der App-Oberfläche verschmelzen (`Einstellungen > Erscheinungsbild > Visuelle Effekte`);
- **Hintergrundvideo pausieren**: Startseiten-Banner und Hintergrundvideo pausieren, wenn die App inaktiv oder minimiert ist (`Einstellungen > Erscheinungsbild > Visuelle Effekte`);
- **Standard-Dateimanager**: Sigma File Manager als Standard-Dateiexplorer unter Windows festlegen (`Einstellungen > Experimentell`);
- **Beim Systemstart starten**: die App automatisch beim Anmelden am System starten (`Einstellungen > Allgemein > Startverhalten`);

### Neue Tastenkürzel

- **Aktuellen Verzeichnispfad kopieren** (`Ctrl+Shift+C`): den Pfad des aktuellen Verzeichnisses in die Zwischenablage kopieren;
- **Aktuelles Verzeichnis neu laden** (`F5`): die Dateiliste des Navigators aktualisieren;
- **Vergrößern / Verkleinern** (`Ctrl+=` / `Ctrl+-`): UI-Zoom vergrößern oder verkleinern;
- **Vollbild** (`F11`): Vollbildmodus umschalten;

### Neue Sprachen

- **Hindi**;
- **Urdu**;

### UX-Verbesserungen

#### Verbesserungen der Schnellansicht

- **Mediennavigation**: zwischen Dateien im aktuellen Verzeichnis navigieren, ohne die Schnellansicht zu schließen;
- **Textdateivorschau**: verbesserte Textdateivorschau mit korrekter Kodierungserkennung, Inline-Bearbeitung und gerendertem Markdown;

#### Verbesserungen der Schnellsuche

- **Alle Eigenschaften**: nach jeder Dateieigenschaft suchen – Name, Größe, Elementanzahl, Geändert, Erstellt, Zugegriffen, Pfad oder MIME-Typ (z.B. `modified: today`, `mime: image`);
- **Größenbereiche**: nach Größe filtern mit Vergleichen und Bereichen (z.B. `size: >=2mb`, `size: 1mb..10mb`);

#### Dateioperationen

- **Sicherheit bei Konfliktlösung**: verbesserte Dateisicherheit im Konfliktlösungsmodal zur Vermeidung versehentlichen Datenverlusts;
- **Einmaliges Einfügen**: kopierte Elemente können nur einmal eingefügt werden, um versehentliches doppeltes Einfügen zu verhindern;
- **Text kopieren**: Kopieren von UI-Text mit `Ctrl+C` erlauben, wenn keine Dateien ausgewählt sind;

#### Visuelle Effekte

- **Hintergrund-Manager**: Hintergrund-Manager zur Einstellungsseite für zentrale Hintergrundanpassung hinzugefügt;
- **Zurücksetzen der Hintergrundeffekte**: Zurücksetzungsschaltfläche in den Hintergrundeffekt-Einstellungen hinzugefügt;

#### Sonstiges

- **App-Größenreduzierung**: App-Bundle-Größe durch Ausschluss hochauflösender integrierter Hintergründe und Verwendung komprimierter Vorschauen im Medienbanner-Editor reduziert;
- **Globale Suche**: Schaltfläche „Einstellungen anzeigen" im Leerzustand anzeigen und Standard-Suchtiefe erhöht;
- **Windows-Verknüpfungen**: `.lnk`-Dateien öffnen jetzt ihr Ziel im Navigator, anstatt extern gestartet zu werden;
- **Dashboard**: verbessertes Layout des Tag-Bereichs;
- **Adressleisten-Kontextmenü**: Kontextmenü zu Adressleisten-Elementen hinzugefügt;
- **Navigator-Kontextmenü**: Kontextmenü beim Klicken auf leere Fläche im Navigator anzeigen;
- **In neuem Tab öffnen**: Verzeichnisse mit mittlerem Mausklick in einem neuen Tab öffnen;
- **Tab-Scrollen**: neu hinzugefügte Tabs automatisch in den sichtbaren Bereich scrollen;
- **Menüfokus**: Menüs geben den Fokus nicht mehr an ihre Auslöserschaltfläche zurück, wenn sie durch Klick außerhalb geschlossen werden;
- **Suche schließen**: globale Suche mit `Escape` schließen;
- **Schnellerer Start**: App-Startgeschwindigkeit durch Vorladen der Einstellungen in Rust leicht verbessert;
- **Benutzerverzeichnisse**: Möglichkeit zum Hinzufügen und Entfernen von Benutzerverzeichnissen auf der Startseite hinzugefügt;
- **Listenlimits**: Limits für häufig verwendete Einträge und Verlaufseinträge zur Leistungsverbesserung verringert;

### UI-Verbesserungen

- **Symbolleisten-Icons**: einheitliche Symbolleisten-Icon-Farben in der gesamten App;
- **Kartenanimationen**: gestaffelte Einblend- und Überblendeffekte für Karten hinzugefügt;
- **Helles Design**: verbesserte Farben und Kontrast des hellen Designs;
- **Startstabilität**: verbesserte visuelle Stabilität beim App-Start zur Reduzierung von Flackern;
- **Benachrichtigungen**: verbessertes Benachrichtigungsdesign für bessere Konsistenz;
- **Tab-Auto-Scroll**: automatisches Scrollen des ausgewählten Tabs in den sichtbaren Bereich beim Öffnen der Navigator-Seite;
- **Stammverzeichnis-Labels**: normalisierte Stammverzeichnis-Labels in Tabs und Informationspanel;
- **Übersetzungen**: verbesserte Übersetzungen in der gesamten App;

### Fehlerbehebungen

- Einfrieren der Oberfläche beim Kopieren oder Verschieben vieler Elemente behoben; Dateioperationsfortschritt zum Statuscenter hinzugefügt;
- Einfrieren der Oberfläche beim Löschen vieler Elemente behoben; Löschfortschritt zum Statuscenter hinzugefügt;
- Kontextmenü im Rasterlayout, das sich nicht für das aktuelle Verzeichnis öffnete, wenn ein anderes Element bereits ein Menü geöffnet hatte, behoben;
- Informationspanel, das nicht alle Informationen für das aktuelle Verzeichnis anzeigte, behoben;
- App-Tastenkürzel, die im Schnellansichtsfenster statt nur im Hauptfenster registriert wurden, behoben;
- Dateien, die aus Webbrowsern gezogen wurden und nicht verarbeitet wurden, behoben;
- Dateinamen aus externen URL-Drops, die keine gültigen Segmente beibehielten, behoben;
- Verschiebbares Startseiten-Banner behoben;
- Systemicon-Cache, der nicht nach Dateipfad indiziert war und falsche Icons verursachte, behoben;
- Unzugängliche Windows-Stammeinträge, die im Navigator angezeigt wurden, behoben;
- Benutzerdefinierte Tastenkürzel, die bei manchen Tastaturlayouts nicht erkannt wurden, behoben;
- SSHFS-Verbindungen unter Linux behoben;
- Adressleiste, die beim Klick auf Brotkrümel doppelte Verlaufseinträge erstellte, behoben;
- Globale Suchergebnisse, die nicht auf Tastaturnavigation reagierten, behoben;
- Globale Suchergebnisse, die sich beim Klicken nicht öffneten, behoben;
- Globaler Suchstatus, der nach inkrementeller Indexierung nicht synchronisiert wurde, behoben;
- Ausgehender Datei-Drag-and-Drop, der in einigen Anwendungen nicht funktionierte, behoben;
- Inkonsistentes Tastenkürzel-Badge-Design in der gesamten App behoben;
- Navigator-Spaltensichtbarkeit in schmalen Bereichen behoben;

---

## [2.0.0-beta.2] - February 2026

**Zusammenfassung:** Globale Tastenkürzel, neue Einstellungen, neue Funktionen, verbesserte Dateifilterung, verbesserte Adressleiste, Verbesserungen des Startseiten-Banners und Fehlerbehebungen.

### Globale Tastenkürzel

Sie können jetzt Tastenkürzel verwenden, um mit der App zu interagieren, auch wenn sie nicht im Fokus ist.

Hinzugefügte Tastenkürzel:

- `Win+Shift+E` zum Anzeigen und Fokussieren des App-Fensters;

### Neue Einstellungen

Einstellung hinzugefügt, um zu wählen, was passiert, wenn der letzte Tab geschlossen wird.

![Einstellung letzten Tab schließen](./public/changelog/assets/beta-2/setting-close-last-tab.png)

### Neue Funktionen

Neue Funktionen als frühe Vorschau hinzugefügt:

- Netzwerkorte: ermöglicht das Verbinden eines Netzwerkorts (SSHFS (SSH) / NFS / SMB / CIFS);
- [Linux] Laufwerke einbinden: ermöglicht das Aushängen von Orten;

### Dateifilter

Der Dateifilter wurde verbessert:
- Beim Verzeichniswechsel wird er jetzt automatisch geleert und geschlossen;
- Die Funktion „Filtern beim Tippen" aktiviert sich im ausgewählten Bereich, nicht im ersten;

### Adressleiste

- Verbessertes Design und Autovervollständigungslogik;
- Die Pfadtrenner sind jetzt Dropdown-Menüs, die eine schnelle Navigation zu jedem übergeordneten Verzeichnis ermöglichen;

![Trenner-Menüs](./public/changelog/assets/beta-2/divider-menus.png)

### Startseiten-Banner / Hintergrundeffekte

- Verbessertes Design des Medienbanner-Editors:
  - Das Optionsmenü des Medienbanners öffnet sich jetzt nach unten, um die Ansicht nicht zu verdecken;
  - Sie können jetzt außerhalb klicken, um den Hintergrundpositionseditor zu schließen;
  - URL-Eingabe über benutzerdefinierte Hintergründe verschoben;
- Benutzerdefinierte Bilder/Videos können in visuellen Hintergrundeffekten verwendet werden;
- Einige Standard-Medienbanner-Bilder entfernt;
- Neues Bannerbild „Exile by Aleksey Hoffman" hinzugefügt;

### UX-Verbesserungen

- App stellt die vorherige Fensterposition beim Start wieder her;
- Der aktuelle Tab kann jetzt mit dem Tastenkürzel `Ctrl+W` oder mittlerem Mausklick geschlossen werden;
- Datei-Icon-Größe in der Rasteransicht erhöht;

### Fehlerbehebungen

- Verschieben von Dateien zwischen Tabs, das sie manchmal an den falschen Ort verschob, behoben;
- Navigator, der manchmal falsche System-Icons für Verzeichnisse anzeigte, behoben;
- Erstellung mehrerer App- und Tray-Instanzen behoben;
- Shell-Erweiterungsmenü, das Daten periodisch neu abrief und die Liste ständig nach oben scrollte, behoben;

## [2.0.0-beta.1] - February 2026

**Zusammenfassung:** Wichtige Verbesserungen der Benutzerfreundlichkeit und des Designs, einschließlich Tastaturnavigation, neuer Tastenkürzel, Öffnen im Terminal, automatischer Verzeichnisaktualisierung, Drag & Drop sowie verbesserter Suche und Listenansichten.

### Tastaturnavigation

Navigieren Sie durch Dateien mit der Tastatur mit voller Unterstützung für Raster- und Listenlayouts sowie geteilte Ansicht.

- Pfeiltasten für räumliche Navigation in der Rasteransicht und sequentielle Navigation in der Listenansicht;
- Enter zum Öffnen des ausgewählten Verzeichnisses oder der Datei, Backspace zum Zurücknavigieren;
- Ctrl+Left / Ctrl+Right zum Wechseln des Fokus zwischen den Bereichen der geteilten Ansicht;
- Ctrl+T zum Öffnen des aktuellen Verzeichnisses in einem neuen Tab;
- Alle Navigations-Tastenkürzel sind konfigurierbar unter Einstellungen > Tastenkürzel;

### Automatische Verzeichnisaktualisierung

Die Navigatoransicht wird automatisch aktualisiert, wenn Dateien im aktuellen Verzeichnis erstellt, gelöscht, umbenannt oder geändert werden.

- Dateigrößen werden automatisch aktualisiert, wenn sie von externen Anwendungen geändert werden;
- Effiziente Dateisystemüberwachung mit Debouncing zur Vermeidung übermäßiger Aktualisierungen;
- Intelligente differenzbasierte Aktualisierungen ändern nur betroffene Elemente und erhalten Scrollposition und Auswahl;

### Drag & Drop

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/beta-1/drag-and-drop.mp4"></video>

Sie können jetzt Dateien und Ordner per Drag & Drop kopieren/verschieben. Ziehen Sie zwischen Bereichen, aus oder in Suchergebnislisten, aus oder in externe Anwendungen.

### Kopierkonflikte

Modales Fenster zur einfachen Kopier-/Verschiebekonfliktlösung hinzugefügt.

### Automatische Updates

Automatische Update-Prüfung hinzugefügt (kann in den Einstellungen gesteuert werden).

### Startseiten-Medienbanner-Editor

Editor zur Anpassung des Startseiten-Banners hinzugefügt. Sie können jetzt benutzerdefinierte Bilder und Videos hochladen (sowohl lokale als auch Remote-URL-Dateien werden unterstützt).

### Verbesserungen der Listenansicht

- Verbessertes Design und kleine Ärgernisse behoben;
- Spalten-Sichtbarkeitsanpassung hinzugefügt: wählen Sie, welche Spalten angezeigt werden;
- Spaltensortierung hinzugefügt: klicken Sie auf Spaltenüberschriften, um Einträge zu sortieren;
- Standardlayout des Navigators auf Listenansicht geändert;

### Verbesserungen der globalen Suche

- Aktualisiertes Layout und Design mit Drag-and-Drop-Unterstützung;
- Suche ist jetzt verfügbar, während Laufwerke noch indexiert werden;

### Im Terminal öffnen

Öffnen Sie Verzeichnisse direkt aus dem Kontextmenü in Ihrem bevorzugten Terminal.

- Automatische Erkennung installierter Terminals unter Windows, macOS und Linux;
- Windows Terminal zeigt alle konfigurierten Shell-Profile mit Programm-Icons;
- Linux-Standardterminal wird automatisch erkannt und zuerst angezeigt;
- Enthält normale und Administrator-/erhöhte Modi;
- Standard-Tastenkürzel: Alt+T;

### Lokalisierung

- Slowenische Sprache hinzugefügt (Dank an: @anderlli0053);

### UI- / UX-Verbesserungen

- Schriftartauswahl hinzugefügt: wählen Sie die UI-Schriftart aus installierten Systemschriftarten;
- Menü „Neu erstellen" zum schnellen Erstellen von Dateien oder Verzeichnissen hinzugefügt;
- Leerer Zustand wird beim Navigieren zu leeren Verzeichnissen angezeigt;
- Statusleiste zeigt Gesamtelemente mit versteckter Anzahl, wenn die Liste gefiltert ist;
- Neu erstellte, kopierte und verschobene Elemente werden automatisch in den sichtbaren Bereich gescrollt;
- Zwischenablage-Symbolleiste wird einmal unter den Bereichen angezeigt statt in jedem Bereich;
- Vereinfachtes Design des Umbenennen-Modals;
- Responsive Symbolleisten-Icons, die bei kleinen Fenstergrößen in ein Dropdown-Menü zusammenklappen;
- Leerer Tab „Navigation" aus den Einstellungen entfernt;
- Umbenennen eines Verzeichnisses aktualisiert jetzt seinen Pfad in allen Tabs, Arbeitsbereichen, Favoriten, Tags, Verlauf und häufig verwendeten Elementen;
- Löschen einer Datei oder eines Verzeichnisses entfernt es jetzt aus allen gespeicherten Listen und navigiert betroffene Tabs zur Startseite;
- Nicht existierende Pfade in Favoriten, Tags, Verlauf und häufig verwendeten Elementen werden jetzt beim Start automatisch bereinigt;

### Fehlerbehebungen

- Status der globalen Suchindexierung, der sich nicht in Echtzeit aktualisierte, behoben;
- Bereich der geteilten Ansicht, der sich nicht aktualisierte, wenn sein Verzeichnis vom anderen Bereich gelöscht oder umbenannt wurde, behoben;
- Tabs, die mit einem Fehler geladen wurden, wenn ihr gespeicherter Pfad nicht mehr existiert, behoben;
- System-Icons, die dasselbe Icon für alle Dateien desselben Typs anstelle eindeutiger Icons pro Datei anzeigten, behoben;
- Tastenkürzel, die im zweiten Bereich der geteilten Ansicht nicht funktionierten, behoben;
- Tastenkürzel, die nach Seitennavigation nicht mehr funktionierten, behoben;
- Speicherleck durch Filter-Keydown-Listener, die beim Unmount nicht bereinigt wurden, behoben;
- Linux: Unterstützung für die Ermittlung der Standardanwendung im „Öffnen mit"-Menü hinzugefügt;

---

## [2.0.0-alpha.6] - January 2026

**Zusammenfassung:** Neuigkeiten-Fenster, Schnellansicht, Kontextmenü-Verbesserungen und neue Einstellungen.

### Neuigkeiten-Fenster

Ein Änderungsprotokoll-Fenster, das neue Funktionen und Verbesserungen für jede Version anzeigt.

- Erscheint automatisch nach Updates (kann deaktiviert werden);
- Durch alle Versionen blättern;
- Detaillierte Beschreibungen und Screenshots für jede Funktion;

### Schnellansicht

Dateien ohne vollständiges Öffnen mit einem leichtgewichtigen Vorschaufenster vorschauen.

- Drücken Sie `Space` oder die Option „Schnellansicht" im Kontextmenü, um Dateien schnell anzuzeigen;
- Sofort schließen mit `Space` oder `Escape`.
- Unterstützt Bilder, Videos, Audio, Textdateien, PDFs und mehr;

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/alpha-6/quick-view.mp4"></video>

### Verzeichnisgrößenberechnung

- Die Größe von Verzeichnissen wird jetzt automatisch berechnet;
- Sie können die Gesamtgröße aller Verzeichnisse, einschließlich aller Unterverzeichnisse und Dateien, sehen, sobald Sie ein beliebiges Verzeichnis öffnen;

![Öffnen mit](./public/changelog/assets/alpha-6/size.png)

### Neue Kontextmenü-Optionen

#### Öffnen mit

- Wählen Sie, mit welcher Anwendung eine Datei geöffnet werden soll;
- Richten Sie benutzerdefinierte Vorlagen ein, um Dateien in Anwendungen mit Flags zu öffnen;
- Alle kompatiblen Anwendungen für jeden Dateityp anzeigen;
- Standardanwendungen für bestimmte Dateitypen festlegen;

![Öffnen mit](./public/changelog/assets/alpha-6/open-with.png)

#### Shell-Erweiterungen

- Zugriff auf Windows-Shell-Kontextmenüelemente;
- Zugriff auf Shell-Erweiterungen von Drittanbietern (7-Zip, Git, etc.);

![Shell-Erweiterungen](./public/changelog/assets/alpha-6/shell-extensions.png)

### Neue Einstellungen

#### Laufwerkserkennung

- Fokussiert die App, wenn Wechseldatenträger angeschlossen werden (kann deaktiviert werden);
- Steuern Sie das automatische Öffnungsverhalten des Windows-Explorers für Wechseldatenträger;

#### Filtern beim Tippen

Beginnen Sie an beliebiger Stelle im Navigator zu tippen, um Elemente im aktuellen Verzeichnis sofort zu filtern;

#### Tastenkürzel für Einstellungssuche

Neues Tastenkürzel für schnellen Zugriff auf die Einstellungssuche;

#### Benutzerstatistik-Daten

- Statistik-Einstellungsbereich hinzugefügt;
- Auf der Dashboard-Seite können Sie Verlauf, Favoriten und häufig verwendete Elemente anzeigen, navigieren und löschen;

### Verbesserungen der Suche

Verbesserte globale Suche mit einem hybriden indexiert + direkt Suchsystem für zuverlässigere und aktuellere Ergebnisse.

- Suchen dauern jetzt konsistent weniger als 1 Sekunde (~1 TB vollständig gefülltes Laufwerk), unabhängig davon, wo sich die Dateien auf Ihren Laufwerken befinden;
- Wenn Sie in Ihren „Prioritätspfaden" (die Sie häufig öffnen) suchen, erhalten Sie Ergebnisse sofort und die Dateien werden gefunden, auch wenn sie gerade erst erstellt und noch nicht indexiert wurden.

#### Prioritätspfade umfassen:
- Benutzerverzeichnisse: Downloads, Dokumente, Desktop, Bilder, Videos, Musik;
- Favoriten;
- Kürzlich geöffnet;
- Häufig verwendet;
- Markiert;

---

## [2.0.0-alpha.5] - January 2026

**Zusammenfassung:** Dateioperationen, globale Suche und Tastenkürzel-Anpassung.

### Globale Suche

Leistungsstarke Volllaufwerksuche, die Dateien auf allen Ihren Laufwerken indexiert und durchsucht. Mit unscharfer Suche zum Finden von Dateien auch bei Tippfehlern, automatischer periodischer Neuindexierung, Prioritätsindexierung für häufig verwendete Verzeichnisse und optionalem parallelen Scannen für schnellere Indexierung.

![Globale Suche](./public/changelog/assets/alpha-5/search.png)

### Dateioperationen

Vollständige Unterstützung von Dateioperationen mit Kopieren, Verschieben und Löschen einschließlich Fortschrittsverfolgung. Enthält auch das direkte Umbenennen von Dateien und Ordnern.

### Tastenkürzel-Editor

Passen Sie alle Tastenkürzel in der App an. Aktuelle Zuweisungen anzeigen, Konflikte erkennen und auf Standardwerte zurücksetzen.

### Navigator-Verbesserungen

Option zum Anzeigen nativer System-Icons für Dateien und Verzeichnisse anstelle minimalistischer Glyphen hinzugefügt. Navigations-Tabs der Einstellungen bleiben jetzt beim Scrollen oben auf der Seite fixiert.

---

## [2.0.0-alpha.4] - January 2026

**Zusammenfassung:** Startseite, visuelle Effekte und Benutzeranpassungsoptionen.

### Startseite

Eine schöne Startseite mit einem animierten Medienbanner, Laufwerksliste und Schnellzugriff auf gängige Benutzerverzeichnisse wie Dokumente, Downloads, Bilder und mehr.

### Visuelle Effekte

Anpassbarer Bereich für visuelle Effekte in den Einstellungen, der Unschärfe-, Opazitäts- und Rauscheffekte zum App-Hintergrund hinzufügt. Unterstützt verschiedene Einstellungen für jede Seite.

### Benutzerverzeichnis-Editor

Passen Sie Ihre Benutzerverzeichnis-Karten mit benutzerdefinierten Titeln, Icons und Pfaden an. Personalisieren Sie, wie Ihre Schnellzugriffs-Verzeichnisse auf der Startseite erscheinen.

### Bannerposition-Editor

Feinabstimmung der Position Ihrer Startseiten-Banner-Hintergründe. Zoom, horizontale und vertikale Positionierung für den perfekten Look anpassen.

### Verbesserungen der Einstellungen

- Einstellungssuche funktioniert jetzt in jeder Sprache, nicht nur in der aktuellen;
- Die App stellt den zuletzt besuchten Einstellungs-Tab beim Neuladen wieder her, anstatt immer den ersten zu öffnen;

---

## [2.0.0-alpha.3] - December 2025

**Zusammenfassung:** Navigatoransicht mit Tabs, Arbeitsbereichen und einem neuen Designsystem.

### Navigatoransicht

Das zentrale Dateibrowser-Erlebnis mit einem modernen Tab-System mit Arbeitsbereichsunterstützung, einem neuen Fenstersymbolleisten-Design mit integrierten Steuerelementen und Doppelbereichsnavigation für effizientes Dateimanagement.

### Video-Miniaturansichten

Vorschau-Miniaturansichten für Videodateien im Navigator hinzugefügt.

### Migration des Designsystems

Die App wurde von Vuetify zu Sigma-UI migriert für ein großzügigeres, moderneres Design mit verbesserter Codequalität.

---

## [2.0.0-alpha.1] - January 2024

**Zusammenfassung:** Vollständige Neuentwicklung mit modernen Technologien.

### Tauri-Migration

Sigma File Manager v2 wurde von Grund auf mit Vue 3 Composition API, TypeScript und Tauri v2 neu aufgebaut. Die Installationsgröße der App wurde von 153 MB auf nur 4 MB unter Windows reduziert. Die installierte App-Größe wurde von 419 MB auf 12 MB reduziert.

### Anpassbare Bereiche

Funktion für anpassbare Bereiche hinzugefügt, mit der Sie die Navigatoransicht halbieren und mit 2 Verzeichnissen nebeneinander arbeiten können.

### Erste Funktionen

Grundlegende Dateinavigation mit Verzeichnisliste, Fensterverwaltung mit Minimieren-, Maximieren- und Schließen-Steuerelementen sowie eine anfängliche Einstellungsseiten-Struktur.
