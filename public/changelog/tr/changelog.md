# Değişiklik Günlüğü

## [2.2.0] - July 2026

**Özet:** Sistem panosu aracılığıyla diğer uygulamalarla entegrasyon, kutu seçimi, bağlı bölünmüş görünüm, bağlantı yönetimi, parola korumalı ZIP arşivleri, Windows'ta yerel Özellikler penceresi, genişletilmiş eklenti API'leri, İbranice dil desteği ve gezginde yapılan iyileştirmeler.

- [Yeni Özellikler](#yeni-özellikler)
  - [Sistem Panosu Entegrasyonu](#sistem-panosu-entegrasyonu)
  - [Kutu Seçimi](#kutu-seçimi)
  - [Bağlı Bölünmüş Görünüm](#bağlı-bölünmüş-görünüm)
  - [Bağlantı Yönetimi](#bağlantı-yönetimi)
  - [Yerel Özellikler Penceresi](#yerel-özellikler-penceresi)
  - [Liste Görünümünde Sütunları Yeniden Boyutlandırma ve Sıralama](#liste-görünümünde-sütunları-yeniden-boyutlandırma-ve-sıralama)
  - [Kök Konumlar Adresi](#kök-konumlar-adresi)
- [Eklentiler](#eklentiler)
  - [Eklenti API'leri ve Görünümleri](#eklenti-apileri-ve-görünümleri)
- [Yeni Ayarlar](#yeni-ayarlar)
- [Yeni Kısayollar](#yeni-kısayollar)
- [Yeni Diller](#yeni-diller)
- [Kullanıcı Deneyimi İyileştirmeleri](#kullanıcı-deneyimi-iyileştirmeleri)
  - [Arşiv Çıkarma](#arşiv-çıkarma)
  - [Izgara Sıralama](#ızgara-sıralama)
  - [Kabuk Uzantıları](#kabuk-uzantıları)
  - [Oturum Belleği](#oturum-belleği)
  - [Gezgin Performansı](#gezgin-performansı)
  - [Ana Sayfa ve Bağlam Menüleri](#ana-sayfa-ve-bağlam-menüleri)
- [Arayüz İyileştirmeleri](#arayüz-iyileştirmeleri)
- [Hata Düzeltmeleri](#hata-düzeltmeleri)

### Yeni Özellikler

#### Sistem Panosu Entegrasyonu

Sigma File Manager ile diğer uygulamalar arasında dosya, klasör ve görselleri sistem panosu aracılığıyla kopyalayıp yapıştırın.

- **Uygulamalar arası dosya aktarımı**: SFM'de öğeleri kopyalayın veya kesin ve Windows Dosya Gezgini gibi uygulamalara yapıştırın; diğer uygulamalardan kopyalanan yolları ve dosyaları da `Ctrl+V` ile gezgine yapıştırın;
- **Görsel yapıştırma**: tarayıcılardan ve diğer uygulamalardan kopyalanan görselleri doğrudan bir klasöre yapıştırın;
- **Çakışma pencereleri**: yapıştırılan öğeler zaten varsa `Yeniden adlandır` veya `Birleştir` seçeneğini kullanın; tek tek dosya çakışmalarını `Değiştir`, `Atla`, `İkisini de koru` veya `Tümüne uygula` seçenekleriyle çözün;
- **Pano araç çubuğu**: diğer uygulamalarda kopyalanan görseller ve dosya yolları için isteğe bağlı araç çubuğu önizlemesini kullanın;

Araç çubuğunun görünürlüğünü `Ayarlar > Arayüz görünümü > Pano` bölümünden ayarlayabilirsiniz. Araç çubuğu gizli olsa bile `Ctrl+V` ile yapıştırma çalışır.

![system-clipboard](./public/changelog/assets/2.2.0/system-clipboard.webp)

#### Kutu Seçimi

Gezginde boş alanda sürükleyerek bir seçim kutusuyla birden fazla öğe seçin.

- **Değiştiriciler**: mevcut seçime eklemek için `Ctrl` veya `Shift` tuşunu, seçimi tersine çevirmek için `Alt` tuşunu basılı tutun;
- **Daha kolay hedefleme**: sürüklemeyi daha kolay başlatmak için isteğe bağlı olarak liste öğelerinin iç boşluğunu ve ızgara aralıklarını artırın;

Bu özelliği `Ayarlar > Genel > Dosya görünümü > Kutu seçimini etkinleştir` bölümünden etkinleştirin.

![box-selection](./public/changelog/assets/2.2.0/box-selection.webp)

#### Bağlı Bölünmüş Görünüm

Daha sade, sütun düzenine benzer bir iş akışı sunan yeni `Bağlı` bölünmüş görünüm modunda, ilk panelde bir klasöre tıkladığınızda klasörün içeriği ikinci panelde gösterilir.

Mevcut bağımsız `Bölünmüş` modu değişmedi. Modu gezgin seçenekleri menüsündeki `Bölünmüş görünüm modu` bölümünden seçin veya `Ctrl+S` ile bölünmüş görünümü açıp kapatın.

Bilgi paneli simgesi de bölünmüş görünüm simgesinden daha kolay ayırt edilecek şekilde güncellendi.

![linked-split-view](./public/changelog/assets/2.2.0/linked-split-view.webp)

#### Bağlantı Yönetimi

Dosya sistemi bağlantılarını doğrudan gezginden oluşturun ve inceleyin.

- **Bağlantı oluşturma**: bağlam menüsündeki `Bağlantı oluştur` seçeneğiyle sembolik bağlantılar, kısayollar, sabit bağlantılar ve birleşimler oluşturun;
- **Bağlantı sütunları**: `Tür`, `Bağlantılar`, `Bağlantı hedefi` ve `Bağlantı durumu` için isteğe bağlı liste sütunlarını kullanın (`Geçerli`, `Bozuk`, `Bilinmiyor`, `Desteklenmiyor`);
- **Açma davranışı**: dizin kısayolları ve sembolik bağlantı klasörleri hedeflerine yönlendirir; diğer bağlantı hedefleri varsayılan uygulamayla açılır;

![link-handling](./public/changelog/assets/2.2.0/link-handling.webp)

#### Yerel Özellikler Penceresi

Windows'ta seçili öğeler için sistemin yerel `Özellikler` iletişim kutusunu bağlam menüsünden, eylemler menüsünden, `Alt+Enter` ile veya `Alt` + çift tıklamayla açın.

![native-properties](./public/changelog/assets/2.2.0/native-properties.webp)

#### Liste Görünümünde Sütunları Yeniden Boyutlandırma ve Sıralama

Liste görünümü sütunlarını çalışma biçiminize göre yeniden boyutlandırabilir ve sıralayabilirsiniz.

- **Yeniden boyutlandır**: genişlikleri değiştirmek için sütun kenarlarını sürükleyin;
- **Sıralama ve görünürlük**: sütunların sırasını ve görünürlüğünü liste başlığındaki `Sütunlar` açılır menüsünden yönetin;
- **Genişlik seçenekleri**: `Kullanılabilir genişliği doldur` ve `En küçük genişlikleri ayarla` seçeneklerini kullanın;

![list-column-resize](./public/changelog/assets/2.2.0/list-column-resize.webp)

#### Kök Konumlar Adresi

Kök `Konumlar` adresi, sürücüler ve sanal konumlar arasında daha hızlı geçiş yapabilmeniz için bunları tek bir yerde listeler.

- **Adres çubuğu**: bir sürücünün kök dizininden yukarı çıkın veya adres çubuğu ya da adres düzenleyici üzerinden `Konumlar`ı açın;
- **Sık kullanılanlar ve etiketler**: `Konumlar`, diğer dizinler gibi sık kullanılanlara eklenebilir ve etiketlenebilir;
- **Bölünmüş görünüm**: gezginden ayrılmadan panellerde farklı sürücülere geçmek için özellikle kullanışlıdır;

![root-locations-address](./public/changelog/assets/2.2.0/root-locations-address.webp)

### Eklentiler

#### Eklenti API'leri ve Görünümleri

Eklentiler artık ana uygulamanın daha fazla özelliğine ve yeni arayüz bileşenlerine erişebilir.

- **Yerel ikili dosyalar**: eklenti bağımlılıklarını otomatik kurulumla veya elle seçilen yerel ikili dosyalarla yapılandırın (`Eklentiler > Bağımlılıklar`);
- **HTTP istekleri**: eklentiler, manifestlerinde izin verilen adreslere HTTP istekleri gönderebilir;
- **Görünüm denetimi**: eklentiler gezgin düzeni ve sıralama tercihlerini uygulayabilir (görünüm izniyle);
- **Pano API'si**: eklentiler panoyu okuyup yazabilir (izinle);
- **Liste ve ayrıntı görünümü**: aranabilir bir liste ile ayrıntı panelini bir araya getiren yeni eklenti arayüzü;

![extension-local-binaries](./public/changelog/assets/2.2.0/extension-local-binaries.webp)

![extension-dependency-config](./public/changelog/assets/2.2.0/extension-dependency-config.webp)

![extension-list-detail](./public/changelog/assets/2.2.0/extension-list-detail.webp)

![extension-http-api](./public/changelog/assets/2.2.0/extension-http-api.webp)

### Yeni Ayarlar

- **Kutu seçimini etkinleştir**: boş alanda sürükleyerek birden fazla öğe seçin;
  `Ayarlar > Genel > Dosya görünümü > Kutu seçimini etkinleştir`
- **Dosya görünümü boşluklarını artır**: öğeleri daha kolay hedeflemek için liste iç boşluğunu ve ızgara aralıklarını artırın;
  `Ayarlar > Genel > Dosya görünümü > Dosya görünümü boşluklarını artır`
- **Quick View penceresini bellekte tut**: anında açılması için Quick View'ı bellekte yüklü tutun (yaklaşık 200 MB kullanır);
  `Ayarlar > Genel > Performans > Quick View penceresini bellekte tut`
- **Yazdırma penceresini bellekte tut**: anında açılması için Yazdırma penceresini bellekte yüklü tutun (yaklaşık 200 MB kullanır);
  `Ayarlar > Genel > Performans > Yazdırma penceresini bellekte tut`
- **Harici görseller için pano araç çubuğu**: diğer uygulamalarda kopyalanan görseller için pano araç çubuğunu göster;
  `Ayarlar > Arayüz görünümü > Pano`
- **Harici yollar için pano araç çubuğu**: diğer uygulamalarda kopyalanan dosya yolları için pano araç çubuğunu göster;
  `Ayarlar > Arayüz görünümü > Pano`
- **Dinamik bilgi paneli boyutu**: bilgi panelinin boyutunun içeriğe göre otomatik ayarlanmasını sağlayın; paneli elle yeniden boyutlandırmak bu seçeneği kapatır;
  `Ayarlar > Arayüz görünümü > Bilgi paneli > Dinamik bilgi paneli boyutu`
- **Bilgi paneli önizlemesinde tam boyutlu görüntü göster**: bilgi panelinde tam çözünürlüklü görselleri göster;
  `Ayarlar > Arayüz görünümü > Bilgi paneli > Bilgi paneli önizleme alanında tam boyutlu görüntüyü göster`
- **Video önizlemesini varsayılan olarak sessize al**: gezinirken bilgi paneli video önizlemelerini sessize al;
  `Ayarlar > Arayüz görünümü > Bilgi paneli > Video önizlemesini varsayılan olarak sessize al`
- **Video önizlemelerini otomatik oynat**: seçildiğinde bilgi panelinde videoları otomatik oynat;
  `Ayarlar > Arayüz görünümü > Bilgi paneli > Video önizlemelerini otomatik oynat`

### Yeni Kısayollar

- **Yerel Özellikler** (`Alt+Enter`): Windows'ta seçili öğelerin yerel Özellikler penceresini açın;

### Yeni Diller

- **İbranice** (`עברית`): sağdan sola yerleşim desteğiyle eksiksiz çeviri (`Ayarlar > Genel > Dil`);

### Kullanıcı Deneyimi İyileştirmeleri

#### Arşiv Çıkarma

ZIP çıkarma artık parolayla korunan arşivleri ve UTF-8 olmayan dosya adlarını destekler.

- **Parola korumalı ZIP**: çıkarma sırasında istendiğinde arşiv parolasını girin;
- **Dosya adı kodlaması**: `Arşiv çıkarma seçenekleri` bölümünden kodlama seçin; otomatik algılama tercih edilir, bölgesel kodlamalar ise gruplandırılmış yedek seçenekler olarak sunulur;

![archive-extraction-options](./public/changelog/assets/2.2.0/archive-extraction-options.webp)

![archive-extraction-encoding](./public/changelog/assets/2.2.0/archive-extraction-encoding.webp)

#### Izgara Sıralama

Izgara düzeni artık gezgin seçenekleri menüsünde kendine ait sıralama denetimleri sunar.

- **Sıralama ölçütü**: Ad, Öğeler, Boyut, Değiştirilme, Oluşturulma, Etiketler, Tür, Bağlantılar ve Bağlantı durumu;
- **Yön**: artan veya azalan sıralama tercihi, liste görünümünün sıralamasından ayrı olarak saklanır;

![grid-sorting](./public/changelog/assets/2.2.0/grid-sorting.webp)

#### Kabuk Uzantıları

Bağlam menüsünde, diğer uygulamaların kaydettiği modern kabuk uzantısı eylemleri `Kabuk uzantıları` altında gösterilebilir.

![shell-extensions](./public/changelog/assets/2.2.0/shell-extensions.webp)

#### Oturum Belleği

Bir sayfa veya panelden ayrılıp aynı oturumda geri döndüğünüzde kaydırma konumları ve etkin sekmeler geri yüklenir.

#### Gezgin Performansı

Büyük klasörlere ve medya dosyalarına göz atmak artık daha hızlıdır ve daha az bellek kullanır.

- **İlk yükleme**: dizinler açılırken ilk yükleme daha hızlı tamamlanır;
- **Simge yükleme**: özel ve sistem simgeleri daha az gecikmeyle görünür;
- **Liste kaydırma**: büyük dizinlerde daha akıcı liste kaydırma;
- **Medya önizlemeleri**: görsel, GIF ve video önizlemeleri daha duyarlıdır ve daha az bellek kullanır;
- **Dizin oluşturma**: genel arama için dizin oluşturma işlemi daha kararlıdır;

#### Ana Sayfa ve Bağlam Menüleri

- **Bağlantıyı kes**: desteklendiğinde ağ bağlantılarını veya çıkarılabilir aygıt bağlantılarını bağlam menüsünden kesin;
- **Tüm yinelenenleri kapat**: sekme menüsündeki `Tüm yinelenenleri kapat` seçeneği artık yalnızca geçerli sekmenin yinelenenlerini değil, çalışma alanındaki tüm yinelenen yolları kapatır;
- **Sağ tıklamayla seçimi temizleme**: gezginin boş arka planına sağ tıklamak, arka plan menüsü açılmadan önce geçerli seçimi temizler;
- **Ana sayfa eylemleri**: ana sayfa bağlam menüleri bir eylem seçildikten sonra kapanır, `Yeni sekmede aç` gezgini açar ve yeni sekmeler görünür alana kaydırılır;
- **Pencere sürükleme bölgesi**: Linux tarzı başlık çubuklarında sürükleme bölgesi, pencereyi daha kolay taşımak için araç çubuğu düğmelerinin üzerine uzanır;

![window-drag-region](./public/changelog/assets/2.2.0/window-drag-region.webp)

### Arayüz İyileştirmeleri

- **Etkin panel göstergesi**: bölünmüş görünüm açıkken durum çubuğunda etkin paneli daha net gösteren bir işaretçi;
- **Yeniden boyutlandırılabilir bilgi paneli**: bilgi panelinin genişliğini ve önizleme ile ayrıntılar arasındaki bölmeyi sürükleyerek yeniden boyutlandırın;
- **Kompakt bilgi paneli**: bilgi panelindeki özellikler için daha yoğun bir düzen;
- **Bağlam menüsü eylemleri**: `Kartı düzenle` seçeneği bir eylem düğmesi olarak gösterilir; eylem düğmeleri genel olarak daha küçüktür;
- **Gezgin stilleri**: uyarlanabilir düzen, bölünmüş görünümdeki etkin sekme stilleri ve komut paletindeki eklenti görünümü tasarımı iyileştirildi;
- **RTL düzen**: sağdan sola diller için daha temiz hizalama;

![resizable-info-panel](./public/changelog/assets/2.2.0/resizable-info-panel.webp)

![compact-info-panel](./public/changelog/assets/2.2.0/compact-info-panel.webp)

### Hata Düzeltmeleri

- **Yazarak arama**: Latin olmayan klavye düzenlerinde hızlı aramanın etkinleşmemesi düzeltildi;
- **Dizin yükleme**: bir dizin yüklendikten sonra girdilerin kendiliğinden yeniden sıralanması düzeltildi;
- **Özel simgeler**: özel simgelerin belirgin gecikmeyle yüklenmesi düzeltildi;
- **Izgara kartları**: ızgara düzeni kartlarının yüklenirken boyut değiştirmesi düzeltildi;
- **Izgara kaydırma çubuğu**: ızgara kaydırma çubuğunun yapışkan başlıkların arkasında gizlenmesi düzeltildi;
- **Hızlı seçim**: hızlı dosya seçiminin bazen dosyayı açması düzeltildi;
- **Terminal kısayolu**: `Alt+T` seçili girdi yerine geçerli dizin için terminal açacak şekilde düzeltildi;
- **Dosyaları aç**: açılan dosyaların yanlış çalışma dizininden başlatılması düzeltildi;
- **SMB paylaşımları**: SMB paylaşımlarındaki dosyaların açılamaması düzeltildi;
- **WSL yolları**: Windows'ta WSL ana bilgisayarının UNC yollarını işleme sorunu düzeltildi; `//wsl.localhost` sanal dağıtım listesine eklendi;
- **Varsayılan dosya yöneticisi**: ayar doğrudan Windows kurulumlarında kullanılmaya devam eder; Microsoft Store sürümünde artık kullanılamaz olarak gösterilir;
- **AppImage (Linux)**: `Could not create default EGL display: EGL_BAD_PARAMETER` hatası düzeltildi;
- **Eklenti yükleme (Linux)**: çok dosyalı dağıtım paketine sahip eklentilerdeki yükleme hataları düzeltildi;
- **Eklenti ayrıntıları**: genel bakış sayfasındaki hizalama stilleri düzeltildi;
- **Cihaz uyanması**: cihaz uyandıktan sonra uygulamanın yükleme durumunda takılması düzeltildi;
- **Güncelleme bildirimleri**: henüz yayımlanmamış sürümler için güncelleme bildirimlerinin görünmesi düzeltildi;
- **RTL**: sağdan sola düzen sorunları düzeltildi;
- **Çeviriler**: eksik ve yanlış çeviri dizeleri düzeltildi;

---

## [2.1.0] - May 2026

**Özet:** Gezgin performansındaki iyileştirmeler, otomatik oluşturulan küçük resimler, eklenti temaları, yazdırma, dosya önizlemeleri, yeni kısayollar, geliştirilmiş adres düzenleyici, yeniden tasarlanan durum merkezi ve sekme ile gezinti deneyimindeki iyileştirmeler.

- [Yeni Özellikler](#yeni-özellikler)
  - [Yazdırma](#yazdırma)
  - [Dosyaları Sekmelere Bırakma](#dosyaları-sekmelere-bırakma)
  - [Bilgi Panelinde Dosya Önizleme](#bilgi-panelinde-dosya-önizleme)
  - [Gezginin Liste Görünümü Sütunları](#gezginin-liste-görünümü-sütunları)
- [Eklentiler](#eklentiler)
  - [Eklentilerin Sağladığı Uygulama Temaları](#eklentilerin-sağladığı-uygulama-temaları)
  - [Eklentilerin Sağladığı Simge Temaları](#eklentilerin-sağladığı-simge-temaları)
- [Yeni Ayarlar](#yeni-ayarlar)
- [Yeni Kısayollar](#yeni-kısayollar)
- [Kullanıcı Deneyimi İyileştirmeleri](#kullanıcı-deneyimi-iyileştirmeleri)
  - [Büyük Dizin Performansı](#büyük-dizin-performansı)
  - [Hızlı Arama](#hızlı-arama)
  - [Adres Düzenleyici](#adres-düzenleyici)
  - [Durum Merkezi](#durum-merkezi)
  - [Gezinti ve Sekmeler](#gezinti-ve-sekmeler)
  - [Kısayol Yönetimi](#kısayol-yönetimi)
- [Arayüz İyileştirmeleri](#arayüz-iyileştirmeleri)
- [Hata Düzeltmeleri](#hata-düzeltmeleri)

### Yeni Özellikler

#### Yazdırma

Seçili dosyaları bağlam menüsü, eylemler menüsü veya `Ctrl+O` aracılığıyla doğrudan gezginden yazdırın.

- **Desteklenen biçimler**: görseller, PDF, metin biçimleri;
- **Hızlı çıkış**: yazdırma görünümünü `Escape` ile kapatın;

![printing](./public/changelog/assets/2.1.0/printing.webp)

#### Dosyaları Sekmelere Bırakma

Dosya veya dizinleri sekmelere sürükleyerek başka bir sekmede açık olan dizine taşıyın veya kopyalayın.

- **Bırakma hedefi olarak sekmeler**: gezginde dosya sürüklerken sekmeleri bırakma hedefi olarak kullanın;
- **Üzerine gelince etkinleştirme**: sürükleme sırasında bir sekmenin üzerinde beklediğinizde, öğeyi bırakmadan önce o sekme etkinleşir;
- **Bölünmüş sekmeler**: dizin sekme grupları, bölünmüş görünümün sekme yapısını korurken normal bırakma davranışını sürdürür;

![file-drop-to-tabs](./public/changelog/assets/2.1.0/file-drop-to-tabs.webp)

#### Bilgi Panelinde Dosya Önizleme

Bilgi paneli artık yalnızca görselleri ve videoları değil, Quick View'ın desteklediği tüm dosya türlerini önizleyebilir.

- **Medya önizlemeleri**: görseller için oluşturulan küçük resimler kullanılır, video ve ses dosyalarında yerel denetimler sunulur, PDF'ler ise panel içinde görüntülenir;
- **Metin önizlemeleri**: metin dosyaları, güvenli bir boyut sınırıyla kod çözümü yapılmış kompakt bir önizleme gösterir;
- **Yedek görünüm**: desteklenmeyen dosya ve klasörler için basit simge yer tutucuları gösterilmeye devam eder;

![info-panel-file-preview](./public/changelog/assets/2.1.0/info-panel-file-preview.webp)

#### Gezginin Liste Görünümü Sütunları

Liste görünümü artık daha fazla isteğe bağlı sütun sunuyor ve meta verilerin doğrudan satır üzerinden yönetilmesini kolaylaştırıyor.

- **Oluşturulma sütunu**: oluşturma tarihini görüntüleyin ve bu tarihe göre sıralayın;
- **Etiketler sütunu**: etiketleri doğrudan liste görünümünde görüntüleyin; sütun üzerinden etiket ekleyin, kaldırın veya düzenleyin;

![navigator-list-columns](./public/changelog/assets/2.1.0/navigator-list-columns.webp)

### Eklentiler

#### Eklentilerin Sağladığı Uygulama Temaları

Eklentiler artık uygulamanın tamamında kullanılabilen renk temaları sağlayabilir. Yüklü tema eklentileri tema seçicide görünür.

#### Eklentilerin Sağladığı Simge Temaları

Eklentiler artık klasörler ve dosyalar için gezgin simge temaları sağlayabilir.

- **Ayrı seçimler**: klasör ve dosya simge temalarını `Ayarlar > Arayüz görünümü > Simge teması` içinde bağımsız seçin;
- **Yerleşik ve eklenti temaları**: yerleşik varsayılan veya sistem simge temalarını ya da etkinleştirilmiş herhangi bir eklenti temasını kullanın;
- **Tema eşleştirme**: eklentilerin sağladığı temalar dosya uzantısına, dosya adına, klasör adına ve klasörün genişletilmiş olup olmamasına göre simgeler tanımlayabilir;

### Yeni Ayarlar

- **Etkin sekme metnini kalın yap**: etkin sekme başlığını kalın yapın (`Ayarlar > Sekmeler > Sekme görünümü > Etkin sekme metnini kalın yap`);

![bold-active-tab-text-setting](./public/changelog/assets/2.1.0/bold-active-tab-text-setting.webp)

### Yeni Kısayollar

- **Bölünmüş görünümü aç/kapat** (`Ctrl+S`): gezginde bölünmüş görünümü gösterin veya gizleyin;
- **Kapatılan sekmeyi geri yükle** (`Ctrl+Shift+T`): en son kapatılan sekme grubunu geri yükleyin;
- **Dosya / dizin oluştur** (`Ctrl+Shift+M` / `Ctrl+Shift+N`): geçerli dizinde yeni bir dosya veya dizin oluşturun;
- **Seçili dosyayı yazdır** (`Ctrl+O`): seçili dosyayı yazdırın;
- **Kopyalanan yolu aç** (`Ctrl+Shift+V`): panodaki geçerli bir yolu açın;
- **Sayfalar arasında geç** (`Alt+1` - `Alt+5`): Ana Sayfa, Gezgin, Gösterge Paneli, Ayarlar ve Eklentiler arasında geçiş yapın;
- **Dizin geçmişinde gezin** (`Alt+Left` / `Alt+Right`): gezgin geçmişinde geri veya ileri gidin;
- **Üst dizine git** (`Alt+Up`): üst dizine gidin;
- **Fare geçmiş düğmeleri** (`Mouse Button 4` / `Mouse Button 5`): farenin yan düğmeleriyle geri ve ileri gidin;

![create-file-directory-shortcuts](./public/changelog/assets/2.1.0/create-file-directory-shortcuts.webp)

![navigator-shortcuts](./public/changelog/assets/2.1.0/navigator-shortcuts.webp)

### Kullanıcı Deneyimi İyileştirmeleri

#### Büyük Dizin Performansı

Gezinti, hızlı arama ve yoğun medya içeren klasörler artık daha hızlı yanıt verir ve daha az bellek kullanır.

- **Oluşturulan küçük resimler**: her dosya kartında tam boyutlu medya yüklemek yerine görsel ve videolar için daha küçük boyutlarda önizlemeler oluşturulur;
- **Aşamalı görseller**: ızgara görsel kartları, nihai küçük resim hazır olana kadar bulanık düşük çözünürlüklü bir küçük resim gösterebilir;
- **Küçük resim oluşturmayı iptal etme**: klasör veya görünür girdiler değiştiğinde küçük resim oluşturma işlemi iptal edilebilir;
- **Görüntüleme performansı**: büyük dizinlerdeki girdiler daha verimli görüntülenir; Quick View ise oluşturulan küçük resimleri sanal bir listeyle gösterir;

![low-res-image-thumbnail-preview](./public/changelog/assets/2.1.0/low-res-image-thumbnail-preview.webp)

#### Hızlı Arama

Hızlı aramanın artık iki modu vardır: pasif ve etkin:

- **Pasif mod**: yazmaya başladığınızda otomatik olarak etkinleşir. Arama alanına odaklanmadan girdileri filtreler ve gezinmeyi engellemez.
- **Etkin mod**: `Ctrl+F` ile etkinleşir. Arama alanına odaklanır ve gezinmeyi engeller ancak girilen sorgu üzerinde daha ayrıntılı denetim sağlar.

Diğer değişiklikler:

- **Yazarak filtreleme**: alfasayısal tuşlara basmak artık etkin panelde her zaman hızlı aramayı (pasif mod) başlatır;
- **Klavye gezintisi**: ilk eşleşen öğe otomatik seçilir;
- **Açılır panel tasarımı**: hızlı arama paneli artık daha kompakttır ve dizin öğelerinin üzerini kapatmaz;

![quick-search](./public/changelog/assets/2.1.0/quick-search.webp)

#### Adres Düzenleyici

Adres düzenleyici artık daha kapsamlı bir yol açma aracı olarak kullanılabilir.

- **Dosyalar ve dizinler**: adres düzenleyiciden dizinlerin yanı sıra dosyaları da açın;
- **Sık kullanılan yollar**: sık kullandığınız yolları hızla açmaya odaklanan moda geçin;
- **Öneriler**: dizin girdilerine, tam eşleşmelere, son yollara, etiketli öğelere, kullanıcı klasörlerine ve sistem sürücülerine göz atın;
- **Klavye eylemleri**: düzenleyiciden geri, ileri veya yukarı gidin ve bir girdiyi üst dizininde görüntüleyin;

![address-editor](./public/changelog/assets/2.1.0/address-editor.webp)

#### Durum Merkezi

Durum merkezi artık daha anlaşılır işlem grupları sunan, araç çubuğuna yerleştirilmiş kompakt bir bileşendir.

- **Etkin işlem sayısı**: araç çubuğu düğmesi, etkin işlem sayısını gösteren bir rozete dönüşür;
- **İşlem grupları**: etkin ve tamamlanan işlemler birbirinden ayrılır; tamamlanan işlemler daraltılabilir bir bölümde gösterilir;
- **Tümünü iptal et**: etkin işlemlerin tümünü bölüm başlığından tek seferde iptal edin;
- **İşlem kartları**: işlem kartlarında `Kopyalama | Başarılı` veya `Arşiv | Hata` gibi daha anlaşılır tür ve durum etiketleri gösterilir;
- **Pano kurtarma**: yapıştırma işlemi, bir görev kuyruğa alındığında panoyu hemen temizler ve görev başarısız olursa içeriği geri yükler;

![status-center](./public/changelog/assets/2.1.0/status-center.webp)

#### Gezinti ve Sekmeler

Gezginde dolaşma ve sekme davranışları artık daha öngörülebilirdir.

- **Kenar çubuğundaki sürücüler**: gezinti kenar çubuğunda bir sürücüye tıkladığınızda sürücü geçerli sekmede açılır;
- **Geçerli dizin**: adresin geçerli dizini gösteren son bölümü daha belirgindir; bu bölümün bağlam menüsü, üzerine sağ tıklayarak açılır;
- **Kapatılan sekmeler**: geri yüklenen sekmeler önceki konumlarına döner, yeniden adlandırılmış yolları korur ve silinen yolları ana sayfaya yönlendirir;
- **Duyarlı düzen**: araç çubuğundaki gezinti düğmeleri daha erken daralır, çok dar panellerde bölünmüş görünüm adres çubukları ikinci satıra geçer ve kompakt sekmeler tutarlı yüksekliklerini korur;

![nav-sidebar-drive-current-tab](./public/changelog/assets/2.1.0/nav-sidebar-drive-current-tab.webp)

![current-directory-address-bar](./public/changelog/assets/2.1.0/current-directory-address-bar.webp)

#### Kısayol Yönetimi

Kısayol düzenleme arayüzü artık çakışmaları ve özelleştirmeleri daha anlaşılır biçimde yönetir.

- **Birden fazla atama**: bir eyleme birden fazla kısayol atayın;
- **Kısayol atamasını kaldırma**: atanmış kısayolları kaldırın;
- **Çakışan kısayolu değiştirme**: çakışan bir kısayolu doğrudan çakışma iletişim kutusundan değiştirin;
- **Kısayol listesi menüsü**: kısayol listesindeki bir bağlam menüsünden kısayolları yönetin;

![shortcut-editor](./public/changelog/assets/2.1.0/shortcut-editor.webp)

#### Sürükle ve Bırak

`Alt+Tab` ile uygulamalar arasında geçerken dışarı sürükleme işlemini başlatabilirsiniz. Böylece dosyaları, yalnızca imleci pencerenin dışına çıkararak değil, uygulama değiştirerek de dışarı sürükleyebilirsiniz;

### Arayüz İyileştirmeleri

- **Seçim halkası**: gezgin seçim halkasının opaklığı ve konumu, panel başlığı stilleri ve klavye odak davranışı iyileştirildi;
- **Sekme çubuğu**: sekme çubuğunun stilleri ve etkin sekmenin okunabilirliği iyileştirildi;
- **Tema seçimi**: tema seçme arayüzünün tasarımı iyileştirildi;
- **Hızlı erişim**: hızlı erişim panelinin stilleri geliştirildi;
- **Açılış ekranı**: uygulama başlatılırken gösterilen bir açılış ekranı eklendi;
- **Açılır panel görünürlüğü**: yarı saydam açılır panel öğelerinin görünürlüğü iyileştirildi;
- **Araç ipuçları**: daha fazla araç çubuğu düğmesine araç ipuçları eklendi;
- **Çeviriler**: Japonca ve Vietnamca çeviri metinleri iyileştirildi, yerelleştirme yapısı sadeleştirildi;

![selection-ring](./public/changelog/assets/2.1.0/selection-ring.webp)

![tab-bar-styles](./public/changelog/assets/2.1.0/tab-bar-styles.webp)

![narrow-window-layout](./public/changelog/assets/2.1.0/narrow-window-layout.webp)

### Hata Düzeltmeleri

- **Eşlenmiş sürücüler**: eşlenmiş ağ sürücülerinden uygulama dışına sürükleyip bırakmanın çalışmaması düzeltildi;
- **Klavye kaydırma**: ilk satırın yapışkan başlığın arkasında gizlenmesi düzeltildi;
- **Başlangıç donması**: başlangıç ve güncelleme kontrolleri sırasında yavaş senkron sistem çağrılarının neden olduğu nadir çok dakikalık Windows başlangıç donmaları düzeltildi;
- **Arşiv çıkarma**: arşivler çıkarılırken Unix dosya modları korundu;
- **Eklenti HTTP istekleri**: kalıcı 2xx dışı yanıtların işlenmesi yeniden sağlandı ve yeniden denemeler arasındaki bekleme iptal edilebilir hale getirildi;
- **Komut paleti**: kısayolu özelleştirildiğinde komut paleti araç çubuğu düğmesi düzeltildi;
- **Izgara aralık seçimi**: ızgara görünümünde aralık seçiminin kapsam dışındaki girdileri seçmesi düzeltildi;
- **Bağlam menüleri**: seçili öğe ve geçerli dizin bağlam menülerinin eylem tıklamalarından sonra açık kalması düzeltildi;
- **Kısayol kaydı**: pencere yeniden yüklemesinden sonra kısayol kayıt hataları düzeltildi;
- **Tema uygulama**: seçili temaların tüm pencerelerde uygulanmaması düzeltildi;
- **macOS taşıma işlemleri**: macOS'ta birimler arası taşıma işlemleri düzeltildi ve paket hedeflerine taşıma etkinleştirildi;
- **Varsayılan dosya yöneticisi**: etkinleştirme başarısız olduğunda veya önceki sistem değerleri geri yüklenirken Windows'un varsayılan dosya yöneticisi kayıt defteri değerlerinin daha güvenli biçimde geri yüklenmesi sağlandı;

![keyboard-scroll-floating-header](./public/changelog/assets/2.1.0/keyboard-scroll-floating-header.webp)

---
## [2.0.0-beta.3] - April 2026

**Özet:** Mağazalı eklenti sistemi, LAN dosya paylaşımı, hızlı erişim menüsü, zip arşivleri, WSL sürücüleri, etiket düzenleme, geliştirilmiş hızlı önizleme ve arama, görsel efekt iyileştirmeleri ve birçok kullanıcı deneyimi ve kararlılık iyileştirmesi.

### Yeni Özellikler

#### Eklenti Sistemi

Açık mağazalı tam eklenti sistemi.

- **Mağaza**: mağazadan eklentilere göz atın, yükleyin ve yönetin;
- **Yerel yükleme**: eklentileri yerel klasörden yükleyebilirsiniz;
- **Komut paleti**: uygulama ve eklenti komutlarını etkinleştirmenin yeni yolu;
- **Yetenekler**: eklentiler yerel ve genel kısayolları, bağlam menüsü öğelerini, ayarları, tam sayfaları ve komutları kaydedebilir;
- **Sürüm yönetimi**: eklentilerin farklı sürümlerini yükleyebilir ve otomatik güncellemeyi etkinleştirebilirsiniz;
- **Yerelleştirme**: eklentiler farklı diller için çeviriler sağlayabilir;
- **İkili dosya yönetimi**: eklentiler ikili dosyaları kullanabilir (ffmpeg, deno, node, yt-dlp, 7z ve diğer mevcut ikili dosyalar);
- **Korumalı çalıştırma**: eklentiler ayrıntılı izinlerle yalıtılmış ESM korumalı alanlarında çalışır;

#### Varsayılan dosya yöneticisi

Artık SFM'yi Windows'ta varsayılan dosya yöneticisi yapabilirsiniz (`Ayarlar > Deneysel`). Bu ayar etkinleştirildiğinde, çoğu sistem dosya eylemi SFM'ye yönlendirilir:

- Dosya Gezgini uygulama simgesi;
- `Ctrl+E` kısayolu;
- Dosyayı klasörde göster;
- İndirmeleri göster (tarayıcıda dosya indirdiğinizde);
- Terminal komutları: "start {yol}", "code {yol}" vb.
- Ve daha fazlası;

"Geri Dönüşüm Kutusu", "Denetim Masası" gibi yerel sistem görünümleri ve bu tür derinden entegre programlar yerel Dosya Gezgini'ne geri yönlendirilir.

#### LAN Paylaşımı

Dosya ve dizinleri doğrudan uygulamadan yerel ağınız üzerinden paylaşın ve yayınlayın.

LAN paylaşımına gezgin araç çubuğundaki düğmeden veya herhangi bir dosya ya da dizin üzerindeki bağlam menüsünden erişin. Bir paylaşım etkin olduğunda, QR kodu ve paylaşılabilir URL'ler görüntülenir. İki mod mevcuttur:

- **Yayınlama**: dosya ve dizinleri web tarayıcısı aracılığıyla ağınızdaki herhangi bir cihaza yayınlayın;
- **FTP**: diğer uygulamalardan doğrudan erişim için dosyaları FTP üzerinden paylaşın. Diğer cihazdan bilgisayara dosya indirebilir ve yükleyebilirsiniz;

#### Hızlı Erişim Menüsü

Kenar çubuğundaki "Gösterge Paneli" düğmesi artık hızlı erişim menüsü olarak çalışır. Üzerine geldiğinizde Sık Kullanılanlarınızı ve Etiketli öğelerinizi gösteren bir panel açılır.

Paneldeki tüm öğeler gerçek dizin girdileridir - öğeleri sürükleyip bırakabilir, sağ tıkla bağlam menülerini açabilir ve tüm standart dosya işlemlerini gerçekleştirebilirsiniz.

`Ayarlar > Arayüz görünümü > Fareyle üzerine gelindiğinde hızlı erişim panelini aç` bölümünden devre dışı bırakılabilir.

#### Zip Arşivleri

Dosya tarayıcısı eylemler menüsünden doğrudan zip arşivlerini sıkıştırın ve çıkarın:

- **Çıkar**: bir `.zip` dosyasını geçerli dizine veya adlandırılmış bir klasöre çıkarın;
- **Sıkıştır**: seçili dosya ve dizinleri bir `.zip` arşivine sıkıştırın;

#### WSL Sürücü Algılama

Windows'ta uygulama artık yüklü WSL dağıtımlarını otomatik olarak algılar ve sürücülerini gezginde göstererek WSL dosya sistemlerini yerel olarak gezmenize olanak tanır.

#### Etiket Düzenleme

Artık etiket adlarını ve renklerini düzenleyebilirsiniz. Etiketleri yeniden adlandırmak, renklerini değiştirmek veya silmek için herhangi bir dosya ya da dizinde etiket seçiciyi açın.

#### Uygulama İçi Güncellemeler

Artık uygulamadan çıkmadan güncelleme bildiriminden doğrudan güncellemeleri indirip yükleyebilirsiniz.

#### Yolu Kopyala

Dosya ve dizin bağlam menüsüne "Yolu kopyala" seçeneği eklendi.

#### Yinelenen Sekmeleri Kapat

Sekme çubuğundan yinelenen sekmeleri kapatma özelliği eklendi; aynı dizine işaret eden tüm sekmeler kaldırılır.

#### Ana Sayfa ve Gösterge Paneli Bağlam Menüleri

Ana sayfa ve gösterge panelindeki öğeler artık gezginde mevcut olan işlevsellikle eşleşen tam bağlam menülerine sahiptir.

### Yeni Ayarlar

- **Ana sayfa medya afişini göster**: ana sayfa medya afişini gösterin veya gizleyin (`Ayarlar > Arayüz görünümü > Ana sayfa medya afişi`);
- **Araç ipucu gecikmesi**: araç ipuçlarının görünmesinden önceki gecikmeyi yapılandırın (`Ayarlar > Arayüz görünümü > Araç ipuçları`);
- **Göreli zaman**: son zaman damgalarını göreli biçimde görüntüleyin, ör. "5 dk önce" (`Ayarlar > Genel > Tarih / saat`);
- **Tarih ve saat biçimi**: ay biçimini, bölgesel biçimi, 12 saatlik saati, saniyeleri ve milisaniyeleri yapılandırın (`Ayarlar > Genel > Tarih / saat`);
- **İletişim kutusu arka plan bulanıklığı**: iletişim kutusu arka planları için bulanıklık yoğunluğunu ayarlayın (`Ayarlar > Arayüz görünümü > Stil ayarları`);
- **Parlaklık ve kontrast filtreleri**: uygulama arayüzü için parlaklık ve kontrast stil filtrelerini ayarlayın (`Ayarlar > Arayüz görünümü > Stil ayarları`);
- **Kaplama medya parlaklığı**: görsel efektler kaplama medyasının parlaklığını ayarlayın (`Ayarlar > Arayüz görünümü > Görsel efektler`);
- **Görsel Efektler Karıştırma Modu**: arka plan medyasının uygulama arayüzüyle nasıl karıştığını seçmenize olanak tanıyan görsel efektler için karıştırma modunu ayarlayın (`Ayarlar > Arayüz görünümü > Görsel efektler`);
- **Arka plan videosunu duraklat**: uygulama boşta veya simge durumuna küçültülmüşken ana sayfa afişini ve arka plan videosunu duraklatın (`Ayarlar > Arayüz görünümü > Görsel efektler`);
- **Varsayılan dosya yöneticisi**: Sigma File Manager'ı Windows'ta varsayılan dosya gezgini olarak ayarlayın (`Ayarlar > Deneysel`);
- **Sistem girişinde başlat**: sisteme giriş yaptığınızda uygulamayı otomatik olarak başlatın (`Ayarlar > Genel > Başlangıç davranışı`);

### Yeni Kısayollar

- **Geçerli dizin yolunu kopyala** (`Ctrl+Shift+C`): geçerli dizin yolunu panoya kopyalayın;
- **Geçerli dizini yenile** (`F5`): gezgin dosya listesini yenileyin;
- **Yakınlaştır / uzaklaştır** (`Ctrl+=` / `Ctrl+-`): arayüz yakınlaştırmasını artırın veya azaltın;
- **Tam ekran** (`F11`): tam ekran modunu açın/kapatın;

### Yeni Diller

- **Hintçe**;
- **Urduca**;

### Kullanıcı Deneyimi İyileştirmeleri

#### Hızlı Önizleme İyileştirmeleri

- **Medya gezintisi**: hızlı önizlemeyi kapatmadan geçerli dizindeki dosyalar arasında gezinin;
- **Metin dosyası önizlemesi**: doğru kodlama algılama, satır içi düzenleme ve ayrıştırılmış markdown oluşturma ile geliştirilmiş metin dosyası önizlemesi;

#### Hızlı Arama İyileştirmeleri

- **Tüm özellikler**: herhangi bir dosya özelliğine göre arama yapın - ad, boyut, öğe sayısı, değiştirilme, oluşturulma, erişilme, yol veya MIME türü (ör. `modified: today`, `mime: image`);
- **Boyut aralıkları**: karşılaştırmalar ve aralıklar kullanarak boyuta göre filtreleyin (ör. `size: >=2mb`, `size: 1mb..10mb`);

#### Dosya İşlemleri

- **Çakışma çözümü güvenliği**: kazara veri kaybını önlemek için çakışma çözümü penceresindeki dosya güvenliği iyileştirildi;
- **Tek kullanımlık yapıştırma**: kopyalanan öğeler yalnızca bir kez yapıştırılabilir, kazara yinelenen yapıştırmaları önler;
- **Metin kopyalama**: dosya seçili değilken `Ctrl+C` ile arayüz metnini kopyalamaya izin verir;

#### Görsel Efektler

- **Arka plan yöneticisi**: merkezi arka plan özelleştirmesi için ayarlar sayfasına arka plan yöneticisi eklendi;
- **Arka plan efektlerini sıfırla**: arka plan efektleri ayarlarına sıfırlama düğmesi eklendi;

#### Diğer

- **Uygulama boyutu küçültme**: yüksek çözünürlüklü yerleşik arka planlar hariç tutularak ve medya afişi düzenleyicisinde sıkıştırılmış önizlemeler kullanılarak uygulama paketi boyutu küçültüldü;
- **Genel arama**: boş durumda "ayarları göster" düğmesi gösteriliyor ve varsayılan arama derinliği artırıldı;
- **Windows kısayolları**: `.lnk` dosyaları artık harici olarak başlatmak yerine hedeflerini gezginde açar;
- **Gösterge paneli**: etiketli bölüm düzeni iyileştirildi;
- **Adres çubuğu bağlam menüsü**: adres çubuğu öğelerine bağlam menüsü eklendi;
- **Gezgin bağlam menüsü**: gezginde boş alana tıklandığında bağlam menüsü gösterme;
- **Yeni sekmede aç**: orta fare düğmesi tıklamasıyla dizinleri yeni sekmede açın;
- **Sekme kaydırma**: yeni eklenen sekmeler otomatik olarak görünüme kaydırılır;
- **Menü odağı**: menüler artık dışarı tıklanarak kapatıldığında tetikleyici düğmelerine odak döndürmez;
- **Aramayı kapat**: `Escape` ile genel aramayı kapatın;
- **Daha hızlı başlatma**: ayarların Rust'ta önceden yüklenmesiyle uygulama başlatma hızı hafifçe iyileştirildi;
- **Kullanıcı dizinleri**: ana sayfada kullanıcı dizinleri ekleme ve kaldırma özelliği eklendi;
- **Liste sınırları**: performansı artırmak için sık kullanılan ve geçmiş listesi girdileri sınırları azaltıldı;

### Arayüz İyileştirmeleri

- **Araç çubuğu simgeleri**: uygulama genelinde araç çubuğu simge renkleri birleştirildi;
- **Kart animasyonları**: kartlara kademeli ve belirme efektleri eklendi;
- **Açık tema**: açık tema renkleri ve kontrastı iyileştirildi;
- **Başlatma kararlılığı**: titreşimi azaltmak için uygulama başlatma sırasında görsel kararlılık iyileştirildi;
- **Bildirimler**: daha iyi tutarlılık için bildirim tasarımı iyileştirildi;
- **Sekme otomatik kaydırma**: gezgin sayfası açılırken seçili sekme otomatik olarak görünüme kaydırılır;
- **Kök yol etiketleri**: sekmeler ve bilgi paneli genelinde kök yol etiketleri normalleştirildi;
- **Çeviriler**: uygulama genelinde çeviriler iyileştirildi;

### Hata Düzeltmeleri

- Birçok öğe kopyalama veya taşımanın arayüzü dondurması düzeltildi; durum merkezine dosya işlemi ilerlemesi eklendi;
- Birçok öğe silmenin arayüzü dondurması düzeltildi; durum merkezine silme ilerlemesi eklendi;
- Izgara düzeninde başka bir öğenin zaten menüsü açıkken geçerli dizin için bağlam menüsünün açılmaması düzeltildi;
- Bilgi panelinin geçerli dizin için tüm bilgileri göstermemesi düzeltildi;
- Uygulama kısayollarının yalnızca ana pencere yerine hızlı önizleme penceresinde kaydedilmesi düzeltildi;
- Web tarayıcılarından sürüklenen dosyaların işlenmemesi düzeltildi;
- Harici URL bırakmalarından gelen dosya adlarının geçerli segmentleri korumaması düzeltildi;
- Ana sayfa afişinin sürüklenebilir olması düzeltildi;
- Dosya yoluna göre anahtarlanmayan sistem simgesi önbelleğinin yanlış simgelere neden olması düzeltildi;
- Gezginde erişilemeyen Windows kök girdilerinin gösterilmesi düzeltildi;
- Bazı klavye düzenlerinde özel kısayolların tanınmaması düzeltildi;
- Linux'ta SSHFS bağlantıları düzeltildi;
- Kırıntı tıklamasında adres çubuğunun yinelenen geçmiş girdileri oluşturması düzeltildi;
- Genel arama sonuçlarının klavye gezintisine yanıt vermemesi düzeltildi;
- Genel arama sonuçlarının tıklamada açılmaması düzeltildi;
- Artımlı indekslemeden sonra genel arama durumunun eşitlenmemesi düzeltildi;
- Bazı uygulamalarda giden dosya sürükle-bırakın çalışmaması düzeltildi;
- Uygulama genelinde tutarsız kısayol rozeti tasarımı düzeltildi;
- Dar panellerde gezgin sütun görünürlüğü düzeltildi;

---

## [2.0.0-beta.2] - February 2026

**Özet:** Genel kısayollar, yeni ayarlar, yeni özellikler, geliştirilmiş dosya filtreleme, geliştirilmiş adres çubuğu, ana sayfa afişi iyileştirmeleri ve hata düzeltmeleri.

### Genel Kısayollar

Artık uygulama odakta olmasa bile klavye kısayollarını kullanarak uygulamayla etkileşim kurabilirsiniz.

Eklenen kısayollar:

- Uygulama penceresini göstermek ve odaklamak için `Win+Shift+E`;

### Yeni ayarlar

Son sekme kapatıldığında ne olacağını seçmek için ayar eklendi.

![Son sekmeyi kapat ayarı](./public/changelog/assets/beta-2/setting-close-last-tab.png)

### Yeni özellikler

Yeni erken önizleme özellikleri eklendi:

- Ağ konumları: bir ağ konumuna bağlanmanızı sağlar (SSHFS (SSH) / NFS / SMB / CIFS);
- [Linux] Sürücü bağlama: konumları ayırmanızı sağlar;

### Dosya Filtresi

Dosya filtresi iyileştirildi:
- Artık dizin değiştirdiğinizde otomatik olarak temizlenir ve kapanır;
- "Yazarken filtrele" özelliği ilk panelde değil, seçili panelde etkinleşir;

### Adres Çubuğu

- Geliştirilmiş tasarım ve otomatik tamamlama mantığı;
- Yol ayırıcıları artık herhangi bir üst dizine hızlı gezinti sağlayan açılır menülerdir;

![Ayırıcı menüleri](./public/changelog/assets/beta-2/divider-menus.png)

### Ana Sayfa Afişi / Arka Plan Efektleri

- Geliştirilmiş medya afişi düzenleyici tasarımı:
  - Medya afişi seçenekler menüsü artık görünümü engellemamek için aşağı doğru açılır;
  - Artık arka plan konumu düzenleyicisini kapatmak için dışarı tıklayabilirsiniz;
  - URL girişi özel arka planların üstüne taşındı;
- Özel resimler/videolar arka plan görsel efektlerinde kullanılabilir;
- Bazı varsayılan medya afişi resimleri kaldırıldı;
- Yeni afiş resmi "Exile by Aleksey Hoffman" eklendi;

### Kullanıcı Deneyimi İyileştirmeleri

- Uygulama başlatıldığında önceki pencere konumunu geri yükler;
- Geçerli sekme artık `Ctrl+W` kısayolu veya orta fare düğmesi tıklamasıyla kapatılabilir;
- Izgara düzeni görünümünde dosya simgesi boyutu artırıldı;

### Hata Düzeltmeleri

- Sekmeler arasında dosya taşımanın bazen yanlış konuma taşıması düzeltildi;
- Gezginin bazen dizinler için yanlış sistem simgeleri göstermesi düzeltildi;
- Birden fazla uygulama ve sistem tepsisi örneği oluşturulması düzeltildi;
- Kabuk eklentileri menüsünün düzenli olarak verileri yeniden alarak listeyi sürekli en üste kaydırmaya zorlaması düzeltildi;

## [2.0.0-beta.1] - February 2026

**Özet:** Klavye gezintisi, yeni kısayollar, terminalde açma, dizin otomatik yenileme, sürükle-bırak ve geliştirilmiş arama ve liste görünümleri dahil büyük kullanılabilirlik ve tasarım iyileştirmeleri.

### Klavye Gezintisi

Izgara ve liste düzenleri ve bölünmüş görünüm için tam destekle klavye kullanarak dosyalarda gezinin.

- Izgara görünümünde mekansal gezinti ve liste görünümünde sıralı gezinti için ok tuşları;
- Seçili dizin veya dosyayı açmak için Enter, geri gitmek için Backspace;
- Bölünmüş görünüm panelleri arasında odak geçişi için Ctrl+Sol / Ctrl+Sağ;
- Geçerli dizini yeni sekmede açmak için Ctrl+T;
- Tüm gezinti kısayolları Ayarlar > Kısayollar bölümünde özelleştirilebilir;

### Dizin Otomatik Yenileme

Gezgin görünümü, geçerli dizinde dosyalar oluşturulduğunda, silindiğinde, yeniden adlandırıldığında veya değiştirildiğinde otomatik olarak yenilenir.

- Harici uygulamalar tarafından değiştirildiğinde dosya boyutları otomatik olarak güncellenir;
- Aşırı yenilemeleri önlemek için geciktirmeli verimli dosya sistemi izleme;
- Akıllı fark tabanlı güncellemeler yalnızca etkilenen öğeleri değiştirir, kaydırma konumunu ve seçimi korur;

### Sürükle ve Bırak

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/beta-1/drag-and-drop.mp4"></video>

Artık dosya ve klasörleri kolayca kopyalamak/taşımak için sürükleyebilirsiniz. Paneller arasında, arama sonuçları listelerinden veya listelerine, harici uygulamalardan veya uygulamalara sürükleyin.

### Kopyalama Çakışmaları

Kolay kopyalama/taşıma çakışma çözümü için modal pencere eklendi.

### Otomatik Güncelleme

Otomatik güncelleme kontrolü eklendi (ayarlardan kontrol edilebilir).

### Ana Sayfa Afişi Medya Düzenleyici

Ana sayfa afişi özelleştirmesi için düzenleyici eklendi. Artık özel resim ve videolar yükleyebilirsiniz (hem yerel hem de uzak URL dosyaları desteklenir).

### Liste Görünümü İyileştirmeleri

- Geliştirilmiş tasarım ve küçük rahatsızlıklar düzeltildi;
- Sütun görünürlüğü özelleştirmesi eklendi: hangi sütunların görüntüleneceğini seçin;
- Sütun sıralaması eklendi: girdileri sıralamak için sütun başlıklarına tıklayın;
- Varsayılan gezgin düzeni liste görünümüne değiştirildi;

### Genel Arama İyileştirmeleri

- Sürükle-bırak desteğiyle güncellenmiş düzen ve tasarım;
- Sürücüler hâlâ indekslenirken arama artık kullanılabilir;

### Terminalde Aç

Dizinleri doğrudan bağlam menüsünden tercih ettiğiniz terminalde açın.

- Windows, macOS ve Linux'ta yüklü terminallerin otomatik algılanması;
- Windows Terminal, yürütülebilir simgeleriyle tüm yapılandırılmış kabuk profillerini gösterir;
- Linux varsayılan terminali otomatik algılanır ve ilk sırada gösterilir;
- Normal ve yönetici/yükseltilmiş modları içerir;
- Varsayılan kısayol: Alt+T;

### Yerelleştirme

- Slovence dili eklendi (teşekkürler: @anderlli0053);

### Arayüz / Kullanıcı Deneyimi İyileştirmeleri

- Yazı tipi seçici eklendi: yüklü sistem yazı tiplerinden arayüz yazı tipini seçin;
- Hızlı dosya veya dizin oluşturmak için "Yeni oluştur" menüsü eklendi;
- Boş dizinlere gidildiğinde boş durum görünümü gösteriliyor;
- Durum çubuğu, liste filtrelendiğinde gizli sayısıyla birlikte toplam öğeleri gösterir;
- Yeni oluşturulan, kopyalanan ve taşınan öğeler otomatik olarak görünüme kaydırılır;
- Pano araç çubuğu her panelde yerine panellerin altında bir kez gösterilir;
- Basitleştirilmiş yeniden adlandırma modal tasarımı;
- Küçük pencere boyutlarında açılır menüye daralan duyarlı araç çubuğu simgeleri;
- Ayarlardan boş "Gezinti" sekmesi kaldırıldı;
- Bir dizini yeniden adlandırmak artık yolunu tüm sekmeler, çalışma alanları, sık kullanılanlar, etiketler, geçmiş ve sık kullanılan öğeler genelinde günceller;
- Bir dosya veya dizini silmek artık onu tüm depolanan listelerden kaldırır ve etkilenen sekmeleri ana sayfaya yönlendirir;
- Sık kullanılanlar, etiketler, geçmiş ve sık kullanılan öğelerdeki mevcut olmayan yollar artık başlangıçta otomatik temizlenir;

### Hata Düzeltmeleri

- Genel arama indeksleme durumunun gerçek zamanlı güncellenmemesi düzeltildi;
- Bölünmüş görünüm panelinin dizini diğer panelden silindiğinde veya yeniden adlandırıldığında güncellenmemesi düzeltildi;
- Depolanan yolları artık mevcut olmayan sekmelerinin hatayla yüklenmesi düzeltildi;
- Sistem simgelerinin dosya başına benzersiz simgeler yerine aynı türdeki tüm dosyalar için aynı simgeyi göstermesi düzeltildi;
- Bölünmüş görünümün ikinci panelinde klavye kısayollarının çalışmaması düzeltildi;
- Sayfa gezintisinden sonra klavye kısayollarının çalışmayı durdurması düzeltildi;
- Kaldırma sırasında temizlenmeyen filtre tuş dinleyicileriyle bellek sızıntısı düzeltildi;
- Linux: "birlikte aç" menüsünde varsayılan uygulama alma desteği eklendi;

---

## [2.0.0-alpha.6] - January 2026

**Özet:** Yenilikler penceresi, Hızlı Önizleme, bağlam menüsü geliştirmeleri ve yeni ayarlar.

### Yenilikler Penceresi

Her sürüm için yeni özellikleri ve iyileştirmeleri gösteren bir değişiklik günlüğü penceresi.

- Güncellemelerden sonra otomatik olarak görünür (devre dışı bırakılabilir);
- Tüm sürümler arasında gezinin;
- Her özellik için ayrıntılı açıklamaları ve ekran görüntülerini görün;

### Hızlı Önizleme

Hafif bir önizleme penceresi kullanarak dosyaları tamamen açmadan önizleyin.

- Dosyaları hızlıca görüntülemek için `Space` tuşuna veya bağlam menüsündeki "Hızlı önizleme" seçeneğine basın;
- `Space` veya `Escape` ile anında kapatın.
- Resimleri, videoları, sesleri, metin dosyalarını, PDF'leri ve daha fazlasını destekler;

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/alpha-6/quick-view.mp4"></video>

### Dizin Boyutu Hesaplama

- Dizinlerin boyutu artık otomatik olarak hesaplanır;
- Herhangi bir dizini açar açmaz tüm alt dizinler ve dosyalar dahil tüm dizinlerin toplam boyutunu görebilirsiniz;

![Birlikte Aç](./public/changelog/assets/alpha-6/size.png)

### Yeni Bağlam Menüsü Seçenekleri

#### Birlikte Aç

- Bir dosyayı hangi uygulamayla açacağınızı seçin;
- Dosyaları bayraklarla uygulamalarda açmak için özel ön ayarlar yapın;
- Herhangi bir dosya türü için tüm uyumlu uygulamaları görüntüleyin;
- Belirli dosya türleri için varsayılan uygulamaları ayarlayın;

![Birlikte Aç](./public/changelog/assets/alpha-6/open-with.png)

#### Kabuk Eklentileri

- Windows kabuk bağlam menüsü öğelerine erişin;
- Üçüncü taraf kabuk eklentilerine erişin (7-Zip, Git vb.);

![Kabuk Eklentileri](./public/changelog/assets/alpha-6/shell-extensions.png)

### Yeni Ayarlar

#### Sürücü Algılama

- Çıkarılabilir sürücüler bağlandığında uygulamayı odaklar (devre dışı bırakılabilir);
- Çıkarılabilir sürücüler için Windows Gezgini otomatik açma davranışını kontrol edin;

#### Yazarken Filtrele

Geçerli dizindeki öğeleri anında filtrelemek için gezginde herhangi bir yerde yazmaya başlayın;

#### Ayar Arama Kısayolu

Ayar aramasına hızlı erişim için yeni klavye kısayolu;

#### Kullanıcı İstatistik Verileri

- İstatistik ayarları bölümü eklendi;
- Gösterge paneli sayfasında geçmişi, sık kullanılanları ve sık kullanılan öğeleri görüntüleyebilir, gezinebilir ve temizleyebilirsiniz;

### Arama İyileştirmeleri

Daha güvenilir ve güncel sonuçlar için hibrit indeksli + doğrudan arama sistemiyle geliştirilmiş genel arama.

- Aramalar artık dosyaların sürücülerinizde nerede olduğuna bakılmaksızın tutarlı olarak 1 saniyeden az sürer (~1 TB tamamen dolu sürücü);
- "Öncelikli yollarınızda" (sık açtığınız yollar) arama yaptığınızda, sonuçları anında alırsınız ve henüz oluşturulmuş ve indekslenmemiş dosyaları bile bulur.

#### Öncelikli yollar şunları içerir:
- Kullanıcı dizinleri: İndirilenler, Belgeler, Masaüstü, Resimler, Videolar, Müzik;
- Sık kullanılanlar;
- Son açılanlar;
- Sık kullanılanlar;
- Etiketliler;

---

## [2.0.0-alpha.5] - January 2026

**Özet:** Dosya işlemleri, genel arama ve kısayol özelleştirmesi.

### Genel Arama

Tüm sürücülerinizde dosyaları indeksleyen ve arayan güçlü tam disk araması. Yazım hatalarıyla bile dosyaları bulmak için bulanık eşleştirme, otomatik periyodik yeniden indeksleme, sık kullanılan dizinler için öncelikli indeksleme ve daha hızlı indeksleme için isteğe bağlı paralel tarama özellikleri sunar.

![Genel Arama](./public/changelog/assets/alpha-5/search.png)

### Dosya İşlemleri

İlerleme takibi dahil kopyalama, taşıma ve silme işlevselliğiyle tam dosya işlemi desteği. Ayrıca yerinde dosya ve klasör yeniden adlandırma içerir.

### Kısayol Düzenleyici

Uygulamadaki tüm klavye kısayollarını özelleştirin. Mevcut atamaları görüntüleyin, çakışmaları algılayın ve varsayılanlara sıfırlayın.

### Gezgin İyileştirmeleri

Dosya ve dizinler için minimalist glifler yerine yerel sistem simgelerini görüntüleme seçeneği eklendi. Ayarlar gezinti sekmeleri artık kaydırma sırasında sayfaya yapışır.

---

## [2.0.0-alpha.4] - January 2026

**Özet:** Ana sayfa, görsel efektler ve kullanıcı özelleştirme seçenekleri.

### Ana Sayfa

Animasyonlu medya afişi, sürücü listesi ve Belgeler, İndirilenler, Resimler ve daha fazlası gibi yaygın kullanıcı dizinlerine hızlı erişim içeren güzel bir ana sayfa.

### Görsel Efektler

Uygulama arka planına bulanıklık, opaklık ve gürültü efektleri ekleyen ayarlardaki özelleştirilebilir görsel efektler bölümü. Her sayfa için farklı ayarları destekler.

### Kullanıcı Dizinleri Düzenleyici

Kullanıcı dizin kartlarınızı özel başlıklar, simgeler ve yollarla özelleştirin. Hızlı erişim dizinlerinizin ana sayfada nasıl göründüğünü kişiselleştirin.

### Afiş Konumu Düzenleyici

Ana sayfa afişi arka planlarınızın konumunu ince ayarlayın. Mükemmel görünüm için yakınlaştırma, yatay ve dikey konumlandırmayı ayarlayın.

### Ayar İyileştirmeleri

- Ayar araması artık yalnızca mevcut dilde değil, herhangi bir dilde çalışır;
- Uygulama yeniden yüklemede her seferinde ilkini açmak yerine son ziyaret edilen ayarlar sekmesini geri yükler;

---

## [2.0.0-alpha.3] - December 2025

**Özet:** Sekmeler, çalışma alanları ve yeni bir tasarım sistemi ile gezgin görünümü.

### Gezgin Görünümü

Çalışma alanlarını destekleyen modern sekme sistemi, entegre kontrollerle yeni pencere araç çubuğu tasarımı ve verimli dosya yönetimi için çift panelli gezinti ile temel dosya tarama deneyimi.

### Video Küçük Resimleri

Gezginde video dosyaları için önizleme küçük resimleri eklendi.

### Tasarım Sistemi Geçişi

Daha ferah, modern bir tasarım ve geliştirilmiş kod kalitesi için uygulama Vuetify'dan Sigma-UI'ye taşındı.

---

## [2.0.0-alpha.1] - January 2024

**Özet:** Modern teknolojiler kullanılarak tamamen yeniden yazım.

### Tauri Geçişi

Sigma File Manager v2, Vue 3 Composition API, TypeScript ve Tauri v2 kullanılarak sıfırdan yeniden inşa edildi. Uygulama kurulum boyutu Windows'ta 153 MB'den yalnızca 4 MB'ye düşürüldü. Yüklü uygulama boyutu 419 MB'den 12 MB'ye düşürüldü.

### Yeniden Boyutlandırılabilir Paneller

Gezgin görünümünü ikiye bölmenize ve 2 dizinle yan yana çalışmanıza olanak tanıyan yeniden boyutlandırılabilir paneller özelliği eklendi.

### İlk Özellikler

Dizin listeleme ile temel dosya gezintisi, küçültme, büyütme ve kapatma kontrolleriyle pencere yönetimi ve ilk ayarlar sayfası yapısı.
