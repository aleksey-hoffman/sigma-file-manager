# Dnevnik sprememb

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
