# Dnevnik sprememb

## [2.2.0] - July 2026

**Povzetek:** Integracija s sistemskim odložiščem, izbiranje z okvirjem, povezani razdeljeni pogled, upravljanje povezav, ZIP-arhivi z geslom, sistemsko okno Lastnosti v sistemu Windows, nove zmožnosti API-jev za razširitve, podpora za hebrejščino in izboljšave navigatorja.

### Nove funkcije

#### Integracija sistemskega odložišča

Kopirajte in prilepite datoteke, mape in slike med Sigma File Manager in drugimi aplikacijami prek sistemskega odložišča.

- **Prenos datotek med aplikacijami**: kopirajte ali izrežite elemente v SFM in jih prilepite v aplikacije, kot je Raziskovalec, ali pa s `Ctrl+V` v navigator prilepite poti in datoteke, kopirane v drugih aplikacijah;
- **Lepljenje slik**: prilepite slike, kopirane iz brskalnikov in drugih aplikacij, neposredno v mapo;
- **Razreševanje sporov**: če prilepljeni elementi že obstajajo, izberite `Preimenuj` ali `Združi`; za posamezne datoteke so na voljo možnosti Zamenjaj, Preskoči, Obdrži obe ali Uporabi za vse;
- **Orodna vrstica odložišča**: po želji v orodni vrstici prikažite slike in poti datotek, kopirane v drugih aplikacijah;

Vidnost orodne vrstice lahko nastavite v `Nastavitve > Videz uporabniškega vmesnika > Odložišče`. Lepljenje s `Ctrl+V` deluje tudi, ko je orodna vrstica skrita.

![system-clipboard](./public/changelog/assets/2.2.0/system-clipboard.webp)

#### Izbiranje z okvirjem

Po praznem prostoru v navigatorju povlecite izbirni okvir in z njim izberite več elementov.

- **Modifikacijske tipke**: držite `Ctrl` ali `Shift`, da elemente dodate trenutnemu izboru; držite `Alt`, da izbor obrnete;
- **Lažji začetek izbiranja**: po želji povečajte odmike v seznamu in mreži, da boste okvir lažje začeli vleči na praznem prostoru;

Omogočite v `Nastavitve > Splošno > Pogled datotek > Omogoči izbiranje z okvirjem`.

![box-selection](./public/changelog/assets/2.2.0/box-selection.webp)

#### Povezani razdeljeni pogled

Novi način razdeljenega pogleda `Povezan` poenostavi delo v stolpcih: ko v prvem podoknu izberete mapo, se njena vsebina prikaže v drugem.

Obstoječi neodvisni način `Razdeljen` ostaja nespremenjen. Način izberite v meniju možnosti navigatorja pod `Način razdeljenega pogleda`, razdeljeni pogled pa vklopite ali izklopite s `Ctrl+S`.

Posodobljena je tudi ikona podokna z informacijami, da jo je lažje razlikovati od ikone razdeljenega pogleda.

![linked-split-view](./public/changelog/assets/2.2.0/linked-split-view.webp)

#### Upravljanje povezav

Ustvarjajte datotečne povezave in preverjajte njihove podatke neposredno v navigatorju.

- **Ustvarjanje povezav**: v kontekstnem meniju izberite `Ustvari povezavo`, da ustvarite simbolno ali trdo povezavo, bližnjico oziroma spoj;
- **Stolpci povezav**: seznam lahko prikaže stolpce Vrsta, Povezave, Cilj povezave in Stanje povezave (`Veljavna`, `Prekinjena`, `Neznana`, `Nepodprta`);
- **Odpiranje povezav**: bližnjice imenikov in simbolne povezave do map odprejo ciljni imenik v navigatorju, drugi cilji pa se odprejo s privzeto aplikacijo;

![link-handling](./public/changelog/assets/2.2.0/link-handling.webp)

#### Sistemsko okno Lastnosti

V sistemu Windows lahko sistemsko okno Lastnosti za izbrane elemente odprete iz kontekstnega menija, menija dejanj, z `Alt+Enter` ali dvojnim klikom ob pritisnjeni tipki `Alt`.

![native-properties](./public/changelog/assets/2.2.0/native-properties.webp)

#### Spreminjanje velikosti in prerazporejanje stolpcev v seznamskem pogledu

Širino in vrstni red stolpcev v seznamskem pogledu lahko prilagodite svojemu načinu dela.

- **Spreminjanje širine**: povlecite rob stolpca;
- **Vrstni red in vidnost**: nastavite ju v pojavnem meniju `Stolpci` v glavi seznama;
- **Možnosti širine**: `Zapolni razpoložljivo širino` in `Nastavi najmanjše širine`;

![list-column-resize](./public/changelog/assets/2.2.0/list-column-resize.webp)

#### Naslov korenskih lokacij

Novi korenski naslov `Lokacije` združuje pogone in navidezne lokacije, da lahko med njimi hitreje preklapljate.

- **Naslovna vrstica**: iz korena pogona se pomaknite eno raven višje ali odprite `Lokacije` iz naslovne vrstice oziroma urejevalnika naslova;
- **Priljubljene in oznake**: naslov `Lokacije` lahko tako kot druge imenike dodate med priljubljene in mu dodelite oznake;
- **Razdeljen pogled**: še posebej uporabno za preklapljanje pogonov med podokni, ne da bi zapustili navigator;

![root-locations-address](./public/changelog/assets/2.2.0/root-locations-address.webp)

### Razširitve

#### API-ji in pogledi razširitev

Razširitve imajo na voljo več zmožnosti aplikacije in gradnikov uporabniškega vmesnika.

- **Lokalne izvršljive datoteke**: nastavite samodejno namestitev odvisnosti razširitve ali ročno izberite lokalne izvršljive datoteke (`Razširitve > Odvisnosti`);
- **Zahteve HTTP**: razširitve lahko pošiljajo zahteve HTTP gostiteljem, dovoljenim v njihovem manifestu;
- **Nadzor pogleda**: razširitve z ustreznim dovoljenjem lahko spreminjajo postavitev in razvrščanje navigatorja;
- **API odložišča**: razširitve z ustreznim dovoljenjem lahko berejo in spreminjajo vsebino odložišča;
- **Pogled s seznamom in podrobnostmi**: nov vzorec uporabniškega vmesnika razširitve z iskanjem po seznamu in podoknom s podrobnostmi;

![extension-local-binaries](./public/changelog/assets/2.2.0/extension-local-binaries.webp)

![extension-dependency-config](./public/changelog/assets/2.2.0/extension-dependency-config.webp)

![extension-list-detail](./public/changelog/assets/2.2.0/extension-list-detail.webp)

![extension-http-api](./public/changelog/assets/2.2.0/extension-http-api.webp)

### Nove nastavitve

- **Omogoči izbiranje z okvirjem**: po praznem prostoru povlecite okvir in izberite več elementov;
  `Nastavitve > Splošno > Pogled datotek > Omogoči izbiranje z okvirjem`
- **Povečaj razmike v pogledu datotek**: povečajte odmike v seznamu in mreži, da boste lažje začeli izbirati;
  `Nastavitve > Splošno > Pogled datotek > Povečaj razmike v pogledu datotek`
- **Ohrani okno hitrega predogleda v pomnilniku**: okno ostane naloženo in se odpre takoj (porabi približno 200 MB);
  `Nastavitve > Splošno > Zmogljivost > Ohrani okno hitrega predogleda v pomnilniku`
