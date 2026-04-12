# Değişiklik Günlüğü

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
