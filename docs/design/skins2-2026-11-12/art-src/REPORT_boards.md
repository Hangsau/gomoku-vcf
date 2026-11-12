# Gomoku Rush 特色棋盤底圖檢查報告

日期：2026-11-12。

7 張底圖、7 張 1024×1024 PNG 原圖、檢查圖均已寫入指定位置。開始執行時，7 個目標 WebP 都不存在，因此本次沒有跳過任何既有成品。使用內建 image_gen 工具逐張生成，每張生成後立即以 Python／Pillow 處理並存檔；沒有使用 CLI 生圖、git 操作、背景腳本或行程終止命令。

所有成品皆為 768×768、RGB、不透明 WebP，quality=82、method=6；最大檔案為 143,362 bytes，全部嚴格小於 150,000 bytes（亦小於 150 KiB），未使用 quality=75。亮度標準差最高為 11.2640，全部低於 28。

| 成品路徑 | 尺寸 | bytes | KB（1000 bytes） | 平均色 | 平均亮度 | 亮度標準差 |
|---|---|---:|---:|---|---:|---:|
| `C:/claudehome/projects/VCF/game/skin/boards/grass.webp` | 768×768 | 143,362 | 143.36 | #69971A | 132.0229 | 10.3857 |
| `C:/claudehome/projects/VCF/game/skin/boards/starry.webp` | 768×768 | 3,394 | 3.39 | #28324E | 49.8020 | 0.8640 |
| `C:/claudehome/projects/VCF/game/skin/boards/beach.webp` | 768×768 | 71,422 | 71.42 | #EFD2A5 | 212.9179 | 5.9168 |
| `C:/claudehome/projects/VCF/game/skin/boards/chalk.webp` | 768×768 | 3,260 | 3.26 | #284F3F | 69.7052 | 0.9017 |
| `C:/claudehome/projects/VCF/game/skin/boards/ice.webp` | 768×768 | 12,124 | 12.12 | #D3E7F5 | 227.4488 | 2.0592 |
| `C:/claudehome/projects/VCF/game/skin/boards/denim.webp` | 768×768 | 86,960 | 86.96 | #2F4461 | 65.6476 | 11.2640 |
| `C:/claudehome/projects/VCF/game/skin/boards/pool.webp` | 768×768 | 7,288 | 7.29 | #48E1D9 | 191.6557 | 2.2594 |

數值重新讀取最終 WebP 解碼後計算，並非使用未壓縮圖估計。平均色為全圖 R/G/B 各通道的算術平均後四捨五入。亮度以 0–255 sRGB 通道值計算 Y′ = 0.2126 R + 0.7152 G + 0.0722 B，標準差使用全體像素、ddof=0；另以 Pillow convert('L') 交叉檢查，七張也都小於 28。這是影像亮度起伏的度量，不是 WCAG 對比率。

原圖尺寸說明：每次生圖提示均要求 1024×1024，但工具實際回傳 1254×1254。依指定交付尺寸，以 Pillow LANCZOS 全幅縮至 1024×1024 後存為下列 PNG，再縮至 768×768。PNG 是尺寸正規化後的生成來源，並非工具輸出的逐位元原檔；1254×1254 工具原檔保留於工具預設目錄，對應位置列於後文。所有底圖經目視沒有邊框、暗角或留白，因此未做中央 90% 裁切，保留完整材質。

- `C:/claudehome/projects/VCF/docs/design/skins2-2026-11-12/art-src/board_grass_raw.png`
- `C:/claudehome/projects/VCF/docs/design/skins2-2026-11-12/art-src/board_starry_raw.png`
- `C:/claudehome/projects/VCF/docs/design/skins2-2026-11-12/art-src/board_beach_raw.png`
- `C:/claudehome/projects/VCF/docs/design/skins2-2026-11-12/art-src/board_chalk_raw.png`
- `C:/claudehome/projects/VCF/docs/design/skins2-2026-11-12/art-src/board_ice_raw.png`
- `C:/claudehome/projects/VCF/docs/design/skins2-2026-11-12/art-src/board_denim_raw.png`
- `C:/claudehome/projects/VCF/docs/design/skins2-2026-11-12/art-src/board_pool_raw.png`

本次沒有重畫。額外調整如下：

- starry.webp：首次檢查圖中，黑子與暗藍底的邊界較弱。從 PNG 來源重新處理，對 RGB 各通道同加約 12.023，將壓縮前平均亮度設為 50；最終平均亮度為 49.8020，保留深色夜空並提升黑子輪廓辨識度。
- denim.webp：雖原先標準差 18.0989 已合格，縮小後斜紋仍偏強。以各通道平均值為中心將對比縮至 0.65，再於 768×768 施加 GaussianBlur(radius=0.3)。最終標準差降為 11.2640，紋理保留但較不干擾棋盤。
- grass、beach、chalk、ice、pool：只做尺寸正規化、縮圖及 WebP 壓縮，沒有額外調整對比或模糊。

