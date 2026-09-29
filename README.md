# @shop-kit — izometrik dükkan sahnesi

Vibe3D uyumlu küçük bir registry (4 model) ve bunu kullanan tıkla-yürü izometrik sahne.

![Önizleme](docs/preview.png)

**Canlı demo:** https://grkmorc.github.io/senanla/

## Oyun

Oyun bir sokakta başlar. Yan yana üç dükkan var; bir binaya tıklarsan karakterin kapıya yürür ve içeri girersin. İçeride paspasa tıklamak, **Dışarı çık** butonu ya da **Esc** seni sokağa geri çıkarır.

| Dükkan | Ne yapılır |
| --- | --- |
| **Mağaza** | Müşteriler raflardan ürün alıp kasada sıraya girer. Kasaya tıkla, ödemeyi al. Boşalan rafları ücret karşılığı doldur. |
| **Tamirhane** | Müşteri arızalı cihaz getirir. Resepsiyonda al, tamir masasında onar (**1 yedek parça** harcar), resepsiyonda teslim et. |
| **Hurdalık** | Hurda yığınlarını sökerek ücretsiz parça çıkar ya da tezgâhtan parayla parça al. Yığınlar zamanla ve her gün başında dolar. |

Para, itibar, parça stoğu ve saat üç dükkan arasında ortaktır. Sen başka bir yerdeyken de dükkanlara müşteri gelmeye devam eder; bekleyen müşteri sabrını kaybedip giderse itibar düşer. HUD iki dükkanın sırasını her yerden gösterir.

Gün 08:00'de açılır, 20:00'de kapanır (3 dakika). Güneş gün boyunca döner; akşam sokak lambaları ve vitrinler yanar.

## Yapı

```text
src/lib/vibe3d/model.ts              # Vibe3D protokolü: ModelInstance, PartHandle, Ownership, applyPatch
src/kits/shop-kit/materials.ts       # semantik slotlar, ref-count'lu materyal kaynağı
src/kits/shop-kit/context.ts         # createShopKit + ortak model çalışma zamanı (instantiateShopModel)
src/models/shop-kit/shop-floor.ts        # zemin + arka/sol duvar
src/models/shop-kit/modular-shelf.ts     # 1 m bölmeli modüler raf (bays, levels, stock…)
src/models/shop-kit/repair-bench.ts      # tamir masası, action: setLamp / toggleLamp
src/models/shop-kit/checkout-counter.ts  # kasa tezgâhı, action: ring() (çekmece animasyonu)
src/models/shop-kit/pendant-lamp.ts      # sarkıt tavan lambası, action: setOn
src/models/shop-kit/wall-clock.ts        # duvar saati, action: setTime (akrep/yelkovan anchor'ları döner)
src/models/shop-kit/shop-building.ts     # dükkan dış cephesi: kapı, vitrin/kepenk, tente, tabela, çatı
src/models/shop-kit/street-block.ts      # sokak: arsa, kaldırım, bordür, yol çizgileri, yaya geçidi
src/models/shop-kit/street-lamp.ts       # sokak feneri, action: setOn
src/models/shop-kit/scrap-pile.ts        # hurda yığını; amount azaldıkça küçülür
src/app/engine.ts                    # motor: renderer, kamera, input, oyuncu, level geçişleri
src/app/pawn.ts                      # eklemli oyuncu/müşteri karakterleri, yürüme animasyonu
src/app/atmosphere.ts                # gün saatine bağlı güneş, gökyüzü ve iç mekân ışığı
src/app/render-pipeline.ts           # GTAO + hover konturu + bloom + tone mapping (G: kalite)
src/game/economy.ts                  # ortak para, itibar, parça, saat
src/game/crowd.ts                    # müşteri doğurma, sıra, ayrılma
src/game/sales-floor.ts              # mağaza oyunu
src/game/repair-desk.ts              # tamirhane oyunu
src/game/scrap-yard.ts               # hurdalık oyunu
src/levels/                          # outdoor, sales, repair, scrap level'ları + ortak iç mekân iskeleti
src/app/iso-camera.ts                # gerçek izometrik (35.264°) Orthographic rig
src/app/nav-grid.ts                  # 8 yönlü A* + string-pull yol düzeltme
scripts/coplanar-check.ts            # vibe-model kural 9 kontrolü
registries/shop-kit/registry.json    # registry manifesti (defaultItem: kit)
```

## Çalıştırma

```sh
npm install
npm run dev         # Vite geliştirme sunucusu
npm run build       # dist/ altına üretim derlemesi
npm run typecheck   # tsc strict
npm run check       # coplanar yüz kontrolü (vibe-model kural 9)
```

## Kontroller

- Sol tık zemin: yürü · Sol tık model: soketine yürü, sonra etkileşim
- Sağ tık / Shift+sürükle: kaydır · Tekerlek: zoom · Q/E: 90° döndür · F: takip · C: serbest kamera

## Kullanım (protokol)

```ts
const kit = createShopKit()
const shelf = createModularShelf(kit, { bays: 3, levels: 5 })
scene.add(shelf.root)
shelf.configure({ stock: 0.4 })          // root ve part anchor'ları kimliğini korur
shelf.parts.goods.anchor.add(myLabel)    // rebuild'den sağ çıkar
shelf.materials.override("board", myWood) // instance > kit > varsayılan
shelf.dispose()                           // idempotent; ödünç materyaller dispose edilmez
```

## Yayın

`main` dalına her push'ta `.github/workflows/pages.yml` tip kontrolü, coplanar kontrolü ve derlemeyi çalıştırır, ardından `dist/` klasörünü GitHub Pages'e yayınlar.
