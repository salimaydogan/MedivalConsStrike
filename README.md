# Sınır Kalesi — 0.3 savaş prototipi

Masaüstü tarayıcıda tek oyunculu üçüncü şahıs at sürüşü ve yaya kılıç–kalkan talimi. Online bağlantı, reklam ve hesap sistemi henüz yoktur.

## Çalıştırma ve doğrulama

Node.js 22.13 veya üzeri: `npm install`, `npm run dev`. Derleme: `npm run build`. Tip kontrolü: `npx tsc --noEmit`. Kuralların testleri: `node --test lib/*.test.mjs`.

## Kontroller

- WASD: yaya hareketi; at üzerinde W/S ileri/geri ve A/D dönüş.
- Fare: kamera. Fare kilidi kullanılamıyorsa orta tuşla sürükleme.
- Shift: koşu / atı hızlandırma.
- E: yakındaki ata binme veya boş yana inme. Saldırı/blok sırasında kullanılamaz.
- Sol tık: yaya kılıç saldırısı; 24 dayanıklılık, 0,68 saniye saldırı döngüsü, 0,24 saniyede tek temas kontrolü.
- Sağ tıkı tut: önden gelen darbeyi blok; saniyede 9 ve başarılı blokta 18 dayanıklılık.
- R / üst düğme: karakter, at, hedefler, can, dayanıklılık ve sayacı sıfırlama.
- Esc / odak kaybı: duraklatma.

## Talim

Avludaki üç hedef 2,6 metre içindeki ön yaydan hasar alır. Her isabet 34 hasar verir; devrilen hedef 4 saniyede yenilenir. 3 metre yakındaki hedef, turuncu uyarıdan 0,85 saniye sonra karşı vuruş yapar. Öne dönük kalkan yeterli dayanıklılıkla 15 hasarlık darbeyi durdurur. Can tükenince talim 2 saniye sonra sıfırlanır. Sesler tarayıcıda sentezlenir; harici ses/model/doku kullanılmaz.

## Doğrulama sınırı

Yedi otomatik test hareket kurallarını, saldırı koşullarını, menzil/yön kontrolünü ve blok maliyetini kapsar. Tip kontrolü ve üretim derlemesi geçti. 0.3 görsel ve etkileşim testleri henüz yapılmadı. Oyuncu testinde saldırı animasyonu/temas zamanlaması, kalkan yönü ve geri bildirim değerlendirilmelidir. WebMCP reset_training aracı için destekleyen tarayıcıda çalışma zamanı doğrulaması henüz yapılmadı.

Düz zemin ve dikdörtgen engeller için basit çarpışma kullanılır. Atlı saldırı ve online sunucu sonraki aşamalardır. Hareketin 0.2 temelinde kademeli hızlanma, mesafeye bağlı eklem animasyonları ve yumuşak kamera bulunur.

## 0.4 düzeltmeleri
Kılıç ve kalkan ileri yönde kaldırılır. Hasar kırmızı ekran kenarı, can kaybı yazısı ve beden tepkisiyle gösterilir. Can sıfırlandığında karakter yere düşer; otomatik sıfırlama yerine Yeniden doğ düğmesi kullanılır. Sekiz kural testi ve tip kontrolü geçti. Görsel oynanış doğrulaması henüz yapılmadı.

## 0.5 — Atlı savaş

At üstünde sol tık sağ yana kılıç savurur (32 dayanıklılık). Hedef sağ tarafta ve 3,2 metre içinde olmalıdır. 0,18–0,4 saniye temas penceresinde tek hedefe tek vuruş uygulanır. Gerçek ileri hıza bağlı hasar 34–60 arasındadır; geri sürüş bonus vermez. Saldırı atın yönünü kameraya çevirmeden sürüşü korur. Atlı blok ve hedefin biniciye karşı vuruşu açıktır. On kural testi ve tip kontrolü geçti; tarayıcıda görsel oynanış doğrulaması henüz yapılmadı.

## Mobil tarayıcı ve takip sayfası