檢查圖：`C:/claudehome/projects/VCF/docs/design/skins2-2026-11-12/art-src/check_boards.png`，1540×852，四欄兩列，第一列依序 grass、starry、beach、chalk；第二列 ice、denim、pool。每張底圖實際為 360×360，格線為 15 條橫線及 15 條直線、線寬 1 px，座標從 18 到 342（邊距 5%）。starry、chalk、denim 使用 #E8ECF5，其餘使用 #3A3A3A。每張放 6 顆 #111111 黑子和 6 顆 #FAFAFA 白子，直徑 21 px；白子加 1 px #3A3A3A 外框。文字標籤位於底圖外。底圖成品本身沒有格線、邊框、棋子或文字。

已實際開啟檢查圖兩次：首次找出星空與牛仔布的改善點，調整後重建並再次目視檢查。最終七張的格線與黑白子都可分辨；沙灘與冰湖的白子有深色外框，輪廓清楚；星空黑子邊界較第一次明顯；牛仔布斜紋已淡化。程式也驗證每個成品的尺寸、WebP 格式、RGB 模式、檔案大小、亮度標準差，以及檢查圖全部棋子的中心顏色。

仍有取捨：星空的暗星、星雲，以及黑板的擦拭霧痕，在 360×360 顯示下非常淡，材質辨識感較弱。草地小花與沙灘貝殼縮小後只有幾個像素，屬微小點綴。星空仍是黑子對比最低的一張，已提亮改善，但深色主題的黑子顯著度仍低於淺色主題。尚未在實際手機螢幕及遊戲渲染器中驗證；本次視覺結論以指定色碼與尺寸的檢查圖為準。

生成提示與工具來源（均使用內建 image_gen，transparent_background=false）：

**grass**

Use case: photorealistic-natural. Asset: grass material background for a mobile Gomoku game; generate a single square 1024x1024 opaque image. A perfectly straight-down orthographic close view of evenly mown, very short fresh green lawn, a touch of yellow-green, with delicate fine tiny grass blades. Medium green overall brightness, extremely restrained low-contrast microtexture, flat diffuse light, same color density and brightness at all four corners and center. Include exactly three very tiny, very faint white wildflowers, scattered irregularly far apart, each only about 5-8 pixels across in the 1024 image, no clusters. The material fills every pixel edge-to-edge. There must be NO board, NO grid, NO checker squares, NO lines, NO border or frame, NO game stones, NO lettering, NO symbols, NO people, NO vignette, NO spotlight, NO large shadows or bright patches. Do not render a physical board; render only the lawn material. All details soft, small and subdued so later game grid and stones are legible at 360x360. Maintain even flat illumination across the entire image.

工具原檔：`C:/Users/hangs/.codex/generated_images/01a1cdd6-1476-7640-a2c5-b49b43e9ee0d/exec-b750f36b-6862-425b-a6a3-43db16f4dbf2.png`

**starry**

Use case: photorealistic-natural. Asset: quiet space material background for a mobile Gomoku board. Generate one opaque square 1024x1024 texture. A uniformly very dark deep navy-blue night sky with subtle deep violet undertones, restrained base palette around #273355. Tiny dim pinprick stars sparsely but evenly scattered across the whole image, irregular natural positions, no obvious constellations, no bright stars, no large glowing dots. Only the faintest fine wisps of blue-purple nebula, almost imperceptible, no large cloud shapes. Completely uniform flat exposure from center to all edges and corners. Very low contrast, minimal visual activity, fine subdued texture. Fill the entire square edge-to-edge with the night-sky material. NO grid, NO board, NO border, NO frame, NO squares, NO stones, NO text, NO symbols, NO people, NO horizon, NO vignette, NO central glow, NO spotlight, NO dramatic Milky Way, NO bright galaxy, NO star spikes. Later a light 1px grid and black and white stones will overlay the image at 360px square: maintain a uniform dark blue base that still separates from near-black #111111 stones. Render only the material, not a board.

工具原檔：`C:/Users/hangs/.codex/generated_images/01a1cdd6-1476-7640-a2c5-b49b43e9ee0d/exec-98c4c745-c569-4ae5-b3cb-4d2cc018a428.png`

**beach**

Use case: photorealistic-natural. Asset: subtle beach-sand material background for a mobile Gomoku game. Generate one opaque square 1024x1024 image, strictly straight-down orthographic view. Entire image is fine pale warm beige-yellow sand, bright overall, delicate tiny grains and very faint soft irregular wind ripples. Ripples must be whisper faint, shallow, nonperiodic, with no prominent lines, no large bright or dark bands. Include exactly three tiny pale beige seashells, faint and almost blending into the sand, each only about 9-12 pixels across in the 1024 image, scattered irregularly far apart; no shell clusters. Equal diffuse illumination and same sand density throughout the center, all edges, and all corners. Very low contrast and quiet texture, designed for legibility of a later overlaid grid and black/white game stones at 360px square. Full bleed material only. NO grid, NO checker squares, NO board, NO border, NO frame, NO game stones, NO text, NO symbols, NO people, NO shadows, NO vignette, NO spotlight, NO water, NO horizon, NO footprints, NO large objects.

工具原檔：`C:/Users/hangs/.codex/generated_images/01a1cdd6-1476-7640-a2c5-b49b43e9ee0d/exec-91731b09-a96e-4e35-b2c9-ca3b881eacd5.png`