- **Ohrani okno za tiskanje v pomnilniku**: okno ostane naloženo in se odpre takoj (porabi približno 200 MB);
  `Nastavitve > Splošno > Zmogljivost > Ohrani okno za tiskanje v pomnilniku`
- **Orodna vrstica odložišča za zunanje slike**: prikažite orodno vrstico odložišča za slike, kopirane v drugih aplikacijah;
  `Nastavitve > Videz uporabniškega vmesnika > Odložišče`
- **Orodna vrstica odložišča za zunanje poti**: prikažite orodno vrstico odložišča za poti datotek, kopirane v drugih aplikacijah;
  `Nastavitve > Videz uporabniškega vmesnika > Odložišče`
- **Dinamična velikost podokna z informacijami**: velikost naj se prilagaja samodejno; ročno spreminjanje velikosti to možnost izklopi;
  `Nastavitve > Videz uporabniškega vmesnika > Podokno z informacijami > Dinamična velikost podokna z informacijami`
- **Slika polne velikosti v predogledu**: v podoknu z informacijami prikažite slike v polni ločljivosti;
  `Nastavitve > Videz uporabniškega vmesnika > Podokno z informacijami > Prikaži sliko polne velikosti v predogledu`
- **Privzeto utišaj predogled videoposnetka**: med brskanjem predvajajte videoposnetke v podoknu z informacijami brez zvoka;
  `Nastavitve > Videz uporabniškega vmesnika > Podokno z informacijami > Privzeto utišaj predogled videoposnetka`
- **Samodejno predvajaj predoglede videoposnetkov**: izbrani videoposnetek se samodejno začne predvajati v podoknu z informacijami;
  `Nastavitve > Videz uporabniškega vmesnika > Podokno z informacijami > Samodejno predvajaj predogled videoposnetka`

### Nove bližnjice

- **Sistemsko okno Lastnosti** (`Alt+Enter`): odprite sistemsko okno Lastnosti za izbrane elemente v sistemu Windows;

### Novi jeziki

- **Hebrejščina** (`עברית`): popoln prevod s podporo za vmesnik od desne proti levi (`Nastavitve > Splošno > Jezik`);

### Izboljšave uporabniške izkušnje

#### Razpakiranje arhivov

Zdaj lahko razpakirate šifrirane ZIP-arhive in arhive z imeni datotek v kodiranjih, ki niso UTF-8.

- **ZIP z geslom**: ko ga razpakiranje zahteva, vnesite geslo arhiva;
- **Kodiranje imen datotek**: kodiranje izberite v `Možnosti razpakiranja arhiva`; najprej se uporabi samodejno zaznavanje, regionalna kodiranja pa so združena med nadomestnimi možnostmi;

![archive-extraction-options](./public/changelog/assets/2.2.0/archive-extraction-options.webp)

![archive-extraction-encoding](./public/changelog/assets/2.2.0/archive-extraction-encoding.webp)

#### Razvrščanje mreže

Mrežni pogled ima zdaj v meniju možnosti navigatorja lastne nastavitve razvrščanja.

- **Razvrsti po**: Ime, Elementi, Velikost, Spremenjeno, Ustvarjeno, Oznake, Vrsta, Povezave in Stanje povezave;
- **Smer**: naraščajoči ali padajoči vrstni red se shrani ločeno od razvrščanja v seznamskem pogledu;

![grid-sorting](./public/changelog/assets/2.2.0/grid-sorting.webp)

#### Razširitve lupine

V razdelku `Razširitve lupine` kontekstnega menija so zdaj na voljo sodobna dejanja lupine, ki so jih registrirale druge aplikacije.

![shell-extensions](./public/changelog/assets/2.2.0/shell-extensions.webp)

#### Obnovitev stanja seje

Ko se med isto sejo vrnete na stran ali v podokno, se obnovijo položaji pomikanja in aktivni zavihki.

#### Zmogljivost navigatorja

Brskanje po velikih mapah in predstavnostnih datotekah je hitrejše in porabi manj pomnilnika.

- **Prvo nalaganje**: imeniki se ob prvem odpiranju naložijo hitreje;
- **Nalaganje ikon**: prilagojene in sistemske ikone se prikažejo z manjšo zakasnitvijo;
- **Pomikanje po seznamu**: seznami v velikih imenikih se pomikajo bolj gladko;
- **Predogledi predstavnostnih datotek**: slike, GIF-i in videoposnetki se odzivajo hitreje in porabijo manj pomnilnika;
- **Indeksiranje**: indeksiranje globalnega iskanja je zanesljivejše;

#### Domača stran in kontekstni meniji

- **Prekini povezavo**: kadar je podprto, lahko omrežne ali izmenljive nosilce odklopite iz kontekstnega menija;
- **Zapri vse dvojnike**: ukaz `Zapri vse dvojnike` v meniju zavihka zdaj zapre vse zavihke s podvojenimi potmi v delovnem prostoru, ne le kopij trenutnega zavihka;
- **Desni klik za počistitev**: desni klik na prazno ozadje navigatorja pred odpiranjem menija ozadja počisti trenutno izbiro;
- **Dejanja domače strani**: kontekstni meni se po izbiri dejanja zapre, ukaz `Odpri v novem zavihku` odpre navigator, novi zavihki pa se samodejno pomaknejo v vidno območje;
- **Območje vlečenja okna**: pri naslovnih vrsticah v slogu Linuxa območje vlečenja poteka tudi čez gumbe orodne vrstice, zato je okno lažje premikati;

![window-drag-region](./public/changelog/assets/2.2.0/window-drag-region.webp)

### Izboljšave uporabniškega vmesnika

- **Kazalnik aktivnega podokna**: jasnejša oznaka aktivnega podokna v vrstici stanja, ko je razdeljen pogled vklopljen;
- **Podokno z informacijami s spremenljivo velikostjo**: z vlečenjem spremenite širino podokna in razmerje med predogledom ter podrobnostmi;
- **Kompaktno podokno z informacijami**: gostejša razporeditev lastnosti;
- **Dejanja kontekstnega menija**: ukaz `Uredi kartico` je prikazan kot poseben gumb, vsi gumbi dejanj pa so manjši;
- **Slog navigatorja**: izboljšave vključujejo prilagodljivo postavitev, videz aktivnih zavihkov v razdeljenem pogledu in pogled razširitev v ukazni paleti;
- **Vmesnik od desne proti levi**: izboljšana poravnava za jezike, ki se pišejo od desne proti levi;

![resizable-info-panel](./public/changelog/assets/2.2.0/resizable-info-panel.webp)

![compact-info-panel](./public/changelog/assets/2.2.0/compact-info-panel.webp)

### Popravki napak

