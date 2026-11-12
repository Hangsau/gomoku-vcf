# 主題曲《落子無聲》與 MV：交接（2026-11-12 晚）

接手的人先讀這份。音效／設定頁／邀請碼的狀態另見 `C:\claudehome\projects\VCF\docs\design\sound-2026-11-12\README.md`。

## 現在的狀態

- 使用者在 Suno 用下面的歌詞做出主題曲《落子無聲》（中文、女聲、古風，3 分 44 秒）。
- 原檔：`C:\claudehome\projects\VCF\docs\遊戲音樂_原檔\4_主題曲_落子無聲_有唱.mp3`（來源是使用者下載資料夾的 `Quiet Puzzle (Add Vocal).mp3`；它跟選單音樂 Quiet Puzzle **是不同的歌**，不要從檔名推斷）。
- 已在本機分離人聲（demucs htdemucs，safetensors 權重）：`C:\claudehome\projects\VCF\docs\遊戲音樂_原檔\主題曲_分軌\`
  - `落子無聲_伴奏.mp3`、`落子無聲_人聲.mp3`（mp3 不進 git，只在這台電腦）
  - `時間點.json`（每句歌詞秒數＋無人聲段落）
- **線上遊戲的音樂還沒換**，仍是原本三首（`game/music/menu.mp3`、`play.mp3`、`duel.mp3`）。
- 使用者正在用 Dreamina（https://dreamina.capcut.com/ai-tool/home?type=image）做 MV 的圖，還沒交出任何圖。

## 等使用者回答的事

1. **伴奏版聽起來乾不乾淨**（助理聽不到，只有數字驗證）。
2. **遊戲音樂怎麼換**，兩個方案：
   - A（建議）：選單和對局播整首伴奏（3:44 循環），解題用間奏 33 秒。
   - B：分段用——選單 0:00–0:39、解題 1:15–1:48、對局 2:41–2:58。片段短，重複感明顯。
   - 使用者也可能決定某幾首維持原樣。沒回答前不動線上音樂。
3. 宣傳片（`docs\promo\成品_有配樂\`）要不要改用副歌 0:54–1:15 有唱版；之前兩支配樂版使用者也還沒選。

## 歌曲結構（秒）

| 時間 | 段落 | 人聲 |
|---|---|---|
| 0.0–22.0 | 前奏 | 無 |
| 22.0–38.5 | 主歌一 | 有 |
| 39.4–52.8 | 導歌 | 有 |
| 54.2–75.4 | 副歌 | 有 |
| 75.4–107.9 | 間奏 | 無 |
| 107.9–123.4 | 主歌二 | 有 |
| 124.8–139.4 | 導歌 | 有 |
| 139.6–160.8 | 副歌 | 有 |
| 161.2–177.9 | 橋段 | 有 |
| 178.2–198.5 | 最後副歌 | 有 |
| 198.5–208.1 | 過門 | 無 |
| 208.1–218.2 | 尾聲「落子無聲」（前 5 秒像哼唱，起點不確定） | 有 |
| 218.2–224.2 | 尾奏 | 無 |

副歌各句的結束時間是推算值，精剪前請使用者實聽。

## 歌詞與 Suno 風格

Style：
```
Chinese ancient-style ballad with modern touch, guzheng and xiao flute, soft strings, gentle piano, subtle light beat, airy ethereal Mandarin female vocal, breathy and clear, lingering long notes, spacious reverb, 84 BPM, clear instrumental intro and instrumental break
```

歌詞：
```
主歌一：月色鋪成一張盤／星子零落 無人看／你執黑 我執白／誰先動了心 誰先亂
導歌：一步近 一步遠／輸贏都在 一念間
副歌：落子無聲 風也不敢喧／五星連成線 劃過長夜的邊／等你看見 那一瞬間／萬籟俱寂 只剩心跳的弦
主歌二：指尖還留著餘溫／棋聲敲碎了黃昏／進是局 退是痕／步步都是 來時的門
（導歌、副歌重複）
橋段：時間很短 夠我走完這一段／一局很長 像把一生都看穿
（最後副歌）
尾聲：落子無聲
```

使用者對歌詞的意見：第一版（英文、直白講規則）和第二版（「沖四 沖四 連成五」）被嫌土；要女聲好聽、有意境、中文。

## MV 計畫

短版 53 秒（歌曲 22.0–75.4：主歌一＋導歌＋副歌），直式 9:16。

原則：
- AI 畫不出正確棋局 → AI 只做氣氛鏡頭（棋盤拍局部或模糊）；看得清棋局的鏡頭用遊戲實際畫面（`C:\claudehome\projects\VCF\tools\promo\rush_promo.py` 可錄）。
- 對手不露臉；不做對嘴唱歌。
- 流程：使用者在 Dreamina 先生 9 張圖 → 放進 `C:\claudehome\projects\VCF\docs\promo\MV素材\` → 助理檢查人物一致、棋盤沒穿幫 → 使用者把圖轉成 5 秒影片 → 助理剪接（ffmpeg）、上歌詞字幕、鏡頭 5 中段插遊戲落子畫面、結尾接解題畫面和網址。
- 使用者一度以為只要生圖或直接生影片；已說明「先圖後影片」的理由（省額度、人物一致）。

每張提示詞 = 下面的「畫面」＋共用風格。先做鏡頭 3 定女主角，4／6／8／9 用它當人物參考圖。

共用風格：
```
cinematic Chinese ancient-style, cool moonlit blue and soft warm lantern gold palette, misty atmosphere, shallow depth of field, soft film grain, elegant and quiet mood, highly detailed, 9:16 vertical
```

| 鏡頭 | 歌詞 | 秒數 | 檔名 | 畫面提示詞 | 轉影片的動作描述 |
|---|---|---|---|---|---|
| 1 | 月色鋪成一張盤 | 22.0–25.8 | 1_月色 | A wooden Go board on a low table in a moonlit Chinese courtyard at night, moonlight falling across the empty board like silver, plum blossom branches above, wide shot from slightly above | slow push in toward the board, mist drifting, plum petals falling gently |
| 2 | 星子零落 無人看 | 26.4–29.7 | 2_星子 | Close-up of a single wooden bowl filled with glossy black Go stones, a starry night sky reflected in the polished stones, a few bright stars visible on their surfaces, a second bowl of white stones blurred in the far background, macro shot | slow slide to the right, starlight shimmering on the stones |
| 3 | 你執黑 我執白 | 30.7–33.7 | 3_執黑 | A young woman in flowing pale hanfu sitting at a low table with a wooden Go board and two bowls of stones, seen from behind, long black hair with a simple hairpin, an unseen opponent's sleeve at the opposite edge of the frame, lantern light, medium shot | slow push in from behind, her sleeve moves slightly, lantern light flickers softly |
| 4 | 誰先動了心 誰先亂 | 34.1–38.5 | 4_動心 | Extreme close-up of a woman's slender fingers holding a single black stone between index and middle finger, hovering above a wooden board, hesitating, pale hanfu sleeve, moonlight on her hand, background blurred | fingers lower the stone slowly toward the board, camera holds still |
| 5 | 一步近 一步遠／輸贏都在 一念間 | 39.4–52.8（14 秒，中段插遊戲畫面） | 5_一步 | Low angle macro shot across the surface of a wooden Go board, four glossy black stones lined up in one straight row receding into the distance, the nearest stone in sharp focus, an empty spot at the far end of the row, the rest of the board empty, moonlight raking across the wood, tiny dust particles floating in the light | slow slide forward along the row of stones toward the empty spot, dust particles drifting in moonlight |
| 6 | 落子無聲 風也不敢喧 | 54.2–58.1 | 6_落子 | A woman's hand in a pale hanfu sleeve placing a black stone on a wooden board, frozen moment at contact, a soft ring of light rippling outward from the stone like water, plum petals suspended motionless in the air | the ring of light expands outward slowly, petals stay frozen in the air |
| 7 | 五星連成線 劃過長夜的邊 | 58.3–62.4 | 7_五星 | Five bright stars aligned in a perfect diagonal line across a deep blue night sky above dark tiled rooftops, a thin streak of light connecting them, vast and silent, wide shot | slow tilt up to the stars, the line of light brightens gradually |
| 8 | 等你看見 那一瞬間 | 62.6–67.1 | 8_看見 | Close-up of a young woman's eyes and upper face in profile, long black hair with a simple hairpin, looking down, a faint line of light reflected in her eyes, calm and certain expression, soft lantern glow | she slowly raises her eyes, the light in her eyes brightens |
| 9 | 萬籟俱寂 只剩心跳的弦 | 67.3–75.4（8 秒，不夠就慢放） | 9_心弦 | A young woman in flowing pale hanfu seen from behind standing up from a low table in a moonlit courtyard, sleeves moving slightly, the wooden board glowing faintly behind her, five stars aligned in a line in the night sky above, wide shot | she rises slowly, sleeves flowing, camera pulls back and tilts up to the stars |

提示詞修訂（2026-11-12 深夜，使用者實測後）：
- 鏡頭 2 原句「black and white stones scattered in two bowls」會把黑白子混在一碗 → 改成只拍黑子一碗、白子碗在背景模糊。
- 鏡頭 3 原句「board game table」太籠統 → 明寫 Go board 和兩個棋罐。
- 鏡頭 5 原本一黑一白看不出是五子棋 → 改成四顆黑子連成一排、盡頭空一格（差一步成五），接鏡頭 6 落子、鏡頭 7 五星連線。驗收時數棋子：要 4 顆（3 顆可接受），5 顆以上重生。
- 寫法通則：棋具一律寫 Go board／Go stones（五子棋用同一套棋具，模型認得這個詞）；不寫 scattered、不寫 grid lines；數量寫明確。
- 以上三段都還沒有使用者實測結果。

### 剪接時間表（第二版，2026-11-12 深夜；使用者說「用你的版本」）

上表的「秒數」是歌詞起訖；實際下刀點如下（歌曲時間，秒）。鏡頭 5 的圖要轉成**兩段**影片（5a、5b，同一張圖、不同動作），中間夾遊戲實錄。

| 片段 | 起–迄 | 長度 | 歌詞 | 素材 |
|---|---|---|---|---|
| 1 | 22.0–26.1 | 4.1 | 月色鋪成一張盤 | 1_月色.mp4 |
| 2 | 26.1–30.3 | 4.2 | 星子零落 無人看 | 2_星子.mp4 |
| 3 | 30.3–33.9 | 3.6 | 你執黑 我執白 | 3_執黑.mp4 |
| 4 | 33.9–39.0 | 5.1 | 誰先動了心 誰先亂 | 4_動心.mp4（略慢放） |
| 5a | 39.0–43.2 | 4.2 | 一步近 | 5a_一步.mp4：`slow slide forward along the row of stones toward the empty spot, dust particles drifting in moonlight` |
| 遊戲 | 43.2–50.4 | 7.2 | 一步遠／輸贏都在 | 遊戲實錄：連續沖四，停在落最後一子之前（rush_promo.py 錄） |
| 5b | 50.4–53.6 | 3.2 | 一念間 | 5b_一念.mp4：`camera holds still, focus slowly shifts from the nearest stone to the empty spot at the end of the row, moonlight brightens slightly` |
| 6 | 53.6–58.2 | 4.6 | 落子無聲 風也不敢喧 | 6_落子.mp4 |
| 7 | 58.2–62.5 | 4.3 | 五星連成線 劃過長夜的邊 | 7_五星.mp4 |
| 8 | 62.5–67.2 | 4.7 | 等你看見 那一瞬間 | 8_看見.mp4 |
| 9 | 67.2–75.4 | 8.2 | 萬籟俱寂 只剩心跳的弦 | 9_心弦.mp4（10 秒版，或 5 秒慢放） |
| 結尾 | 75.4–81.4 | 6.0 | （間奏，音樂淡出） | 遊戲解題成功畫面＋網址 |

總長約 59 秒。女主角維持執黑（跟鏡頭 5 的黑子四連、遊戲實錄接得上）。

### 階段一驗收（2026-11-12 深夜）

- 使用者已交 9 張圖，在 `C:\claudehome\projects\VCF\docs\promo\MV素材\`（檔名是 `N_名稱.png.png`，多一層副檔名，不影響）。九張全部通過，人物一致。
- 鏡頭 3、4、6 棋盤上有暗紅色棋子，已在本機調成黑色另存 `3_執黑_修.png`、`4_動心_修.png`、`6_落子_修.png`（原圖保留）。**轉影片用這三個修檔**。
- 放過的瑕疵：4、6 棋子沒在交叉點上、盤面無四連（當氣氛鏡頭）；9 的棋盤有極小紅棋子沒修、連線五星旁多一顆小星；8 表情偏憂傷。
- 下一步：使用者做階段二，共 10 段影片（鏡頭 5 做 5a、5b 兩段）→ 助理照上面的剪接時間表剪。

## 工具備註

- 分離人聲與歌詞辨識的環境是暫存 venv（`…\scratchpad\audiovenv`，屬於上一個工作階段，可能已被清掉）。要重做：`python -m venv --system-site-packages`，pip 一律帶 constraints `torch==2.6.0+cu124`，裝 `torchaudio==2.6.0`（cu124 來源、`--no-deps`）、`demucs`、`soundfile`、`faster-whisper`。**不可對系統 Python 裝東西**（其他工作階段用它的 torch 跑訓練）。
- demucs 官方權重網址（dl.fbaipublicfiles.com）憑證過期連不上；改用 HuggingFace `AEmotionStudio/htdemucs-models` 的 `htdemucs.safetensors`＋config，自己建 `HTDemucs` 後 `load_state_dict(strict=True)`（key 要去掉 `state.` 前綴）。不要載入第三方 pickle（`.th`）檔，會被安全機制擋。
- ffmpeg：`C:\Users\hangs\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\`
- 換遊戲音樂時：`game/music/*.mp3` 96 kbps；改完跑 `bash C:/claudehome/projects/VCF/tools/deploy_rush.sh`；煉丹爐的 `web/music/bgm.mp3` 是 menu.mp3 的複本，要一起換。

## 其他還開著的事（跟這條線無關，仍待使用者）

- 九種落子聲還沒聽；iPhone 音量滑桿沒實機確認。
- 邀請連結從 LINE 開啟沒實機確認；私人房在大廳顯示暱稱是否要隱藏。
