# Sınır Kalesi — hareket prototipi

Masaüstü tarayıcı için tek oyunculu üçüncü şahıs hareket ve at sürüşü denemesi. Online bağlantı, savaş, hasar, reklam ve hesap sistemi henüz yoktur.

## Çalıştırma

Node.js 22.13 veya üzeri ile `npm install`, ardından `npm run dev`. Yayın derlemesi: `npm run build`. Tip kontrolü: `npx tsc --noEmit`.

## Kontroller

- WASD: yaya hareketi; at üzerinde W/S ileri/geri, A/D dönüş.
- Fare: kamera; fare kilidi kullanılamıyorsa basılı tutup sürükleme.
- Shift: koşu / atı hızlandırma.
- E: yakınındaki ata binme; boş yan alana inme.
- R veya üstteki düğme: başlangıca dönme.
- Esc / odak kaybı: duraklatma.

## Doğrulama ve sınırlar

TypeScript kontrolü ve üretim derlemesi yapıldı; geliştirme adresi HTTP 200 döndü. Tarayıcıda etkileşim ve görsel test henüz yapılmadı. WebMCP destekleyen tarayıcılar için isteğe bağlı reset_training aracı bulunur; bu ortamda WebMCP çalışma zamanı doğrulaması yapılmadı. İlk oyuncu testinde kamera, duvar çarpışması, ata binme/inme ve at dönüş hissi değerlendirilmelidir.

Geometriler kodla oluşturulur; harici oyun modeli veya doku gerektirmez. Şimdiki çarpışma sistemi düz zemin ve dikdörtgen engeller içindir. At ve karakter modelleri prototip geometrileridir. Üretim ölçeğinde fizik ve online sunucu aşaması ayrıca geliştirilecektir.

## 0.2 — Hareket hissi

Yaya hızlanma ve durma geçişleri, yumuşak yön değişimi, kalça/diz/omuz eklemleri ve mesafeye bağlı adımlar eklendi. At için kademeli hızlanma, frenlemeden geri vitese geçmeme, sürate bağlı dönüş yarıçapı, yürüyüş/dörtnal geçişi ve binici hareketi eklendi. Kamera yumuşak takip ve hafif hız görüş açısı kullanır; at üzerinde fare 1,3 saniye kullanılmazsa sürüş yönüne döner. Odak kaybı hızı sıfırlar.

Hareket kuralları: `node --test lib/movement.test.mjs` (4 test). Kare hızından bağımsız hızlanma, fren/geri sürüş, dönüş ve yön açısı sınırı test edilir. 0.2 tip kontrolü ve derlemesi geçti; oynanışın görsel/etkileşim doğrulaması henüz yapılmadı.