- **Iskanje med tipkanjem**: odpravljena je napaka, zaradi katere se hitro iskanje pri nelatiničnih razporeditvah tipkovnice ni vklopilo;
- **Nalaganje imenika**: elementi po končanem nalaganju imenika ne spremenijo več vrstnega reda;
- **Prilagojene ikone**: zmanjšana je bila opazna zakasnitev pri nalaganju prilagojenih ikon;
- **Kartice mreže**: kartice med nalaganjem ne spreminjajo več velikosti;
- **Drsnik mreže**: drsnik se ne skriva več za pritrjenimi glavami;
- **Hitra izbira**: odpravljena je napaka, zaradi katere je hitra izbira včasih odprla datoteko;
- **Bližnjica terminala**: `Alt+T` zdaj odpre terminal za izbrani element namesto za trenutni imenik;
- **Odpiranje datotek**: datoteke se ne zaženejo več iz napačnega delovnega imenika;
- **Skupne rabe SMB**: datoteke v skupnih rabah SMB je znova mogoče odpreti;
- **Poti WSL**: popravljeno je obravnavanje gostiteljskih poti UNC za WSL v sistemu Windows; `//wsl.localhost` se prepozna kot navidezni seznam distribucij;
- **Privzeti upravitelj datotek**: privzeti upravitelj datotek je znova mogoče nastaviti v različicah iz trgovine Microsoft Store;
- **AppImage (Linux)**: popravljeno `Could not create default EGL display: EGL_BAD_PARAMETER`;
- **Namestitev razširitev (Linux)**: odpravljene so napake pri nameščanju paketov razširitev z več datotekami;
- **Podrobnosti razširitve**: popravljena je poravnava strani s pregledom;
- **Prebuditev naprave**: aplikacija po prebuditvi naprave ne obtiči več v stanju nalaganja;
- **Obvestila o posodobitvah**: obvestila se ne prikazujejo več za neizdane različice;
- **Vmesnik od desne proti levi**: odpravljene so težave s postavitvijo;
- **Prevodi**: popravljeni manjkajoči in napačni prevodni nizi;

---

## [2.1.0] - May 2026

**Povzetek:** Hitrejši navigator, ustvarjene sličice, teme iz razširitev, tiskanje, predogledi datotek, nove bližnjice, izboljšan urejevalnik naslova, prenovljeno središče stanja ter boljša uporaba zavihkov in navigacije.

### Nove funkcije

#### Tiskanje

Natisnite izbrane datoteke neposredno iz navigatorja prek kontekstnega menija, menija dejanj ali s `Ctrl+O`.

- **Podprti formati**: slike, PDF, besedilni formati;
- **Hiter izhod**: zaprite pogled tiskanja s `Escape`;

![printing](./public/changelog/assets/2.1.0/printing.webp)

#### Vlečenje datotek na zavihke

Povlecite datoteke ali imenike na zavihke, da jih premaknete ali kopirate v imenik drugega zavihka.

- **Zavihki kot cilji**: med vlečenjem datotek v navigatorju jih lahko spustite na zavihke;
- **Preklop ob zadržanju kazalca**: med vlečenjem zadržite kazalec nad zavihkom, da ga pred spustom odprete;
- **Razdeljeni zavihki**: skupine zavihkov imenikov sprejemajo datoteke kot prej, pri tem pa ohranijo strukturo zavihkov razdeljenega pogleda;

![file-drop-to-tabs](./public/changelog/assets/2.1.0/file-drop-to-tabs.webp)

#### Predogled datotek v podoknu z informacijami

Podokno z informacijami lahko zdaj prikaže vse vrste datotek, ki jih podpira hitri predogled, ne le slik in videoposnetkov.

- **Predogledi predstavnostnih datotek**: slike uporabljajo ustvarjene sličice, videoposnetki in zvok imajo običajne kontrolnike, PDF-ji pa se prikažejo neposredno v podoknu;
- **Predogledi besedila**: besedilne datoteke prikažejo kratek, dekodiran predogled z varno omejitvijo velikosti;
- **Nepodprte datoteke**: pri nepodprtih datotekah in mapah se še naprej prikažejo preproste nadomestne ikone;

![info-panel-file-preview](./public/changelog/assets/2.1.0/info-panel-file-preview.webp)

#### Stolpci seznama navigatorja

Seznamski pogled ima več izbirnih stolpcev in priročnejše upravljanje metapodatkov neposredno v seznamu.

- **Stolpec Ustvarjeno**: prikažite in razvrščajte po datumu ustvarjanja;
- **Stolpec Oznake**: prikažite oznake neposredno v seznamskem pogledu ter dodajajte, odstranjujte ali urejajte oznake iz stolpca;

![navigator-list-columns](./public/changelog/assets/2.1.0/navigator-list-columns.webp)

### Razširitve

#### Teme aplikacije iz razširitev

Razširitve lahko zdaj dodajajo celovite barvne teme aplikacije. Nameščene teme razširitev se prikažejo v izbirniku tem.

#### Teme ikon iz razširitev

Razširitve lahko zdaj dodajajo teme ikon za mape in datoteke v navigatorju.

- **Ločene izbire**: teme ikon map in datotek izberite neodvisno v `Nastavitve > Videz uporabniškega vmesnika > Tema ikon`;
- **Vgrajene teme in teme razširitev**: uporabite vgrajeno privzeto ali sistemsko temo ikon oziroma katero koli temo omogočene razširitve;
- **Pravila ikon**: teme lahko določijo ikone glede na končnico ali ime datoteke, ime mape in stanje razširjene mape;

### Nove nastavitve

- **Krepko besedilo aktivnega zavihka**: naslov aktivnega zavihka izpišite krepko (`Nastavitve > Zavihki > Videz zavihkov > Krepko besedilo aktivnega zavihka`);

![bold-active-tab-text-setting](./public/changelog/assets/2.1.0/bold-active-tab-text-setting.webp)

### Nove bližnjice

- **Preklopi razdeljen pogled** (`Ctrl+S`): prikažite ali skrijte razdeljen pogled v navigatorju;
- **Obnovi zaprti zavihek** (`Ctrl+Shift+T`): obnovite nazadnje zaprto skupino zavihkov;
- **Ustvari datoteko / imenik** (`Ctrl+Shift+M` / `Ctrl+Shift+N`): ustvarite novo datoteko ali imenik v trenutnem imeniku;
- **Natisni izbrano datoteko** (`Ctrl+O`): natisnite izbrano datoteko;
- **Odpri kopirano pot** (`Ctrl+Shift+V`): odprite veljavno pot iz odložišča;
- **Preklopi strani** (`Alt+1` - `Alt+5`): preklapljajte med Domov, Navigator, Nadzorna plošča, Nastavitve in Razširitve;
- **Navigacija po zgodovini imenika** (`Alt+Left` / `Alt+Right`): pojdite nazaj ali naprej po zgodovini navigatorja;
- **Pojdi v nadrejeni imenik** (`Alt+Up`): pojdite v nadrejeni imenik;
- **Gumbi zgodovine miške** (`Mouse Button 4` / `Mouse Button 5`): krmarite nazaj in naprej s stranskimi gumbi miške;

![create-file-directory-shortcuts](./public/changelog/assets/2.1.0/create-file-directory-shortcuts.webp)

![navigator-shortcuts](./public/changelog/assets/2.1.0/navigator-shortcuts.webp)

### Izboljšave uporabniške izkušnje

#### Zmogljivost velikih imenikov

Navigacija, hitro iskanje in mape z veliko predstavnostnimi datotekami delujejo hitreje ter porabijo manj pomnilnika.

- **Ustvarjene sličice**: slike in videoposnetki dobijo manjše sličice, zato posamezni kartici datoteke ni treba naložiti celotne predstavnostne datoteke;
- **Progresivne slike**: kartice slik v mreži lahko prikažejo zamegljeno sličico nizke ločljivosti, preden je končna sličica pripravljena;
- **Preklic ustvarjanja sličic**: ob spremembi mape ali vidnih elementov se lahko ustvarjanje prekine;
- **Zmogljivost upodabljanja**: vsebina velikih imenikov se upodablja učinkoviteje, hitri predogled pa uporablja ustvarjene sličice in navidezni seznam;

![low-res-image-thumbnail-preview](./public/changelog/assets/2.1.0/low-res-image-thumbnail-preview.webp)

#### Hitro iskanje

Hitro iskanje ima zdaj dva načina: pasivni in aktivni:

