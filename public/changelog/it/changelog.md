# Registro delle modifiche

## [2.0.0-beta.3] - April 2026

**Riepilogo:** Sistema di estensioni con marketplace, condivisione file in rete locale, menu di accesso rapido, archivi zip, unità WSL, modifica delle etichette, miglioramenti dell'anteprima rapida e della ricerca, miglioramenti degli effetti visivi e molti miglioramenti UX e di stabilità.

- [Nuove funzionalità](#nuove-funzionalità)
  - [Sistema di estensioni](#sistema-di-estensioni)
  - [Gestore file predefinito](#gestore-file-predefinito)
  - [Condivisione in rete locale](#condivisione-in-rete-locale)
  - [Menu di accesso rapido](#menu-di-accesso-rapido)
  - [Archivi Zip](#archivi-zip)
  - [Rilevamento unità WSL](#rilevamento-unità-wsl)
  - [Modifica delle etichette](#modifica-delle-etichette)
  - [Aggiornamenti integrati](#aggiornamenti-integrati)
  - [Copia percorso](#copia-percorso)
  - [Chiudi schede duplicate](#chiudi-schede-duplicate)
  - [Menu contestuali Home e Dashboard](#menu-contestuali-home-e-dashboard)
  - [Modalità di fusione degli effetti visivi](#modalità-di-fusione-degli-effetti-visivi)
- [Nuove impostazioni](#nuove-impostazioni)
- [Nuove scorciatoie](#nuove-scorciatoie)
- [Nuove lingue](#nuove-lingue)
- [Miglioramenti UX](#miglioramenti-ux)
  - [Miglioramenti dell'anteprima rapida](#miglioramenti-dellanteprima-rapida)
  - [Miglioramenti della ricerca rapida](#miglioramenti-della-ricerca-rapida)
  - [Operazioni sui file](#operazioni-sui-file)
  - [Effetti visivi](#effetti-visivi)
- [Miglioramenti dell'interfaccia](#miglioramenti-dellinterfaccia)
- [Correzioni di bug](#correzioni-di-bug)

### Nuove funzionalità

#### Sistema di estensioni

Sistema di estensioni completo con marketplace aperto.

- **Marketplace**: sfoglia, installa e gestisci le estensioni dal marketplace;
- **Installazione locale**: puoi installare estensioni da una cartella locale;
- **Palette dei comandi**: nuovo modo per attivare i comandi dell'app e delle estensioni;
- **Capacità**: le estensioni possono registrare scorciatoie locali e globali, voci del menu contestuale, impostazioni, pagine intere e comandi;
- **Versionamento**: puoi installare diverse versioni delle estensioni e abilitare l'aggiornamento automatico;
- **Localizzazione**: le estensioni possono fornire traduzioni per diverse lingue;
- **Gestione dei binari**: le estensioni possono utilizzare binari (ffmpeg, deno, node, yt-dlp, 7z e qualsiasi altro binario esistente);
- **Esecuzione isolata**: le estensioni vengono eseguite in sandbox ESM isolate con permessi granulari;

#### Gestore file predefinito

Ora puoi impostare SFM come gestore file predefinito su Windows (`Impostazioni > Sperimentale`). Quando questa impostazione è abilitata, la maggior parte delle azioni di sistema sui file verrà instradata verso SFM:

- Icona dell'app Esplora file;
- Scorciatoia `Ctrl+E`;
- Mostra file nella cartella;
- Mostra download (quando scarichi un file nel browser);
- Comandi del terminale: "start {path}", "code {path}", ecc.
- E altro ancora;

Le viste di sistema native come il "Cestino", il "Pannello di controllo" e altri programmi profondamente integrati vengono delegati all'Esplora file nativo.

#### Condivisione in rete locale

Condividi e trasmetti file e directory sulla tua rete locale direttamente dall'app.

Accedi alla condivisione in rete locale dal pulsante della barra degli strumenti nel navigatore o dal menu contestuale su qualsiasi file o directory. Quando una condivisione è attiva, vengono visualizzati un codice QR e URL condivisibili. Sono disponibili due modalità:

- **Trasmissione**: trasmetti file e directory a qualsiasi dispositivo sulla tua rete tramite un browser web;
- **FTP**: condividi file tramite FTP per l'accesso diretto da altre app. Puoi sia scaricare che caricare file da e verso il computer da un altro dispositivo;

#### Menu di accesso rapido

Il pulsante "Dashboard" nella barra laterale ora funziona come menu di accesso rapido. Passando il mouse sopra di esso si apre un pannello che mostra i tuoi Preferiti e gli elementi Etichettati.

Tutti gli elementi nel pannello sono vere voci di directory — puoi trascinare e rilasciare elementi dentro e fuori, aprire menu contestuali con il clic destro ed eseguire qualsiasi operazione standard sui file.

Può essere disabilitato in `Impostazioni > Aspetto dell'interfaccia > Apri il pannello di accesso rapido al passaggio del mouse`.

#### Archivi Zip

Comprimi ed estrai archivi zip direttamente dal menu delle azioni del browser di file:

- **Estrai**: estrai un file `.zip` nella directory corrente o in una cartella con nome;
- **Comprimi**: comprimi i file e le directory selezionati in un archivio `.zip`;

#### Rilevamento unità WSL

Su Windows, l'app ora rileva automaticamente le distribuzioni WSL installate e visualizza le loro unità nel navigatore, permettendoti di sfogliare i file system WSL nativamente.

#### Modifica delle etichette

Ora puoi modificare i nomi e i colori delle etichette. Apri il selettore di etichette su qualsiasi file o directory per rinominare le etichette, cambiare il loro colore o eliminarle.

#### Aggiornamenti integrati

Ora puoi scaricare e installare gli aggiornamenti direttamente dalla notifica di aggiornamento senza uscire dall'app.

#### Copia percorso

Aggiunta l'opzione "Copia percorso" al menu contestuale di file e directory.

#### Chiudi schede duplicate

Aggiunta la possibilità di chiudere le schede duplicate dalla barra delle schede, rimuovendo tutte le schede che puntano alla stessa directory.

#### Menu contestuali Home e Dashboard

Gli elementi nella pagina home e nel dashboard ora hanno menu contestuali completi, con le stesse funzionalità disponibili nel navigatore.

### Nuove impostazioni

- **Mostra banner multimediale della home**: mostra o nascondi il banner multimediale della pagina home (`Impostazioni > Aspetto dell'interfaccia > Banner multimediale della pagina home`);
- **Ritardo dei suggerimenti**: configura il ritardo prima della comparsa dei suggerimenti (`Impostazioni > Aspetto dell'interfaccia > Suggerimenti`);
- **Tempo relativo**: visualizza i timestamp recenti in formato relativo, ad es. "5 min fa" (`Impostazioni > Generale > Data / ora`);
- **Formato data e ora**: configura il formato del mese, il formato regionale, l'orologio a 12 ore, i secondi e i millisecondi (`Impostazioni > Generale > Data / ora`);
- **Sfocatura dello sfondo dei dialoghi**: imposta l'intensità della sfocatura per lo sfondo dei dialoghi (`Impostazioni > Aspetto dell'interfaccia > Impostazioni di stile`);
- **Filtri di luminosità e contrasto**: regola i filtri di stile di luminosità e contrasto per l'interfaccia dell'app (`Impostazioni > Aspetto dell'interfaccia > Impostazioni di stile`);
- **Luminosità del media in sovrapposizione**: regola la luminosità del media in sovrapposizione degli effetti visivi (`Impostazioni > Aspetto dell'interfaccia > Effetti visivi`);
- **Modalità di fusione degli effetti visivi**: regola la modalità di fusione per gli effetti visivi, permettendoti di scegliere come il media di sfondo si fonde con l'interfaccia dell'app (`Impostazioni > Aspetto dell'interfaccia > Effetti visivi`);
- **Metti in pausa il video di sfondo**: metti in pausa il banner della home e il video di sfondo quando l'app è inattiva o ridotta a icona (`Impostazioni > Aspetto dell'interfaccia > Effetti visivi`);
- **Gestore file predefinito**: imposta Sigma File Manager come esplora file predefinito su Windows (`Impostazioni > Sperimentale`);
- **Avvio all'accesso al sistema**: avvia automaticamente l'app quando accedi al tuo sistema (`Impostazioni > Generale > Comportamento all'avvio`);

### Nuove scorciatoie

- **Copia il percorso della directory corrente** (`Ctrl+Shift+C`): copia il percorso della directory corrente negli appunti;
- **Ricarica la directory corrente** (`F5`): aggiorna l'elenco dei file del navigatore;
- **Zoom avanti / indietro** (`Ctrl+=` / `Ctrl+-`): aumenta o diminuisci lo zoom dell'interfaccia;
- **Schermo intero** (`F11`): attiva/disattiva la modalità schermo intero;

### Nuove lingue

- **Hindi**;
- **Urdu**;

### Miglioramenti UX

#### Miglioramenti dell'anteprima rapida

- **Navigazione multimediale**: naviga tra i file nella directory corrente senza chiudere l'anteprima rapida;
- **Anteprima dei file di testo**: anteprima migliorata dei file di testo con rilevamento corretto della codifica, modifica in linea e rendering del markdown;

#### Miglioramenti della ricerca rapida

- **Tutte le proprietà**: cerca per qualsiasi proprietà del file — nome, dimensione, conteggio elementi, modificato, creato, ultimo accesso, percorso o tipo MIME (ad es. `modified: today`, `mime: image`);
- **Intervalli di dimensione**: filtra per dimensione usando confronti e intervalli (ad es. `size: >=2mb`, `size: 1mb..10mb`);

#### Operazioni sui file

- **Sicurezza nella risoluzione dei conflitti**: migliorata la sicurezza dei file nella finestra di risoluzione dei conflitti per prevenire la perdita accidentale di dati;
- **Incolla monouso**: gli elementi copiati possono essere incollati solo una volta, prevenendo incollature duplicate accidentali;
- **Copia testo**: permette di copiare il testo dell'interfaccia con `Ctrl+C` quando nessun file è selezionato;

#### Effetti visivi

- **Gestore dello sfondo**: aggiunto gestore dello sfondo nella pagina delle impostazioni per una personalizzazione centralizzata dello sfondo;
- **Ripristino degli effetti di sfondo**: aggiunto un pulsante di ripristino per le impostazioni degli effetti di sfondo;

#### Altro

- **Riduzione delle dimensioni dell'app**: ridotte le dimensioni del bundle dell'app escludendo gli sfondi integrati ad alta risoluzione e utilizzando anteprime compresse nell'editor del banner multimediale;
- **Ricerca globale**: visualizzazione di un pulsante "mostra impostazioni" nello stato vuoto e aumentata la profondità di ricerca predefinita;
- **Scorciatoie Windows**: i file `.lnk` ora aprono il loro obiettivo nel navigatore invece di avviarsi esternamente;
- **Dashboard**: migliorato il layout della sezione etichettata;
- **Menu contestuale della barra degli indirizzi**: aggiunto menu contestuale agli elementi della barra degli indirizzi;
- **Menu contestuale del navigatore**: mostra il menu contestuale quando si clicca su un'area vuota del navigatore;
- **Apri in una nuova scheda**: apri le directory in una nuova scheda con il clic del pulsante centrale del mouse;
- **Scorrimento delle schede**: le schede appena aggiunte scorrono automaticamente per essere visibili;
- **Focus dei menu**: i menu non restituiscono più il focus al loro pulsante di attivazione quando vengono chiusi con un clic esterno;
- **Chiudi la ricerca**: chiudi la ricerca globale con `Escape`;
- **Avvio più veloce**: leggermente migliorata la velocità di avvio dell'app precaricando le impostazioni in Rust;
- **Directory utente**: aggiunta la possibilità di aggiungere e rimuovere directory utente nella pagina home;
- **Limiti delle liste**: diminuiti i limiti per le voci frequenti e della cronologia per migliorare le prestazioni;

### Miglioramenti dell'interfaccia

- **Icone della barra degli strumenti**: uniformati i colori delle icone della barra degli strumenti in tutta l'app;
- **Animazioni delle schede**: aggiunti effetti di sfalsamento e dissolvenza in entrata alle schede;
- **Tema chiaro**: migliorati i colori e il contrasto del tema chiaro;
- **Stabilità all'avvio**: migliorata la stabilità visiva durante l'avvio dell'app per ridurre lo sfarfallio;
- **Notifiche**: migliorato il design delle notifiche per una maggiore coerenza;
- **Scorrimento automatico delle schede**: scorrimento automatico della scheda selezionata per renderla visibile all'apertura della pagina del navigatore;
- **Etichette del percorso radice**: normalizzate le etichette del percorso radice nelle schede e nel pannello informazioni;
- **Traduzioni**: migliorate le traduzioni in tutta l'app;

### Correzioni di bug

- Corretto il blocco dell'interfaccia durante la copia o lo spostamento di molti elementi; aggiunto il progresso delle operazioni sui file al centro di stato;
- Corretto il blocco dell'interfaccia durante l'eliminazione di molti elementi; aggiunto il progresso dell'eliminazione al centro di stato;
- Corretto il menu contestuale nella vista a griglia che non si apriva per la directory corrente quando un altro elemento aveva già un menu aperto;
- Corretto il pannello informazioni che non mostrava tutte le informazioni per la directory corrente;
- Corrette le scorciatoie dell'app registrate sulla finestra di anteprima rapida invece che solo sulla finestra principale;
- Corretto il mancato trattamento dei file trascinati dai browser web;
- Corretti i nomi dei file dai rilasci di URL esterni che non mantenevano i segmenti validi;
- Corretto il banner della home che era trascinabile;
- Corretta la cache delle icone di sistema non indicizzata per percorso file, causando icone errate;
- Corrette le voci root di Windows inaccessibili visualizzate nel navigatore;
- Corrette le scorciatoie personalizzate non identificate su alcuni layout di tastiera;
- Corrette le connessioni SSHFS su Linux;
- Corretta la barra degli indirizzi che creava voci di cronologia duplicate al clic sul breadcrumb;
- Corretti i risultati della ricerca globale che non rispondevano alla navigazione da tastiera;
- Corretti i risultati della ricerca globale che non si aprivano al clic;
- Corretto lo stato della ricerca globale che non si sincronizzava dopo l'indicizzazione incrementale;
- Corretto il trascinamento dei file in uscita che non funzionava in alcune applicazioni;
- Corretto il design incoerente dei badge delle scorciatoie in tutta l'app;
- Corretta la visibilità delle colonne del navigatore nei pannelli stretti;

---

## [2.0.0-beta.2] - February 2026

**Riepilogo:** Scorciatoie globali, nuove impostazioni, nuove funzionalità, filtraggio dei file migliorato, barra degli indirizzi migliorata, miglioramenti del banner della home e correzioni di bug.

### Scorciatoie globali

Ora puoi usare le scorciatoie da tastiera per interagire con l'app anche quando non è in primo piano.

Scorciatoie aggiunte:

- `Win+Shift+E` per mostrare e mettere in primo piano la finestra dell'app;

### Nuove impostazioni

Aggiunta un'impostazione per scegliere cosa succede quando l'ultima scheda viene chiusa.

![Impostazione chiudi ultima scheda](./public/changelog/assets/beta-2/setting-close-last-tab.png)

### Nuove funzionalità

Aggiunte nuove funzionalità in anteprima:

- Posizioni di rete: permette di connettere una posizione di rete (SSHFS (SSH) / NFS / SMB / CIFS);
- [Linux] Montaggio unità: permette di smontare posizioni;

### Filtro dei file

Il filtro dei file è stato migliorato:
- Ora quando cambi directory, si svuota e si chiude automaticamente;
- La funzione "filtra durante la digitazione" si attiva nel pannello selezionato, non nel primo;

### Barra degli indirizzi

- Design migliorato e logica di auto-completamento;
- I divisori del percorso sono ora menu a tendina che forniscono una navigazione rapida verso qualsiasi directory padre;

![Menu dei divisori](./public/changelog/assets/beta-2/divider-menus.png)

### Banner della home / Effetti di sfondo

- Design migliorato dell'editor del banner multimediale:
  - Il menu delle opzioni del banner multimediale ora si apre verso il basso per evitare di oscurare la vista;
  - Ora puoi cliccare all'esterno per chiudere l'editor di posizione dello sfondo;
  - Il campo URL spostato sopra gli sfondi personalizzati;
- Le immagini/video personalizzati possono essere utilizzati negli effetti visivi di sfondo;
- Rimosse alcune immagini predefinite del banner multimediale;
- Aggiunta una nuova immagine del banner "Exile by Aleksey Hoffman";

### Miglioramenti UX

- L'app ripristina la posizione precedente della finestra all'avvio;
- La scheda corrente può ora essere chiusa con la scorciatoia `Ctrl+W` o con il clic del pulsante centrale del mouse;
- Aumentata la dimensione delle icone dei file nella vista a griglia;

### Correzioni di bug

- Corretto lo spostamento di file tra schede che a volte li spostava nella posizione sbagliata;
- Corretto il navigatore che a volte mostrava icone di sistema errate per le directory;
- Corretta la creazione di più istanze dell'app e della barra di sistema;
- Corretto il menu delle estensioni shell che recuperava i dati periodicamente, forzando la lista a scorrere sempre in cima;

## [2.0.0-beta.1] - February 2026

**Riepilogo:** Importanti miglioramenti di usabilità e design tra cui la navigazione da tastiera, nuove scorciatoie, apertura nel terminale, aggiornamento automatico delle directory, trascinamento e rilascio, e miglioramenti della ricerca e delle viste a lista.

### Navigazione da tastiera

Naviga tra i file usando la tastiera con supporto completo per layout a griglia e lista e vista divisa.

- Tasti freccia per la navigazione spaziale nella vista a griglia e navigazione sequenziale nella vista a lista;
- Invio per aprire la directory o il file selezionato, Backspace per tornare indietro;
- Ctrl+Sinistra / Ctrl+Destra per spostare il focus tra i pannelli della vista divisa;
- Ctrl+T per aprire la directory corrente in una nuova scheda;
- Tutte le scorciatoie di navigazione sono personalizzabili in Impostazioni > Scorciatoie;

### Aggiornamento automatico delle directory

La vista del navigatore si aggiorna automaticamente quando i file vengono creati, eliminati, rinominati o modificati nella directory corrente.

- Le dimensioni dei file si aggiornano automaticamente quando vengono modificate da applicazioni esterne;
- Monitoraggio efficiente del file system con debouncing per evitare aggiornamenti eccessivi;
- Aggiornamenti intelligenti basati su differenze che modificano solo gli elementi interessati, preservando la posizione di scorrimento e la selezione;

### Trascinamento e rilascio

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/beta-1/drag-and-drop.mp4"></video>

Ora puoi trascinare file e cartelle per copiarli/spostarli facilmente. Trascina tra i pannelli, da o verso le liste dei risultati di ricerca, da o verso app esterne.

### Conflitti di copia

Aggiunta una finestra modale per una facile risoluzione dei conflitti di copia/spostamento.

### Aggiornamento automatico

Aggiunto il controllo automatico degli aggiornamenti (può essere controllato dalle impostazioni).

### Editor multimediale del banner della home

Aggiunto un editor per la personalizzazione del banner della pagina home. Ora puoi caricare immagini e video personalizzati (sono supportati sia file locali che URL remoti)

### Miglioramenti della vista a lista

- Design migliorato e corretti piccoli fastidi;
- Aggiunta la personalizzazione della visibilità delle colonne: scegli quali colonne visualizzare;
- Aggiunto l'ordinamento per colonne: clicca sulle intestazioni delle colonne per ordinare le voci;
- Il layout predefinito del navigatore è stato cambiato in vista a lista;

### Miglioramenti della ricerca globale

- Layout e design aggiornati con supporto per il trascinamento;
- La ricerca è ora disponibile durante l'indicizzazione delle unità;

### Apri nel terminale

Apri le directory nel tuo terminale preferito direttamente dal menu contestuale.

- Rilevamento automatico dei terminali installati su Windows, macOS e Linux;
- Windows Terminal mostra tutti i profili shell configurati con le icone degli eseguibili;
- Il terminale predefinito di Linux viene auto-rilevato e mostrato per primo;
- Include modalità normale e amministratore/elevata;
- Scorciatoia predefinita: Alt+T;

### Localizzazione

- Aggiunta la lingua slovena (grazie a: @anderlli0053);

### Miglioramenti UI / UX

- Aggiunto selettore di font: scegli il font dell'interfaccia tra i font di sistema installati;
- Aggiunto menu "Crea nuovo" per creare rapidamente file o directory;
- Visualizzazione di una vista di stato vuoto quando si naviga verso directory vuote;
- La barra di stato mostra il totale degli elementi con il conteggio nascosto quando la lista è filtrata;
- Gli elementi appena creati, copiati e spostati scorrono automaticamente per essere visibili;
- Barra degli strumenti degli appunti visualizzata una sola volta sotto i pannelli invece che in ogni pannello;
- Design semplificato della finestra di rinomina;
- Icone della barra degli strumenti responsive che si comprimono in un menu a tendina per finestre di piccole dimensioni;
- Rimossa la scheda "Navigazione" vuota dalle impostazioni;
- La rinomina di una directory ora aggiorna il suo percorso in tutte le schede, gli spazi di lavoro, i preferiti, le etichette, la cronologia e gli elementi frequenti;
- L'eliminazione di un file o una directory ora lo rimuove da tutte le liste memorizzate e porta le schede interessate alla home;
- I percorsi inesistenti nei preferiti, nelle etichette, nella cronologia e negli elementi frequenti vengono ora puliti automaticamente all'avvio;

### Correzioni di bug

- Corretto lo stato dell'indicizzazione della ricerca globale che non si aggiornava in tempo reale;
- Corretto il pannello della vista divisa che non si aggiornava quando la sua directory viene eliminata o rinominata dall'altro pannello;
- Corrette le schede che si caricavano con un errore quando il loro percorso memorizzato non esiste più;
- Corrette le icone di sistema che mostravano la stessa icona per tutti i file dello stesso tipo invece di icone uniche per file;
- Corrette le scorciatoie da tastiera che non funzionavano nel secondo pannello della vista divisa;
- Corrette le scorciatoie da tastiera che smettevano di funzionare dopo la navigazione tra le pagine;
- Corretta una perdita di memoria con gli ascoltatori dei tasti del filtro non puliti allo smontaggio;
- Linux: aggiunto supporto per il recupero dell'app predefinita nel menu "apri con";

---

## [2.0.0-alpha.6] - January 2026

**Riepilogo:** Finestra Novità, Anteprima rapida, miglioramenti del menu contestuale e nuove impostazioni.

### Finestra Novità

Una finestra del registro delle modifiche che mostra le nuove funzionalità e i miglioramenti per ogni versione.

- Appare automaticamente dopo gli aggiornamenti (può essere disabilitata);
- Sfoglia tutte le versioni;
- Consulta descrizioni dettagliate e screenshot per ogni funzionalità;

### Anteprima rapida

Anteprima dei file senza aprirli completamente tramite una finestra di anteprima leggera.

- Premi `Spazio` o l'opzione "Anteprima rapida" nel menu contestuale per visualizzare rapidamente i file;
- Chiudi istantaneamente con `Spazio` o `Escape`.
- Supporta immagini, video, audio, file di testo, PDF e altro;

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/alpha-6/quick-view.mp4"></video>

### Calcolo della dimensione delle directory

- La dimensione delle directory viene ora calcolata automaticamente;
- Puoi vedere la dimensione totale di tutte le directory, incluse tutte le sottodirectory e i file, non appena apri una directory;

![Apri con](./public/changelog/assets/alpha-6/size.png)

### Nuove opzioni del menu contestuale

#### Apri con

- Scegli quale applicazione utilizzare per aprire un file;
- Configura preimpostazioni personalizzate per aprire file in applicazioni con parametri;
- Visualizza tutte le applicazioni compatibili per qualsiasi tipo di file;
- Imposta applicazioni predefinite per tipi di file specifici;

![Apri con](./public/changelog/assets/alpha-6/open-with.png)

#### Estensioni shell

- Accedi alle voci del menu contestuale shell di Windows;
- Accedi alle estensioni shell di terze parti (7-Zip, Git, ecc.);

![Estensioni shell](./public/changelog/assets/alpha-6/shell-extensions.png)

### Nuove impostazioni

#### Rilevamento delle unità

- Mette in primo piano l'app quando vengono collegati dispositivi rimovibili (può essere disabilitato);
- Controlla il comportamento di apertura automatica dell'Esplora risorse per le unità rimovibili;

#### Filtra durante la digitazione

Inizia a digitare ovunque nel navigatore per filtrare istantaneamente gli elementi nella directory corrente;

#### Scorciatoia per la ricerca nelle impostazioni

Nuova scorciatoia da tastiera per un accesso rapido alla ricerca nelle impostazioni;

#### Dati statistici utente

- Aggiunta una sezione impostazioni per le statistiche;
- Nella pagina del dashboard puoi vedere, navigare, cancellare la cronologia, i preferiti e gli elementi utilizzati frequentemente;

### Miglioramenti della ricerca

Ricerca globale migliorata con un sistema ibrido indicizzato + diretto per risultati più affidabili e aggiornati.

- Le ricerche ora richiedono costantemente meno di 1 secondo (~1 TB di unità piena), indipendentemente dalla posizione dei file sulle tue unità;
- Quando cerchi nei tuoi "percorsi prioritari" (quelli che apri spesso), ottieni risultati istantaneamente e i file vengono trovati anche se sono appena stati creati e non sono ancora stati indicizzati.

#### I percorsi prioritari includono:
- Directory utente: Download, Documenti, Desktop, Immagini, Video, Musica;
- Preferiti;
- Aperti di recente;
- Utilizzati frequentemente;
- Etichettati;

---

## [2.0.0-alpha.5] - January 2026

**Riepilogo:** Operazioni sui file, ricerca globale e personalizzazione delle scorciatoie.

### Ricerca globale

Potente ricerca su tutto il disco che indicizza e cerca file su tutte le tue unità. Include la corrispondenza approssimativa per trovare file anche con errori di battitura, la re-indicizzazione automatica periodica, l'indicizzazione prioritaria per le directory utilizzate frequentemente e la scansione parallela opzionale per un'indicizzazione più veloce.

![Ricerca globale](./public/changelog/assets/alpha-5/search.png)

### Operazioni sui file

Supporto completo per le operazioni sui file con funzionalità di copia, spostamento ed eliminazione incluso il tracciamento del progresso. Include anche la rinomina di file e cartelle sul posto.

### Editor delle scorciatoie

Personalizza tutte le scorciatoie da tastiera nell'app. Visualizza le associazioni correnti, rileva i conflitti e ripristina le impostazioni predefinite.

### Miglioramenti del navigatore

Aggiunta l'opzione per visualizzare le icone di sistema native per file e directory invece di glifi minimalisti. Le schede di navigazione delle impostazioni ora rimangono fisse in cima alla pagina durante lo scorrimento.

---

## [2.0.0-alpha.4] - January 2026

**Riepilogo:** Pagina home, effetti visivi e opzioni di personalizzazione utente.

### Pagina home

Una bella pagina home con un banner multimediale animato, elenco delle unità e accesso rapido alle directory utente comuni come Documenti, Download, Immagini e altro.

### Effetti visivi

Sezione di effetti visivi personalizzabili nelle impostazioni che aggiunge sfocatura, opacità ed effetti di rumore allo sfondo dell'app. Supporta impostazioni diverse per ogni pagina.

### Editor delle directory utente

Personalizza le tue schede delle directory utente con titoli, icone e percorsi personalizzati. Personalizza l'aspetto delle tue directory di accesso rapido nella pagina home.

### Editor di posizione del banner

Regola con precisione la posizione degli sfondi del banner della pagina home. Regola lo zoom, il posizionamento orizzontale e verticale per un aspetto perfetto.

### Miglioramenti delle impostazioni

- La ricerca nelle impostazioni ora funziona in qualsiasi lingua, non solo in quella corrente;
- L'app ripristina l'ultima scheda delle impostazioni visitata al ricaricamento invece di aprire sempre la prima;

---

## [2.0.0-alpha.3] - December 2025

**Riepilogo:** Vista del navigatore con schede, spazi di lavoro e un nuovo sistema di design.

### Vista del navigatore

L'esperienza principale di navigazione dei file con un moderno sistema di schede che supporta gli spazi di lavoro, un nuovo design della barra degli strumenti della finestra con controlli integrati e la navigazione a doppio pannello per una gestione efficiente dei file.

### Miniature video

Aggiunte miniature di anteprima per i file video nel navigatore.

### Migrazione del sistema di design

Migrazione dell'app da Vuetify a Sigma-UI per un design più spazioso e moderno con una migliore qualità del codice.

---

## [2.0.0-alpha.1] - January 2024

**Riepilogo:** Riscrittura completa utilizzando tecnologie moderne.

### Migrazione Tauri

Sigma File Manager v2 è stato ricostruito da zero utilizzando Vue 3 Composition API, TypeScript e Tauri v2. La dimensione di installazione dell'app è stata ridotta da 153 MB a soli 4 MB su Windows. La dimensione dell'app installata è stata ridotta da 419 MB a 12 MB.

### Pannelli ridimensionabili

Aggiunta la funzionalità dei pannelli ridimensionabili che permette di dividere la vista del navigatore a metà e lavorare con 2 directory fianco a fianco.

### Funzionalità iniziali

Navigazione di base dei file con elenco delle directory, gestione della finestra con controlli di riduzione a icona, ingrandimento e chiusura, e una struttura iniziale della pagina delle impostazioni.
