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