- **Pasivni način**: vklopi se samodejno ob začetku tipkanja, filtrira elemente brez prehoda v iskalno polje in ne ovira navigacije.
- **Aktivni način**: vklopi se s `Ctrl+F`, premakne fokus v iskalno polje in začasno onemogoči navigacijo, vendar omogoča natančnejše urejanje poizvedbe.

Druge spremembe:

- **Tipkanje za filtriranje**: alfanumerične tipke v aktivnem podoknu vedno zaženejo hitro iskanje v pasivnem načinu;
- **Navigacija s tipkovnico**: prvi rezultat se izbere samodejno;
- **Pojavno okno**: okno hitrega iskanja je kompaktnejše in manj prekriva vsebino imenika;

![quick-search](./public/changelog/assets/2.1.0/quick-search.webp)

#### Urejevalnik naslova

Urejevalnik naslova lahko zdaj uporabite za hitro odpiranje datotek in poti.

- **Datoteke in imeniki**: odprite datoteke in imenike iz urejevalnika naslova;
- **Pogoste poti**: preklopite v poseben način za hitro odpiranje pogosto uporabljenih poti;
- **Predlogi**: izbirajte med elementi imenika, natančnimi ujemanji, nedavnimi potmi, označenimi elementi, uporabniškimi mapami in sistemskimi pogoni;
- **Dejanja s tipkovnico**: iz urejevalnika se premikajte nazaj, naprej ali navzgor in prikažite element v nadrejenem imeniku;

![address-editor](./public/changelog/assets/2.1.0/address-editor.webp)

#### Središče stanja

Središče stanja je zdaj kompakten pripomoček v orodni vrstici z jasnejšo razvrstitvijo operacij.

- **Število aktivnih operacij**: gumb v orodni vrstici se razširi v kompaktno značko s številom dejavnih operacij;
- **Skupine operacij**: dejavne in dokončane operacije so ločene, dokončane pa so zbrane v zložljivem razdelku;
- **Prekliči vse**: iz glave razdelka lahko hkrati prekličete vse dejavne operacije;
- **Kartice operacij**: vrsta in stanje sta označena jasneje, na primer `Kopiranje | Uspeh` ali `Arhiviranje | Napaka`;
- **Obnovitev odložišča**: ko je operacija lepljenja dodana v čakalno vrsto, se odložišče počisti, ob neuspehu pa se njegova vsebina obnovi;

![status-center](./public/changelog/assets/2.1.0/status-center.webp)

#### Navigacija in zavihki

Krmarjenje po navigatorju in delovanje zavihkov sta predvidljivejša.

- **Pogoni v stranski vrstici**: klik na pogon v navigacijski stranski vrstici ga odpre v trenutnem zavihku;
- **Trenutni imenik**: zadnji del naslova je izrazitejši, z desnim klikom nanj pa odprete kontekstni meni trenutnega imenika;
- **Zaprti zavihki**: obnovljeni zavihki se vrnejo na prejšnje mesto, upoštevajo preimenovane poti, pri izbrisani poti pa odprejo domačo stran;
- **Odzivna postavitev**: navigacijski gumbi v orodni vrstici se skrčijo prej, naslovni vrstici razdeljenega pogleda se v zelo ozkih podoknih premakneta v drugo vrstico, kompaktni zavihki pa ohranijo enako višino;

![nav-sidebar-drive-current-tab](./public/changelog/assets/2.1.0/nav-sidebar-drive-current-tab.webp)

![current-directory-address-bar](./public/changelog/assets/2.1.0/current-directory-address-bar.webp)

#### Upravljanje bližnjic

Nastavljanje bližnjic in razreševanje sporov sta zdaj jasnejša.

- **Več vezav**: eni akciji dodelite več bližnjic;
- **Nedodeljene bližnjice**: dejanjem lahko odstranite dodeljene bližnjice;
- **Zamenjava ob sporu**: sporno bližnjico zamenjajte neposredno v opozorilu;
- **Kontekstni meni**: bližnjice upravljajte iz kontekstnega menija seznama;

![shortcut-editor](./public/changelog/assets/2.1.0/shortcut-editor.webp)

#### Povleci in spusti

Datoteke lahko zdaj povlečete v drugo aplikacijo tudi po preklopu z Alt+Tab; kazalca ni več treba najprej premakniti iz okna;

### Izboljšave uporabniškega vmesnika

- **Izbirni obris**: izboljšani so njegova prosojnost in odmik, videz glave podokna ter obnašanje fokusa pri uporabi tipkovnice;
- **Vrstica zavihkov**: izboljšani slogi vrstice zavihkov in berljivost aktivnega zavihka;
- **Izbira teme**: izboljšana zasnova izbire teme;
- **Hitri dostop**: dodelan je videz podokna za hitri dostop;
- **Zagonski zaslon**: med zagonom aplikacije se zdaj prikaže uvodni zaslon;
- **Vidnost pojavnih oken**: izboljšana vidnost prosojnih elementov pojavnih oken;
- **Namigi**: dodani namigi na več gumbov orodne vrstice;
- **Prevodi**: izboljšani japonski in vietnamski jezikovni nizi ter očiščena struktura lokalizacije;

![selection-ring](./public/changelog/assets/2.1.0/selection-ring.webp)

![tab-bar-styles](./public/changelog/assets/2.1.0/tab-bar-styles.webp)

![narrow-window-layout](./public/changelog/assets/2.1.0/narrow-window-layout.webp)

### Popravki napak

- **Preslikani pogoni**: obnovljeno je vlečenje datotek iz preslikanih omrežnih pogonov v druge aplikacije;
- **Pomikanje s tipkovnico**: prva vrstica se ne skrije več za pritrjeno glavo;
- **Zastoj ob zagonu**: odpravljeni so redki večminutni zastoji v sistemu Windows, ki so jih povzročali počasni sinhroni sistemski klici med zagonom in preverjanjem posodobitev;
- **Razpakiranje arhivov**: pri razpakiranju se zdaj ohranijo dovoljenja datotek Unix;
- **HTTP razširitev**: obnovljena je obravnava trajnih odgovorov s kodami, ki niso 2xx, čakanje pred ponovnim poskusom pa je mogoče preklicati;
- **Ukazna paleta**: gumb ukazne palete v orodni vrstici znova deluje po spremembi njene bližnjice;
- **Izbira obsega v mreži**: obseg ne vključuje več elementov zunaj svojih meja;
- **Kontekstni meniji**: menija izbranega elementa in trenutnega imenika se po izbiri dejanja zapreta;
- **Registracija bližnjic**: popravljene napake registracije bližnjic po ponovnem nalaganju okna;
- **Uporaba tem**: izbrana tema se zdaj uporabi v vseh oknih;
- **Premiki v macOS**: popravljeni so premiki med nosilci in dodana podpora za aplikacijske pakete kot cilje;
- **Privzeti upravitelj datotek**: obnovitev registra sistema Windows je varnejša, če nastavitev privzetega upravitelja ne uspe ali če se obnavljajo prejšnje sistemske vrednosti;

![keyboard-scroll-floating-header](./public/changelog/assets/2.1.0/keyboard-scroll-floating-header.webp)

---

## [2.0.0-beta.3] - April 2026

**Povzetek:** Sistem razširitev s tržnico, deljenje datotek v lokalnem omrežju, meni za hitri dostop, zip arhivi, WSL pogoni, urejanje oznak, izboljšan hitri predogled in iskanje, izboljšave vizualnih učinkov ter številne izboljšave uporabniške izkušnje in stabilnosti.

