# Änderungsprotokoll

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