Mobil tarayıcı ana hedef olarak belirlendi. Dokunmatik cihazlarda sol analog hareket çubuğu, sağ kamera sürükleme alanı ve saldırı/blok/hızlanma/binme düğmeleri görünür. Dokunma iptalinde tutulan girişler bırakılır; odak kaybı hareketi durdurur. Mobil piksel oranı 1,25; gölge çözünürlüğü 1024 ile sınırlandırılır. Yatay ekran önerilir. Gerçek Android/iPhone oynanış ve performans testleri henüz yapılmadı.

`public/roadmap.html` bağımsız HTML kontrol listesidir; oyundaki Yol haritası bağlantısıyla açılır. Kişisel işaretler aynı tarayıcıda localStorage içinde saklanır. Cihazlar veya ROADMAP.md ile otomatik eşitlenmez. Mobil testler online aşamadan önce listelenir.

## 0.6 — Kaçınma ve takip

Yaya kaçınma telefonda Kaçın düğmesi, klavyede Boşluk ile kullanılır. Yön girişi varsa o yöne, yoksa kamera yönüne göre geriye 0,28 saniyelik hamle yapılır. 25 dayanıklılık harcar ve 0,85 saniye bekleme uygular. Duvar çarpışması korunur; hasar bağışıklığı vermez. At üstünde veya kılıç savururken kullanılamaz. /roadmap adresi HTML kontrol listesine yönlenir. 13 kural testi ve tip kontrolü geçti; gerçek cihaz testi bekliyor.

Oyuncu bulunamazsa botlarla maç gereksinimi yol haritasına eklendi; uygulaması online oda/takım aşamasındadır.

## Mobil arayüz kontrolü — 8 Eylül 2026

Codex tarayıcısında dokunmatik mod seçilerek 390×844 ve 844×390 görünüm kontrol edildi. Kaçınma düğmesi dayanıklılığı 100→75 düşürdü; joystick hareketi, ata binme/inme, düşman darbeleri, canın sıfırlanması, ölüm ekranı ve yeniden doğmada 100 cana dönüş gözlendi. Zemindeki gölge çizgileri düzeltilip yeniden görüntülendi. Bu, gerçek Android/iPhone veya eşzamanlı çoklu dokunma testi değildir.

Başlangıca Dokunmatik / Klavye ve fare seçimi eklendi. Mobil metinler düğme adlarına uyarlandı. Düğmelerin at yakınlığında yer değiştirmesi giderildi; kullanılamayan eylemler sabit yerlerinde devre dışıdır. Son sabit düğme değişikliğinden sonra tarayıcı bağlantısı kesildiği için bu son düzen yeniden görüntülenemedi. Gerçek cihaz, ses, çoklu dokunma ve uzun süreli performans kontrolleri bekliyor.

## Ortak hareket motoru

`lib/world.mjs` kale katı geometrisi, hedef konumları ve çarpışma sınırlarını paylaşır. `lib/player-motion.mjs` DOM/Three.js kullanmadan yaya, atlı ve kaçınma hareketini işler; tarayıcı bu modülü kullanır. Küçük çarpışma adımları hızlı hareketin ince engelleri atlamasını önler. Kamera ve hareket aynı katı harita verisini kullanır.

`parseMovementMessage` ilerideki ağ giriş sınırı için yalnızca hareket niyetini kabul eder; konum, can, hız veya istemci zaman adımını kabul etmez. Bu aşamada ağ sunucusu, oturum kimliği, paket sıralaması veya hız sınırlaması yoktur. Bunlar oda sunucusunun sorumluluğunda geliştirilecektir. Savaşın zamanlama/durum akışı henüz görüntüleme dosyasındadır.

20 test: kayıtlı girdilerin tekrarı, analog/çapraz hız, ince duvar, harita sınırı, ölü/duraklatılmış hareket, geçersiz ağ girdisi ve zaman adımı dahil. Son değişiklik sonrası tarayıcıda oynanış tekrar testi yapılmadı; tip kontrolü ve derleme geçti.