### Nove funkcije

#### Sistem razširitev

Popoln sistem razširitev z odprto tržnico.

- **Tržnica**: brskajte, nameščajte in upravljajte razširitve iz tržnice;
- **Lokalna namestitev**: razširitve lahko namestite iz lokalne mape;
- **Ukazna paleta**: nov način za aktiviranje ukazov aplikacije in razširitev;
- **Zmožnosti**: razširitve lahko registrirajo lokalne in globalne bližnjice, elemente kontekstnega menija, nastavitve, celotne strani in ukaze;
- **Upravljanje različic**: namestite lahko različne različice razširitev in omogočite samodejno posodabljanje;
- **Lokalizacija**: razširitve lahko ponudijo prevode za različne jezike;
- **Upravljanje binarnih datotek**: razširitve lahko uporabljajo binarne datoteke (ffmpeg, deno, node, yt-dlp, 7z in katero koli drugo obstoječo binarno datoteko);
- **Izolirana izvedba**: razširitve se izvajajo v izoliranih ESM peskovnikih z natančnimi dovoljenji;

#### Privzeti upravitelj datotek

SFM lahko zdaj nastavite kot privzeti upravitelj datotek v sistemu Windows (`Nastavitve > Eksperimentalno`). Ko je ta nastavitev omogočena, bo večina sistemskih dejanj z datotekami preusmerjena v SFM:

- Ikona aplikacije Raziskovalec;
- Bližnjica `Ctrl+E`;
- Pokaži datoteko v mapi;
- Pokaži prenose (ko prenesete datoteko v brskalniku);
- Terminalski ukazi: "start {pot}", "code {pot}" itd.
- In več;

Izvorni sistemski pogledi, kot so »Koš«, »Nadzorna plošča« in podobni globoko integrirani programi, so preusmerjeni nazaj v izvorni Raziskovalec.

#### Deljenje v lokalnem omrežju

Delite in pretakajte datoteke ter imenike prek lokalnega omrežja neposredno iz aplikacije.

Do deljenja v lokalnem omrežju dostopate prek gumba v orodni vrstici navigatorja ali prek kontekstnega menija na kateri koli datoteki ali imeniku. Ko je deljenje aktivno, se prikažeta QR koda in URL naslovi za deljenje. Na voljo sta dva načina:

- **Pretakanje**: pretakajte datoteke in imenike na katero koli napravo v omrežju prek spletnega brskalnika;
- **FTP**: delite datoteke prek FTP za neposreden dostop iz drugih aplikacij. Datoteke lahko prenašate in nalagajte z in na računalnik iz druge naprave;

#### Meni za hitri dostop

Gumb »Nadzorna plošča« v stranski vrstici zdaj deluje kot meni za hitri dostop. Ko se z miško pomaknete nanj, se odpre plošča s priljubljenimi in označenimi elementi.

Vsi elementi na plošči so dejanski vnosi imenika – elemente lahko vlečete in spuščate noter in ven, odprete kontekstne menije z desnim klikom in izvajate vse standardne operacije z datotekami.

Lahko se onemogoči v `Nastavitve > Videz uporabniškega vmesnika > Odpri ploščo za hitri dostop ob lebdenju`.

#### Zip arhivi

Stiskajte in razširjajte zip arhive neposredno iz menija dejanj brskalnika datotek:

- **Razširi**: razširite datoteko `.zip` v trenutni imenik ali v poimenovano mapo;
- **Stisni**: stisnite izbrane datoteke in imenike v arhiv `.zip`;

#### Zaznavanje WSL pogonov

V sistemu Windows aplikacija zdaj samodejno zazna nameščene WSL distribucije in prikaže njihove pogone v navigatorju, kar vam omogoča izvorno brskanje po datotečnih sistemih WSL.

#### Urejanje oznak

Zdaj lahko urejate imena in barve oznak. Odprite izbirnik oznak na kateri koli datoteki ali imeniku, da preimenujete oznake, spremenite njihovo barvo ali jih izbrišete.

#### Posodobitve v aplikaciji

Zdaj lahko posodobitve prenesete in namestite neposredno iz obvestila o posodobitvi, ne da bi zapustili aplikacijo.

#### Kopiraj pot

Dodana možnost »Kopiraj pot« v kontekstni meni datotek in imenikov.

#### Zapri podvojene zavihke

Dodana možnost zapiranja podvojenih zavihkov iz vrstice zavihkov, ki odstrani vse zavihke, ki kažejo na isti imenik.

#### Kontekstni meniji domače strani in nadzorne plošče

Elementi na domači strani in nadzorni plošči imajo zdaj polne kontekstne menije, ki se ujemajo s funkcionalnostjo, ki je na voljo v navigatorju.

### Nove nastavitve

- **Prikaži medijsko pasico domače strani**: prikažite ali skrijte medijsko pasico domače strani (`Nastavitve > Videz uporabniškega vmesnika > Medijska pasica domače strani`);
- **Zakasnitev namigov**: nastavite zakasnitev pred prikazom namigov (`Nastavitve > Videz uporabniškega vmesnika > Namigi`);
- **Relativni čas**: prikažite nedavne časovne žige v relativnem formatu, npr. »pred 5 min« (`Nastavitve > Splošno > Datum / čas`);
- **Format datuma in časa**: nastavite format meseca, regionalni format, 12-urno uro, sekunde in milisekunde (`Nastavitve > Splošno > Datum / čas`);
- **Zameglitev ozadja dialoga**: nastavite intenzivnost zameglitve za ozadja dialogov (`Nastavitve > Videz uporabniškega vmesnika > Nastavitve sloga`);
- **Filtri svetlosti in kontrasta**: prilagodite filtre svetlosti in kontrasta za uporabniški vmesnik aplikacije (`Nastavitve > Videz uporabniškega vmesnika > Nastavitve sloga`);
- **Svetlost prekrivnega medija**: prilagodite svetlost prekrivnega medija vizualnih učinkov (`Nastavitve > Videz uporabniškega vmesnika > Vizualni učinki`);
- **Način mešanja vizualnih učinkov**: prilagodite način mešanja za vizualne učinke, ki vam omogoča izbiro, kako se ozadje meša z uporabniškim vmesnikom aplikacije (`Nastavitve > Videz uporabniškega vmesnika > Vizualni učinki`);
- **Zaustavi video v ozadju**: zaustavite pasico domače strani in video v ozadju, ko je aplikacija nedejavna ali pomanjšana (`Nastavitve > Videz uporabniškega vmesnika > Vizualni učinki`);
- **Privzeti upravitelj datotek**: nastavite Sigma File Manager kot privzeti raziskovalec datotek v sistemu Windows (`Nastavitve > Eksperimentalno`);
- **Zagon ob prijavi v sistem**: samodejno zaženite aplikacijo ob prijavi v sistem (`Nastavitve > Splošno > Vedenje ob zagonu`);

### Nove bližnjice

- **Kopiraj pot trenutnega imenika** (`Ctrl+Shift+C`): kopirajte pot trenutnega imenika v odložišče;
- **Osveži trenutni imenik** (`F5`): osvežite seznam datotek navigatorja;
- **Povečaj / pomanjšaj** (`Ctrl+=` / `Ctrl+-`): povečajte ali zmanjšajte povečavo uporabniškega vmesnika;
- **Celozaslonski način** (`F11`): preklopite celozaslonski način;

### Novi jeziki

- **hindijščina**;
- **urdujščina**;

### Izboljšave uporabniške izkušnje

#### Izboljšave hitrega predogleda