**chalk**

Use case: photorealistic-natural. Asset: quiet dark green chalkboard surface material for a mobile Gomoku game background. Generate a single square 1024x1024 opaque image. Exactly perpendicular top-down view of a completely empty matte dark ink-green chalkboard surface, base color near #28463D, dark overall. Only subtle very thin translucent dusty-white cloudy traces from gently erased chalk, irregular soft dispersed smudges with extremely low contrast. All smudges too indistinct to resemble letters, drawings, circles, geometric shapes or repeated strokes. Delicate microtexture and restrained evenly distributed erased patina. Absolutely uniform flat diffuse illumination across whole image, all corners and edges the same tone as center; NO edge shading, NO vignette, NO large bright/dark areas. Full bleed material only, without visible physical board edges. NO writing of any kind, NO text, NO symbols, NO drawings, NO grid, NO squares, NO border, NO frame, NO game stones, NO chalk stick, NO eraser, NO objects, NO people, NO directional reflections. Very quiet low contrast background for light grid lines and black and white pieces later overlaid at 360px square.

工具原檔：`C:/Users/hangs/.codex/generated_images/01a1cdd6-1476-7640-a2c5-b49b43e9ee0d/exec-e73ea54d-c568-444e-8cc7-06772418efef.png`

**ice**

Use case: photorealistic-natural. Asset: quiet frozen-lake material background for a mobile Gomoku game. Generate one opaque square 1024x1024 texture. Strict perpendicular top-down view of an evenly frozen lake surface filling the entire image edge to edge. Very bright pale icy blue-white with softly translucent fine ice microtexture. Just a few hair-thin very faint white organic cracks, spaced far apart, short discontinuous subtle branching fissures, never a geometric network, never a grid. A few tiny barely visible pale air bubbles dispersed irregularly under the ice. Delicate quiet details, extremely low contrast. Flat uniform diffuse illumination: equal color, brightness and texture density in center, edges and all four corners. No large bright/dark patches, no deep fissures, no crystalline chunks, no objects. NO grid lines, NO squares, NO board, NO border, NO frame, NO game pieces, NO writing, NO symbols, NO people, NO horizon, NO vignette, NO spotlight, NO directional shadows. The texture must stay subdued beneath later dark 1px grid and black/white stones at 360px square.

工具原檔：`C:/Users/hangs/.codex/generated_images/01a1cdd6-1476-7640-a2c5-b49b43e9ee0d/exec-0171242c-1b3d-4331-88e5-9068a21dc6de.png`

**denim**

Use case: photorealistic-natural. Asset: subtle indigo denim fabric material background for a mobile Gomoku game. Generate a single opaque square 1024x1024 image, precisely orthographic straight-down close view. Entire image uniformly filled with flat smooth indigo-blue denim cloth, medium-dark blue overall, recognizable delicate fine diagonal twill weave on a microscopic scale, with the faintest even brushed pale-blue fading. Keep the weave subtle and low contrast; diagonal threads are fine and close together, never broad stripes or a grid, no moire. Matte evenly lit cloth, soft diffuse light, no folds, no wrinkles, no seams, no stitching, no hems, no edges, no pockets, no buttons, no rivets. Equal illumination and color at every edge and corner and in center. Full bleed material, absolutely NO border, NO frame, NO grid, NO checkerboard, NO squares, NO board, NO game stones, NO text, NO logos, NO symbols, NO people, NO vignette, NO large bright or dark patches. Quiet fine texture designed to remain unobtrusive beneath a later 1px light grid and black/white stones shown at 360px square.

工具原檔：`C:/Users/hangs/.codex/generated_images/01a1cdd6-1476-7640-a2c5-b49b43e9ee0d/exec-059089d1-097a-4b86-a632-bb09603f8f2c.png`

**pool**

Use case: photorealistic-natural. Asset: subtle turquoise swimming-pool water material for a mobile Gomoku game background. Generate one opaque square 1024x1024 image, precisely perpendicular orthographic overhead view into clear shallow pool water. Entire image is a smooth seamless plain turquoise pool floor seen through clear pale aqua water. Medium-bright turquoise overall. Soft very faint thin water-refraction caustic patterns on the smooth bottom, small irregular flowing delicate ripples, extremely restrained low contrast, no harsh white highlights, no deep shadows, no broad light/dark bands. Evenly distributed delicate organic light patterns with equal illumination in center, all four corners and along all edges. Full bleed material only, no physical pool edges. NO tiles, NO square patterns, NO tile grout, NO grid, NO lane lines, NO drain, NO ladder, NO objects, NO people, NO game stones, NO text, NO symbols, NO border, NO frame, NO vignette, NO spotlight, NO large shapes. The image will have a 1px dark grid and black/white game stones overlaid at 360px square, so keep the water texture exceptionally quiet and subdued.

工具原檔：`C:/Users/hangs/.codex/generated_images/01a1cdd6-1476-7640-a2c5-b49b43e9ee0d/exec-e936fa9b-8931-40ec-b627-bb50fdd427fb.png`

