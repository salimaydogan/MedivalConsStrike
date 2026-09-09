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

## Shared training combat (9 September)
Combat timing, regeneration, directional defense, damage and target respawn now run in a serializable pure simulation. Scene code consumes events for sound and damage feedback. Solid obstacles block strikes in both directions; death ends further attacks in the same step. Input dispatch remains in the browser; this is not an authoritative online server or moving bot implementation. 26 rule tests pass; real-device and network verification remain pending.

## Bot matches and local room server (9 September)

`/battle` provides third-person foot combat with a blue/red team choice, 2vs2 or
5vs5 roster, bots in every vacant slot, a 5 minute / 15 kill limit, a scoreboard,
4 second respawn and 2 second spawn protection. Touch controls and keyboard/mouse
are available. Existing horse training remains at `/`; horses are not in the
team match yet. Local matches pause on blur; online matches continue while the
menu is open. Friendly fire is off. Team calls have a 3 second cooldown; calls
are delivered to teammates, while “good game” reaches both teams.

Run the frontend with `npm run dev` and in another terminal run
`npm run game-server` from this directory. Open the frontend's printed URL,
choose Online test room, and enter `http://127.0.0.1:3001`. Create a room on one
client and join its code on another. The room server runs at 30 Hz, accepts only
sequenced input intentions, and returns authoritative state over HTTP. No client
position, damage, health or time step is accepted. Actions are consumed once.
Stale controls stop after 250 ms; after 8 seconds without requests the player's
slot becomes a bot. Empty rooms expire after 2 minutes. Owner departure transfers
restart control to a remaining player. Rooms are memory-only and lost on restart.

Default binding is loopback. A deliberate LAN test can set `GAME_HOST=0.0.0.0`
and set `GAME_ORIGINS` to the exact frontend origins (comma-separated). A phone
must use the PC's LAN address for both frontend and room server, not localhost.
The Vite server must also be explicitly exposed for that test. No firewall or
router changes were made. A published HTTPS page requires an HTTPS room endpoint;
no public endpoint or production realtime hosting has been provisioned. The Sites
publication hosts the frontend and offline bots, not the Node room process.

Validation: 37 automated rules/server tests, including complete bot-only and
one-idle-human matches, two HTTP client sessions, team capacity, one-hit scoring,
respawn, input spoofing/replay rejection, disconnect replacement, call throttling,
team-only delivery and owner transfer. Local frontend `/battle` and server health
returned HTTP 200. This does not verify WebGL rendering, real phone multitouch,
internet latency, real players' enjoyment or production load. Remaining work:
real device playtests, smoother network rendering/prediction, connection recovery,
production hosting/abuse hardening and horse integration into team matches.

## Combat variety update
Battle now has exactly one shared horse in 2vs2 and two in 5vs5. Humans can mount
with E or the touch button; a horse cannot have two riders. Dismount checks the
side space, death/departure releases occupancy. Bots currently remain on foot.
Keys 1/2/3 or the weapon buttons select sword, spear or bow. Only the sword uses
the shield; dodge is unavailable while mounted. Spear has longer narrow reach;
arrows travel in the horizontal combat plane and stop at cover (no ballistic
vertical aiming yet). Weapons cannot change during a swing. Melee heading no
longer snaps to camera yaw. Vertical camera range now includes upward viewing,
and mouse dragging works when pointer lock is unavailable.
Warriors use layered armour, helmets, tapered limbs and articulated knees;
horses use curved body/neck geometry. Sword trails, short spark bursts, damage
labels and a small impact camera response are rendered locally. New rendering
has not been visually or physically phone-tested. 43 automated tests cover rules
and server input, including horse occupancy/release, facing lock, spear reach
and arrow travel/cover. Earlier foot-only match notes above describe the previous
version and are superseded here.

Movement jitter fix: actor translation is smoothed for rendering; camera target and position use that same visual anchor. Orbit smoothing is separate from travel, horse and rider share the render position, and impact camera shaking is removed. Sword now uses a descending lateral YXZ sweep; spear keeps a horizontal angle and translates forward. Two pose tests verify blade direction and thrust. 45 automated tests; visual verification remains pending.

Weapon grip fix: sword handle, spear shaft and bow grip are now parented to dedicated hand sockets on articulated forearms. Bow string uses two deforming segments; a nocked arrow follows the drawing string, release matches the .48 second simulation event, and a two-bone arm pose brings the right hand to the nock. Grip transforms checked across several sword poses; bow timing included in 46 automated tests. Visual review still pending.