- **Navigacija po medijih**: pomikajte se med datotekami v trenutnem imeniku, ne da bi zaprli hitri predogled;
- **Predogled besedilnih datotek**: izboljšan predogled besedilnih datotek z ustreznim zaznavanjem kodiranja, urejanjem v vrstici in upodobitvijo razčlenjenega markdown-a;

#### Izboljšave hitrega iskanja

- **Vse lastnosti**: iščite po kateri koli lastnosti datoteke – ime, velikost, število elementov, spremenjeno, ustvarjeno, dostopano, pot ali vrsta MIME (npr. `modified: today`, `mime: image`);
- **Obsegi velikosti**: filtrirajte po velikosti s primerjavami in obsegi (npr. `size: >=2mb`, `size: 1mb..10mb`);

#### Operacije z datotekami

- **Varnost pri reševanju konfliktov**: izboljšana varnost datotek znotraj modalnega okna za reševanje konfliktov, da se prepreči nenamerna izguba podatkov;
- **Enkratno lepljenje**: kopirane elemente je mogoče prilepiti le enkrat, kar preprečuje nenamerno podvojeno lepljenje;
- **Kopiranje besedila**: omogočeno kopiranje besedila uporabniškega vmesnika s `Ctrl+C`, ko ni izbranih datotek;

#### Vizualni učinki

- **Upravitelj ozadja**: v nastavitve dodan upravitelj ozadja za centralizirano prilagajanje ozadja;
- **Ponastavitev učinkov ozadja**: dodana tipka za ponastavitev nastavitev učinkov ozadja;

#### Ostalo

- **Zmanjšanje velikosti aplikacije**: zmanjšana velikost paketa aplikacije z izključitvijo vgrajenih ozadij visoke ločljivosti in uporabo stisnjenih predogledov v urejevalniku medijske pasice;
- **Globalno iskanje**: v praznem stanju prikazan gumb »prikaži nastavitve« in povečana privzeta globina iskanja;
- **Bližnjice Windows**: datoteke `.lnk` zdaj odprejo svoj cilj v navigatorju namesto zunanjega zagona;
- **Nadzorna plošča**: izboljšana postavitev razdelka z oznakami;
- **Kontekstni meni naslovne vrstice**: dodan kontekstni meni elementom naslovne vrstice;
- **Kontekstni meni navigatorja**: prikaz kontekstnega menija ob kliku na prazno območje v navigatorju;
- **Odpri v novem zavihku**: odprite imenike v novem zavihku s srednjim klikom miške;
- **Pomikanje zavihkov**: novo dodani zavihki se samodejno pomaknejo v pogled;
- **Fokus menija**: meniji ne vračajo več fokusa na sprožilni gumb, ko so zaprti s klikom zunaj;
- **Zapri iskanje**: zaprite globalno iskanje s tipko `Escape`;
- **Hitrejši zagon**: rahlo izboljšana hitrost zagona aplikacije s prednalaganjem nastavitev v Rust;
- **Uporabniški imeniki**: dodana možnost dodajanja in odstranjevanja uporabniških imenikov na domači strani;
- **Omejitve seznamov**: zmanjšane omejitve za vnose pogostih in zgodovinskih seznamov za izboljšanje zmogljivosti;

### Izboljšave uporabniškega vmesnika

- **Ikone orodne vrstice**: poenotene barve ikon orodne vrstice po celotni aplikaciji;
- **Animacije kartic**: dodani učinki postopnega pojavljanja kartic;
- **Svetla tema**: izboljšane barve in kontrast svetle teme;
- **Stabilnost ob zagonu**: izboljšana vizualna stabilnost ob zagonu aplikacije za zmanjšanje utripanja;
- **Obvestila**: izboljšana zasnova obvestil za boljšo doslednost;
- **Samodejno pomikanje zavihkov**: samodejno pomikanje izbranega zavihka v pogled ob odpiranju strani navigatorja;
- **Oznake korenskih poti**: normalizirane oznake korenskih poti po zavihkih in informacijski plošči;
- **Prevodi**: izboljšani prevodi po celotni aplikaciji;

### Popravki napak

- Popravljeno zamrznitev uporabniškega vmesnika pri kopiranju ali premikanju številnih elementov; dodan napredek operacij z datotekami v statusni center;
- Popravljeno zamrznitev uporabniškega vmesnika pri brisanju številnih elementov; dodan napredek brisanja v statusni center;
- Popravljen kontekstni meni v mrežni postavitvi, ki se ni odprl za trenutni imenik, ko je imel drug element že odprt meni;
- Popravljena informacijska plošča, ki ni prikazovala vseh informacij za trenutni imenik;
- Popravljene bližnjice aplikacije, ki so se registrirale na oknu hitrega predogleda namesto le na glavnem oknu;
- Popravljeno, da datoteke, povlečene iz spletnih brskalnikov, niso bile obdelane;
- Popravljeno, da imena datotek iz zunanjih URL spustov niso ohranila veljavnih segmentov;
- Popravljeno, da je bila domača pasica vlečljiva;
- Popravljen predpomnilnik sistemskih ikon, ki ni bil vezan na pot datoteke, kar je povzročalo nepravilne ikone;
- Popravljeni nedostopni korenski vnosi Windows, ki so se prikazovali v navigatorju;
- Popravljene bližnjice po meri, ki niso bile prepoznane na nekaterih razporeditvah tipkovnic;
- Popravljene SSHFS povezave v sistemu Linux;
- Popravljena naslovna vrstica, ki je ustvarjala podvojene vnose zgodovine ob kliku na drobtine;
- Popravljeni rezultati globalnega iskanja, ki se niso odzivali na navigacijo s tipkovnico;
- Popravljeni rezultati globalnega iskanja, ki se niso odpirali ob kliku;
- Popravljen status globalnega iskanja, ki se ni sinhroniziral po inkrementalnem indeksiranju;
- Popravljen izhodilni povleci-in-spusti, ki ni deloval v nekaterih aplikacijah;
- Popravljena nedosledna zasnova značk bližnjic po celotni aplikaciji;
- Popravljena vidnost stolpcev navigatorja v ozkih podoknih;

---

## [2.0.0-beta.2] - February 2026

**Povzetek:** Globalne bližnjice, nove nastavitve, nove funkcije, izboljšano filtriranje datotek, izboljšana naslovna vrstica, izboljšave domače pasice in popravki napak.

### Globalne bližnjice

Zdaj lahko uporabljate bližnjice na tipkovnici za interakcijo z aplikacijo, tudi ko ta ni v fokusu.

Dodane bližnjice:

- `Win+Shift+E` za prikaz in fokusiranje okna aplikacije;

### Nove nastavitve

Dodana nastavitev za izbiro, kaj se zgodi, ko zaprete zadnji zavihek.

![Nastavitev zapri zadnji zavihek](./public/changelog/assets/beta-2/setting-close-last-tab.png)

### Nove funkcije

Dodane nove funkcije v zgodnjem predogledu:

- Omrežne lokacije: omogoča povezavo omrežne lokacije (SSHFS (SSH) / NFS / SMB / CIFS);
- [Linux] Pripenjanje pogonov: omogoča odpenjanje lokacij;

### Filter datotek

Filter datotek je bil izboljšan:
- Ko spremenite imenik, se zdaj samodejno počisti in zapre;
- Funkcija »filtriraj med tipkanjem« se aktivira v izbranem podoknu, ne v prvem;

### Naslovna vrstica

- Izboljšana zasnova in logika samodokončanja;
- Ločila poti so zdaj spustni meniji, ki omogočajo hitro navigacijo do katerega koli nadrejenega imenika;

![Meniji ločil](./public/changelog/assets/beta-2/divider-menus.png)

### Domača pasica / Učinki ozadja

- Izboljšana zasnova urejevalnika medijske pasice:
  - Meni možnosti medijske pasice se zdaj odpre navzdol, da ne zakriva pogleda;
  - Zdaj lahko kliknete zunaj, da zaprete urejevalnik položaja ozadja;
  - Vnos URL premaknjen nad ozadja po meri;
- Slike/videi po meri se lahko uporabljajo v vizualnih učinkih ozadja;
- Odstranjene nekatere privzete slike medijske pasice;
- Dodana nova slika pasice »Exile by Aleksey Hoffman«;

### Izboljšave uporabniške izkušnje

- Aplikacija ob zagonu obnovi prejšnji položaj okna;
- Trenutni zavihek je zdaj mogoče zapreti z bližnjico `Ctrl+W` ali srednjim klikom miške;
- Povečana velikost ikon datotek v pogledu mrežne postavitve;

### Popravki napak

- Popravljeno premikanje datotek med zavihki, ki jih je včasih premaknilo na napačno lokacijo;
- Popravljen navigator, ki je včasih prikazoval napačne sistemske ikone za imenike;
- Popravljeno ustvarjanje večkratnih primerkov aplikacije in sistemske vrstice;
- Popravljen meni razširitev lupine, ki je občasno ponovno pridobival podatke, kar je prisililo seznam, da se je ves čas pomaknil na vrh;

## [2.0.0-beta.1] - February 2026

**Povzetek:** Večje izboljšave uporabnosti in zasnove, vključno z navigacijo s tipkovnico, novimi bližnjicami, odpiranjem v terminalu, samodejnim osveževanjem imenika, povleci in spusti ter izboljšanim iskanjem in pogledi seznamov.

### Navigacija s tipkovnico

Navigirajte po datotekah s tipkovnico s polno podporo za mrežno in seznamsko postavitev ter razdeljeni pogled.

- Puščične tipke za prostorsko navigacijo v mrežnem pogledu in zaporedno navigacijo v seznamskem pogledu;
- Enter za odpiranje izbranega imenika ali datoteke, Backspace za navigacijo nazaj;
- Ctrl+Levo / Ctrl+Desno za preklop fokusa med podokni razdeljenega pogleda;
- Ctrl+T za odpiranje trenutnega imenika v novem zavihku;
- Vse navigacijske bližnjice so prilagodljive v Nastavitve > Bližnjice;

### Samodejno osveževanje imenika

Pogled navigatorja se samodejno osveži, ko so datoteke ustvarjene, izbrisane, preimenovane ali spremenjene v trenutnem imeniku.

- Velikosti datotek se samodejno posodobijo, ko jih spremenijo zunanji programi;
- Učinkovito opazovanje datotečnega sistema z odlogom za preprečevanje prekomernih osvežitev;
- Pametne posodobitve na podlagi razlik spremenijo le prizadete elemente, pri čemer ohranijo položaj pomika in izbiro;

### Povleci in spusti

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/beta-1/drag-and-drop.mp4"></video>

Zdaj lahko vlečete datoteke in mape za enostavno kopiranje/premikanje. Vlecite med podokni, iz ali v sezname rezultatov iskanja, iz ali v zunanje aplikacije.

### Konflikti pri kopiranju

Dodano modalno okno za enostavno reševanje konfliktov pri kopiranju/premikanju.

### Samodejna posodobitev

Dodano samodejno preverjanje posodobitev (mogoče upravljati v nastavitvah).

### Urejevalnik medijske pasice domače strani

Dodan urejevalnik za prilagajanje pasice domače strani. Zdaj lahko naložite slike in videe po meri (podprti so tako lokalni kot oddaljeni URL-ji).

### Izboljšave seznamskega pogleda

- Izboljšana zasnova in odpravljene manjše nevšečnosti;
- Dodana prilagoditev vidnosti stolpcev: izberite, katere stolpce prikazati;
- Dodano razvrščanje po stolpcih: kliknite glave stolpcev za razvrščanje vnosov;
- Privzeta postavitev navigatorja spremenjena na seznamski pogled;

### Izboljšave globalnega iskanja

- Posodobljena postavitev in zasnova s podporo za povleci in spusti;
- Iskanje je zdaj na voljo, medtem ko se pogoni še indeksirajo;

### Odpri v terminalu

Odprite imenike v želenem terminalu neposredno iz kontekstnega menija.

- Samodejna zaznava nameščenih terminalov v sistemih Windows, macOS in Linux;
- Windows Terminal prikaže vse konfigurirane profile lupin z ikonami izvršljivih datotek;
- Privzeti terminal v sistemu Linux samodejno zaznan in prikazan prvi;
- Vključuje navadne in skrbniške/dvignjene načine;
- Privzeta bližnjica: Alt+T;

### Lokalizacija

- Dodan slovenski jezik (zahvala: @anderlli0053);

### Izboljšave uporabniškega vmesnika in uporabniške izkušnje

- Dodan izbirnik pisav: izberite pisavo uporabniškega vmesnika iz nameščenih sistemskih pisav;
- Dodan meni »Ustvari novo« za hitro ustvarjanje datotek ali imenikov;
- Prikaz pogleda praznega stanja pri navigaciji v prazne imenike;
- Vrstica stanja prikazuje skupno število elementov s številom skritih, ko je seznam filtriran;
- Novo ustvarjeni, kopirani in premaknjeni elementi se samodejno pomaknejo v pogled;
- Orodna vrstica odložišča prikazana enkrat pod podokni namesto v vsakem podoknu;
- Poenostavljena zasnova modalnega okna za preimenovanje;
- Odzivne ikone orodne vrstice, ki se strnejo v spustni meni pri majhnih velikostih okna;
- Odstranjen prazen zavihek »Navigacija« iz nastavitev;
- Preimenovanje imenika zdaj posodobi njegovo pot po vseh zavihkih, delovnih prostorih, priljubljenih, oznakah, zgodovini in pogostih elementih;
- Brisanje datoteke ali imenika jo zdaj odstrani iz vseh shranjenih seznamov in prizadete zavihke preusmeri na domačo stran;
- Neobstoječe poti v priljubljenih, oznakah, zgodovini in pogostih elementih se zdaj samodejno počistijo ob zagonu;

### Popravki napak

- Popravljen status indeksiranja globalnega iskanja, ki se ni posodabljal v realnem času;
- Popravljeno podokno razdeljenega pogleda, ki se ni posodobilo, ko je bil njegov imenik izbrisan ali preimenovan iz drugega podokna;
- Popravljeni zavihki, ki so se nalagali z napako, ko njihova shranjena pot ni več obstajala;
- Popravljene sistemske ikone, ki so prikazovale enako ikono za vse datoteke iste vrste namesto edinstvenih ikon za posamezno datoteko;
- Popravljene bližnjice na tipkovnici, ki niso delovale v drugem podoknu razdeljenega pogleda;
- Popravljene bližnjice na tipkovnici, ki so prenehale delovati po navigaciji strani;
- Popravljen uhajanje pomnilnika s poslušalci tipk filtra, ki niso bili počiščeni ob odstranitvi;
- Linux: dodana podpora za pridobivanje privzete aplikacije v meniju »odpri z«;

---

## [2.0.0-alpha.6] - January 2026

**Povzetek:** Okno »Kaj je novega«, hitri predogled, izboljšave kontekstnega menija in nove nastavitve.

### Okno »Kaj je novega«

Okno z dnevnikom sprememb, ki prikazuje nove funkcije in izboljšave za vsako izdajo.

- Samodejno se prikaže po posodobitvah (mogoče onemogočiti);
- Brskajte po vseh izdajah;
- Oglejte si podrobne opise in posnetke zaslona za vsako funkcijo;

### Hitri predogled

Predoglejte datoteke brez polnega odpiranja z lahkim oknom za predogled.

- Pritisnite `Space` ali možnost »Hitri predogled« v kontekstnem meniju za hiter ogled datotek;
- Takoj zaprite s `Space` ali `Escape`.
- Podpira slike, videe, zvok, besedilne datoteke, PDF-je in več;

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/alpha-6/quick-view.mp4"></video>

### Izračun velikosti imenika

- Velikost imenikov se zdaj samodejno izračuna;
- Skupno velikost vseh imenikov, vključno z vsemi podimeniki in datotekami, lahko vidite takoj, ko odprete kateri koli imenik;

![Odpri z](./public/changelog/assets/alpha-6/size.png)

### Nove možnosti kontekstnega menija

#### Odpri z

- Izberite, s katero aplikacijo odpreti datoteko;
- Nastavite prednastavitve po meri za odpiranje datotek v aplikacijah z zastavicami;
- Oglejte si vse združljive aplikacije za katero koli vrsto datoteke;
- Nastavite privzete aplikacije za določene vrste datotek;

![Odpri z](./public/changelog/assets/alpha-6/open-with.png)

#### Razširitve lupine

- Dostopajte do elementov kontekstnega menija lupine Windows;
- Dostopajte do razširitev lupine tretjih oseb (7-Zip, Git itd.);

![Razširitve lupine](./public/changelog/assets/alpha-6/shell-extensions.png)

### Nove nastavitve

#### Zaznavanje pogonov

- Fokusira aplikacijo, ko so priključeni odstranljivi pogoni (mogoče onemogočiti);
- Nadzorujte vedenje samodejnega odpiranja Windows Explorerja za odstranljive pogone;

#### Filtriranje med tipkanjem

Začnite tipkati kjer koli v navigatorju za takojšnje filtriranje elementov v trenutnem imeniku;

#### Bližnjica za iskanje nastavitev

Nova bližnjica na tipkovnici za hiter dostop do iskanja nastavitev;

#### Podatki uporabniške statistike

- Dodan razdelek statistike v nastavitvah;
- Na strani nadzorne plošče si lahko ogledate, navigirate in počistite zgodovino, priljubljene in pogosto uporabljene elemente;

### Izboljšave iskanja

Izboljšano globalno iskanje s hibridnim indeksiranim + neposrednim iskalnim sistemom za bolj zanesljive in ažurne rezultate.

- Iskanja zdaj dosledno trajajo manj kot 1 sekundo (~1 TB polno napolnjen pogon), ne glede na to, kje so datoteke na vaših pogonih;
- Ko iščete po »prednostnih poteh« (tistih, ki jih pogosto odpirate), dobite rezultate takoj in najde datoteke, tudi če so bile pravkar ustvarjene in še niso bile indeksirane.

#### Prednostne poti vključujejo:
- Uporabniški imeniki: Prenosi, Dokumenti, Namizje, Slike, Videi, Glasba;
- Priljubljene;
- Nedavno odprte;
- Pogosto uporabljene;
- Označene;

---

## [2.0.0-alpha.5] - January 2026

**Povzetek:** Operacije z datotekami, globalno iskanje in prilagajanje bližnjic.

### Globalno iskanje

Zmogljivo iskanje po celotnem disku, ki indeksira in išče datoteke po vseh vaših pogonih. Vključuje mehko ujemanje za iskanje datotek tudi s tipkarskimi napakami, samodejno občasno ponovno indeksiranje, prednostno indeksiranje pogosto uporabljenih imenikov in opcijsko vzporedno skeniranje za hitrejše indeksiranje.

![Globalno iskanje](./public/changelog/assets/alpha-5/search.png)

### Operacije z datotekami

Polna podpora za operacije z datotekami s funkcijami kopiranja, premikanja in brisanja, vključno s sledenjem napredka. Vključuje tudi preimenovanje datotek in map na mestu.

### Urejevalnik bližnjic

Prilagodite vse bližnjice na tipkovnici v aplikaciji. Oglejte si trenutne vezave, zaznajte konflikte in ponastavite na privzete vrednosti.

### Izboljšave navigatorja

Dodana možnost prikaza izvornih sistemskih ikon za datoteke in imenike namesto minimalističnih glifov. Navigacijski zavihki nastavitev se zdaj držijo strani med pomikanjem.

---

## [2.0.0-alpha.4] - January 2026

**Povzetek:** Domača stran, vizualni učinki in možnosti prilagajanja uporabnika.

### Domača stran

Lepa domača stran z animirano medijsko pasico, seznamom pogonov in hitrim dostopom do pogostih uporabniških imenikov, kot so Dokumenti, Prenosi, Slike in več.

### Vizualni učinki

Prilagodljiv razdelek vizualnih učinkov v nastavitvah, ki doda zameglitev, prosojnost in šumne učinke ozadju aplikacije. Podpira različne nastavitve za vsako stran.

### Urejevalnik uporabniških imenikov

Prilagodite kartice uporabniških imenikov z naslovi, ikonami in potmi po meri. Personalizirajte videz imenikov za hitri dostop na domači strani.

### Urejevalnik položaja pasice

Natančno nastavite položaj ozadij pasice domače strani. Prilagodite povečavo, vodoravno in navpično pozicioniranje za popoln videz.

### Izboljšave nastavitev

- Iskanje nastavitev zdaj deluje v katerem koli jeziku, ne le v trenutnem;
- Aplikacija bo ob ponovnem nalaganju obnovila nazadnje obiskan zavihek nastavitev namesto odpiranja prvega vsakič;

---

## [2.0.0-alpha.3] - December 2025

**Povzetek:** Pogled navigatorja z zavihki, delovnimi prostori in novim sistemom zasnove.

### Pogled navigatorja

Osnovna izkušnja brskanja po datotekah s sodobnim sistemom zavihkov, ki podpira delovne prostore, novo zasnovo orodne vrstice okna z integriranimi kontrolami in navigacijo z dvojnim podoknom za učinkovito upravljanje datotek.

### Video sličice

Dodane predogledne sličice za video datoteke v navigatorju.

### Migracija sistema zasnove

Aplikacija preseljena iz Vuetify na Sigma-UI za bolj prostorno, sodobno zasnovo z izboljšano kakovostjo kode.

---

## [2.0.0-alpha.1] - January 2024

**Povzetek:** Popolna ponovna pisava z uporabo sodobnih tehnologij.

### Migracija na Tauri

Sigma File Manager v2 je bil na novo zgrajen od temeljev z uporabo Vue 3 Composition API, TypeScript in Tauri v2. Velikost namestitve aplikacije zmanjšana s 153 MB na le 4 MB v sistemu Windows. Velikost nameščene aplikacije zmanjšana s 419 MB na 12 MB.

### Spremenljiva podokna

Dodana funkcija spremenljivih podoken, ki vam omogoča razdelitev pogleda navigatorja na pol in delo z dvema imenikoma drug ob drugem.

### Začetne funkcije

Osnovna navigacija po datotekah s seznamom imenikov, upravljanje oken z gumbi za pomanjšanje, povečanje in zapiranje ter začetna struktura strani z nastavitvami.
