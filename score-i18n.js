// score-i18n.js — 詰題試煉場的中英日韓（2026-11-07 使用者）
// 做法：頁面照原本中文產生，這裡把畫面上的中文換成選的語言（文字節點、title、aria-label、placeholder、文件標題、分享卡）。
// 每條規則＝[中文樣板, 英, 日, 韓]；樣板裡 {名字} 代表一段不含空白和中文標點的字（座標、數字、清單），譯文用同名 {名字} 放回去。
// 語言跟 Gomoku Rush 遊戲共用（localStorage vcfgame.lang）。規則越長越先套，沒對到的字照原本中文顯示。
(function () {
  const LANGS = [['zh', '中文', 'zh-Hant'], ['en', 'English', 'en'], ['ja', '日本語', 'ja'], ['ko', '한국어', 'ko']];
  const R = [
    // ---- 標題、按鈕、選單 ----
    ['詰題試煉場', 'VCF Puzzle Lab', '詰題の試練場', 'VCF 묘수 연습장'],
    ['從照片匯入', 'Import from photo', '写真から読み込む', '사진에서 가져오기'],
    ['複製這題的連結', 'Copy link to this puzzle', 'この問題のリンクをコピー', '이 문제 링크 복사'],
    ['產生分享卡', 'Make share card', 'シェアカードを作る', '공유 카드 만들기'],
    ['規則說明', 'Rules', 'ルール説明', '규칙 설명'],
    ['貼上題目座標', 'Paste coordinates', '座標を貼り付け', '좌표 붙여넣기'],
    ['難度與得分來源', 'Difficulty & score breakdown', '難易度と得点の内訳', '난이도와 점수 내역'],
    ['更多', 'More', 'その他', '더보기'],
    ['語言', 'Language', '言語', '언어'],
    ['五道關卡', 'Five checks', '5 つのチェック', '5단계 검사'],
    ['15 路棋盤，點交叉點放子', '15×15 board, tap an intersection to place a stone', '15 路盤。交点をタップして石を置く', '15줄 바둑판. 교차점을 눌러 돌을 놓으세요'],
    ['放子工具', 'Stone tools', '石の道具', '돌 도구'],
    ['棋盤', 'Board', '盤面', '판'],
    ['黑子', 'Black', '黒石', '흑돌'],
    ['白子', 'White', '白石', '백돌'],
    ['擦掉', 'Erase', '消す', '지우기'],
    ['清空', 'Clear', 'クリア', '모두 지우기'],
    ['評分這一題', 'Score this puzzle', 'この問題を採点', '이 문제 채점'],
    ['計算中…（再按一次取消）', 'Calculating… (press again to cancel)', '計算中…（もう一度押すと中止）', '계산 중… (다시 누르면 취소)'],
    ['回到最開始', 'Back to start', '最初に戻る', '처음으로'],
    ['上一手', 'Previous move', '一手戻る', '이전 수'],
    ['下一手', 'Next move', '一手進む', '다음 수'],
    ['到最後一手', 'Last move', '最後の手へ', '마지막 수로'],
    ['▶ 播放解答', '▶ Play solution', '▶ 解答を再生', '▶ 정답 재생'],
    ['❚❚ 暫停', '❚❚ Pause', '❚❚ 一時停止', '❚❚ 일시정지'],
    ['從現在這一手開始，自己換一條路下下看', 'From this move on, try your own line', 'この手から自分で別の手順を試す', '이 수부터 직접 다른 길을 두어 보기'],
    ['試別的走法', 'Try another line', '別の手を試す', '다른 수 두어 보기'],
    ['結束試走', 'Stop trying', '試し打ちを終える', '시험 두기 끝내기'],
    ['改題目', 'Edit puzzle', '問題を編集', '문제 수정'],
    ['退一手', 'Undo', '一手戻す', '한 수 무르기'],
    ['回到解答', 'Back to solution', '解答に戻る', '정답으로 돌아가기'],
    ['難度評定', 'Difficulty', '難易度判定', '난이도 판정'],
    ['得分來源', 'Score breakdown', '得点の内訳', '점수 내역'],
    ['評分後顯示每一項加了幾分', 'Shows each item after scoring', '採点後に各項目の点数を表示', '채점 후 항목별 점수 표시'],
    ['點開看每一項從哪裡來', 'Tap an item to see where it comes from', 'タップすると内訳を表示', '눌러서 항목별 출처 보기'],
    ['過了唯一解這關才評分', 'Scored only after passing the uniqueness check', '唯一解の関門を通ると採点されます', '유일해 검사를 통과해야 채점됩니다'],
    ['輸入題目', 'Enter puzzle', '問題を入力', '문제 입력'],
    ['貼上題目', 'Paste a puzzle', '問題を貼り付け', '문제 붙여넣기'],
    ['放上棋盤', 'Put on board', '盤に置く', '판에 놓기'],
    ['複製目前盤面', 'Copy position', '現在の局面をコピー', '현재 국면 복사'],
    ['複製成文字棋盤', 'Copy as text board', 'テキスト盤面でコピー', '텍스트 판으로 복사'],
    ['下載棋盤圖', 'Download board image', '盤面画像を保存', '판 이미지 저장'],
    ['關閉', 'Close', '閉じる', '닫기'],
    ['知道了', 'Got it', 'わかった', '알겠어요'],
    ['取消', 'Cancel', 'キャンセル', '취소'],
    ['分享卡', 'Share card', 'シェアカード', '공유 카드'],
    ['下載圖片', 'Download image', '画像を保存', '이미지 저장'],
    ['選照片／拍照', 'Choose / take photo', '写真を選ぶ／撮る', '사진 선택／촬영'],
    ['重新點四個角', 'Pick the 4 corners again', '四隅を選び直す', '네 모서리 다시 찍기'],
    ['套用到棋盤', 'Apply to board', '盤に反映', '판에 적용'],
    ['選一張棋盤的照片或截圖。照片只在你的瀏覽器裡處理，不會上傳。', 'Choose a photo or screenshot of a board. It is processed only in your browser and never uploaded.', '盤面の写真かスクリーンショットを選んでください。写真はブラウザ内だけで処理され、アップロードされません。', '판 사진이나 스크린샷을 고르세요. 사진은 브라우저 안에서만 처리되며 업로드되지 않습니다.'],
    ['自動找棋盤中…', 'Looking for the board…', '盤を自動検出中…', '판을 찾는 중…'],
    ['認出 ', 'Found ', '認識：', '인식: '],
    ['黑 {a}、白 {b}', 'Black {a}, White {b}', '黒 {a}・白 {b}', '흑 {a}, 백 {b}'],
    ['。先看青色格線有沒有壓在棋盤的線上，沒有就按住角落的圓圈拖動。', '. Check that the teal grid sits on the board lines; if not, drag the corner circles. ', '。青い格子線が盤の線に重なっているか確認し、ずれていたら角の丸をドラッグしてください。', '. 청록색 격자가 판의 선과 겹치는지 확인하고, 아니면 모서리 원을 끌어 주세요. '],
    ['紅圈', 'Red circles', '赤丸', '빨간 원'],
    ['是比較沒把握的點（{n} 個）。點交叉點可以改：空 → 黑 → 白 → 空。確認後按「套用到棋盤」。', ' are less certain points ({n}). Tap an intersection to change it: empty → black → white → empty. Then press "Apply to board".', 'は自信の低い点です（{n} 個）。交点をタップで切り替え：空 → 黒 → 白 → 空。確認したら「盤に反映」を押してください。', '은 확실하지 않은 점입니다 ({n}개). 교차점을 누르면 바뀝니다: 빈칸 → 흑 → 백 → 빈칸. 확인 후 "판에 적용"을 누르세요.'],
    ['在棋盤上擺好題目，或在下面貼座標，按「評分這一題」。會自動判斷是黑先、白先還是雙先。計算在你的瀏覽器裡進行，不會上傳題目。',
      'Set up a puzzle on the board (or paste coordinates), then press "Score this puzzle". Black-first, white-first or both is detected automatically. Everything runs in your browser; nothing is uploaded.',
      '盤に問題を並べるか座標を貼り付けて「この問題を採点」を押してください。黒先・白先・双方を自動判定します。計算はブラウザ内で行い、問題はアップロードされません。',
      '판에 문제를 놓거나 아래에 좌표를 붙여넣고 "이 문제 채점"을 누르세요. 흑선·백선·양선을 자동으로 판단합니다. 계산은 브라우저 안에서 하며 문제는 업로드되지 않습니다.'],
    ['黑 H8 G7 J7 ｜ 白 J9 K8　或　文字棋盤（┌┬┐├┼┤ 畫的 15×15，●黑 ○白，貼上就會放上棋盤）　或　題庫 JSON',
      'Black H8 G7 J7 | White J9 K8, or a text board (15×15 drawn with ┌┬┐├┼┤, ● black ○ white; pasting places it), or puzzle JSON',
      '黒 H8 G7 J7 ｜ 白 J9 K8、またはテキスト盤面（┌┬┐├┼┤ で描いた 15×15、●黒 ○白。貼るとすぐ盤に置かれます）、または問題 JSON',
      '흑 H8 G7 J7 | 백 J9 K8, 또는 텍스트 판(┌┬┐├┼┤로 그린 15×15, ●흑 ○백, 붙여넣으면 바로 놓임), 또는 문제 JSON'],
    ['座標：直行 A–P（沒有 I）、橫列 1–15（下到上）。連珠規則：黑棋有禁手（三三、四四、長連）。', 'Coordinates: columns A–P (no I), rows 1–15 (bottom to top). Renju rules: Black has forbidden moves (3-3, 4-4, overline).', '座標：縦列 A–P（I なし）、横行 1–15（下から上）。連珠ルール：黒には禁手（三三・四四・長連）があります。', '좌표: 세로줄 A–P (I 없음), 가로줄 1–15 (아래에서 위로). 렌주 규칙: 흑은 금수(33, 44, 장목)가 있습니다.'],
    // ---- 規則說明 ----
    ['合法盤面', 'Legal', '合法', '합법'],
    ['：黑白子數差不超過 1，盤上沒有五連，也沒有人已經可以一步成五。', ': stone counts differ by at most 1, no five on the board, and nobody can make five in one move.', '：黒白の石数の差が 1 以下、盤上に五連がなく、一手で五を作れる人もいない。', ': 흑백 돌 수 차이가 1 이하이고, 판에 오목이 없으며, 한 수로 오목을 만들 수 있는 쪽도 없음.'],
    ['黑先 VCF', 'Black VCF', '黒先 VCF', '흑선 VCF'],
    ['白先 VCF', 'White VCF', '白先 VCF', '백선 VCF'],
    ['雙先 VCF', 'Both VCF', '双先 VCF', '양선 VCF'],
    ['：黑棋只用衝四（每一手都逼白擋）連續取勝。黑棋有禁手，白擋在禁手點也算黑勝。', ': Black wins with fours only (every move forces White to block). Black has forbidden moves; if White blocks on a forbidden point it still counts as a Black win.', '：黒が四だけ（毎手白に止めさせる）で連続して勝つ。黒には禁手があり、白が禁手点で止めても黒の勝ち。', ': 흑이 4로만(매 수 백이 막도록) 연속해서 이김. 흑은 금수가 있고, 백이 금수 자리에서 막아도 흑의 승.'],
    ['：白棋只用衝四連續取勝；黑棋防守時有禁手，逼黑擋在禁手點（禁手勝）也算白勝。白先的題目黑可以比白多一顆。', ': White wins with fours only; Black defends under forbidden-move rules, so forcing Black to block on a forbidden point (forbidden win) also counts. In white-first puzzles Black may have one extra stone.', '：白が四だけで連続して勝つ。黒は守りでも禁手があり、黒に禁手点で止めさせる（禁手勝ち）も白の勝ち。白先の問題は黒が白より一つ多くてもよい。', ': 백이 4로만 연속해서 이김. 흑은 막을 때도 금수가 있어, 흑을 금수 자리에 막게 만드는 것(금수승)도 백의 승. 백선 문제는 흑이 백보다 한 개 많아도 됨.'],
    ['自動判斷', 'Auto-detect', '自動判定', '자동 판단'],
    ['：每題黑先、白先各算一次。只有一種成立就是那一種；兩種都成立叫', ': every puzzle is checked as black-first and white-first. If only one works, that is the puzzle; if both work it is ', '：各問題を黒先・白先で一回ずつ計算。一方だけ成立すればそれ、両方成立すれば', ': 모든 문제를 흑선·백선으로 한 번씩 계산. 하나만 성립하면 그쪽, 둘 다 성립하면 '],
    ['雙先', 'both', '双先', '양선'],
    ['，兩個分數都會列出來。', ', and both scores are shown.', 'と呼び、両方の点数を表示します。', '이며 두 점수를 모두 보여 줌.'],
    ['唯一解', 'Unique', '唯一解', '유일해'],
    ['：每一手都只有一個致勝走法。同一組位置先後對調不算別解；插一手空四再照答案走完也不算。', ': every move has only one winning choice. Playing the same stones in a different order is not another solution, nor is inserting an extra four and then following the answer.', '：毎手、勝てる手が一つだけ。同じ石の順番を入れ替えただけ、余分な四を一手挟んで解答通り進めるのは別解ではない。', ': 매 수 이기는 수가 하나뿐. 같은 돌의 순서만 바꾼 것, 쓸모없는 4를 한 수 끼우고 정답대로 둔 것은 다른 해가 아님.'],
    ['沒有別解', 'No alt.', '別解なし', '별해 없음'],
    ['：除了解答以外，還有另一條不同的贏法（多走幾手也能贏），就不是唯一解，不算詰題。同一解換走法（兩手先後對調、插一手空四再照答案走）不算別解。最後一手成活四時，上一手的活三已經贏定，所以只比到上一手。',
      ': if there is any other different winning line (even a longer one), the solution is not unique and it is not a puzzle. The same solution in another order (swapping two moves, or inserting an extra four) is not another solution. When the last move makes an open four, the open three before it already wins, so only moves up to that one are compared.',
      '：解答以外に別の勝ち筋（手数が長くても）があれば唯一解ではなく、詰題にならない。同じ解の手順違い（二手の入れ替え、余分な四を挟む）は別解ではない。最後の手が活四のときは、その前の活三で勝ちが決まっているので、そこまでを比べる。',
      ': 정답 말고 다른 승리 수순(더 길더라도)이 있으면 유일해가 아니며 묘수 문제가 아님. 같은 해의 순서만 바꾼 것(두 수 교환, 쓸모없는 4 끼우기)은 다른 해가 아님. 마지막 수가 활사이면 그 전 활삼에서 이미 승리가 정해지므로 그 수까지만 비교함.'],
    ['評定', 'Rating', '判定', '판정'],
    ['：10 手以內算', ': 10 moves or fewer is ', '：10 手以内は', ': 10수 이내는 '],
    ['短篇', 'short', '短編', '단편'],
    ['（看計算量、深誘餌、禁手陷阱、解禁、反四、預備反四、手順），11 手以上算', ' (reading load, deep decoys, forbidden traps, unlocks, counter-fours, prepared counter-fours, move order); 11 or more is ', '（読みの量・深い誘い・禁手の罠・禁手解除・反四・予備反四・手順を見る）、11 手以上は', '(읽기량, 깊은 미끼, 금수 함정, 금수 해제, 반사, 예비 반사, 수순을 봄), 11수 이상은 '],
    ['長篇', 'long', '長編', '장편'],
    ['（看手數與解題中的技巧）。兩組各有自己的段位，不互相比較。', ' (length and techniques in the solution). Each group has its own ranks.', '（手数と解答中の技を見る）。それぞれ独自の段位で、互いに比べない。', '(수 길이와 풀이 중 기술을 봄). 두 그룹은 각자 단위가 있으며 서로 비교하지 않음.'],
    ['段位門檻目前是暫定的固定數字，之後會調整。評分引擎跟出題 AI 用的是同一套程式。', 'Rank thresholds are provisional. The scoring engine is the same one the puzzle-making AI uses.', '段位の基準は暫定で、今後調整します。採点エンジンは出題 AI と同じプログラムです。', '단 기준은 임시이며 나중에 조정합니다. 채점 엔진은 출제 AI와 같은 프로그램입니다.'],
    // ---- 關卡 ----
    ['關卡', 'Checks', 'チェック', '검사'],
    ['黑 {a}・白 {b}', 'Black {a} · White {b}', '黒 {a}・白 {b}', '흑 {a} · 백 {b}'],
    ['連續衝四取勝', 'Win with consecutive fours', '四の連続で勝つ', '연속 4로 승리'],
    ['每一手都只有一條路', 'Only one way at every move', '毎手、道は一つだけ', '매 수 길이 하나뿐'],
    ['沒有另一條不同的贏法', 'No other different winning line', '別の勝ち筋がない', '다른 승리 수순이 없음'],
    ['評定難度', 'Rating', '難易度', '난이도'],
    ['{n} 手連續衝四勝', 'Wins with {n} consecutive fours', '{n} 手の四の連続で勝ち', '{n}수 연속 4로 승리'],
    ['第 {a} 手除了 {b}，{c} 也能贏', 'At move {a}, besides {b}, {c} also wins', '第 {a} 手は {b} 以外に {c} でも勝てる', '{a}번째 수에서 {b} 말고 {c}도 이김'],
    ['有別的贏法', 'Another winning move exists', '別の勝ち方がある', '다른 승리 수가 있음'],
    ['還有 2 條以上不同的贏法，不是唯一解', 'Two or more other winning lines: not unique', '別の勝ち筋が 2 本以上あり、唯一解ではない', '다른 승리 수순이 2개 이상: 유일해 아님'],
    ['還有 1 條不同的贏法，不是唯一解', 'One other winning line: not unique', '別の勝ち筋が 1 本あり、唯一解ではない', '다른 승리 수순이 1개: 유일해 아님'],
    ['檢查量超過上限，無法確定', 'Search limit reached; could not confirm', '検査量が上限を超え、確定できない', '검사량 한도 초과로 확인 불가'],
    ['沒有別的贏法', 'No other winning line', '別の勝ち方なし', '다른 승리 수 없음'],
    ['短篇（10 手以內）', 'Short (10 moves or fewer)', '短編（10 手以内）', '단편 (10수 이내)'],
    ['長篇（11 手以上）', 'Long (11 moves or more)', '長編（11 手以上）', '장편 (11수 이상)'],
    ['・不到 4 手，不評段位', ' · under 4 moves, no rank', '・4 手未満は段位なし', ' · 4수 미만은 단 없음'],
    ['沒有 VCF', 'No VCF', 'VCF なし', 'VCF 없음'],
    ['在 {n} 手內沒有 VCF', 'No VCF within {n} moves', '{n} 手以内に VCF なし', '{n}수 이내에 VCF 없음'],
    ['黑白子數相差超過 1', 'Stone counts differ by more than 1', '黒白の石数の差が 1 を超える', '흑백 돌 수 차이가 1 초과'],
    ['盤面已經有五連', 'There is already a five on the board', '盤上にすでに五連がある', '판에 이미 오목이 있음'],
    ['盤面上已經有人可以一步成五', 'Someone can already make five in one move', 'すでに一手で五を作れる', '이미 한 수로 오목을 만들 수 있음'],
    ['盤面不合法：', 'Illegal position: ', '不正な盤面：', '불법 국면: '],
    // ---- 難度 ----
    ['黑先・', 'Black first · ', '黒先・', '흑선 · '],
    ['白先・', 'White first · ', '白先・', '백선 · '],
    ['雙先・', 'Both · ', '双先・', '양선 · '],
    ['難度評定・短篇（10 手以內）', 'Difficulty · short (≤10 moves)', '難易度・短編（10 手以内）', '난이도 · 단편 (10수 이내)'],
    ['難度評定・長篇（11 手以上）', 'Difficulty · long (≥11 moves)', '難易度・長編（11 手以上）', '난이도 · 장편 (11수 이상)'],
    ['雙先：黑先 {a}／白先 {b}', 'Both: black {a} / white {b}', '双先：黒先 {a}／白先 {b}', '양선: 흑선 {a} / 백선 {b}'],
    ['滿格 {n}', 'Max {n}', '満点 {n}', '만점 {n}'],
    ['這題還沒過關', 'Not a valid puzzle yet', 'まだ合格していません', '아직 통과하지 못함'],
    ['段位', 'Rank', '段位', '단'],
    ['見習生', 'Apprentice', '見習い', '견습생'],
    ['初段', '1 dan', '初段', '초단'], ['二段', '2 dan', '二段', '2단'], ['三段', '3 dan', '三段', '3단'], ['四段', '4 dan', '四段', '4단'], ['五段', '5 dan', '五段', '5단'],
    ['六段', '6 dan', '六段', '6단'], ['七段', '7 dan', '七段', '7단'], ['八段', '8 dan', '八段', '8단'], ['九段', '9 dan', '九段', '9단'], ['傳說', 'Legend', '伝説', '전설'],
    ['手數', 'Moves', '手数', '수'],
    ['子數', 'Stones', '石数', '돌 수'],
    ['棋子使用率', 'Stone usage', '石の使用率', '돌 사용률'],
    ['計算中 {a}/{b}', 'Calculating {a}/{b}', '計算中 {a}/{b}', '계산 중 {a}/{b}'],
    // ---- 加分項名稱 ----
    ['計算量', 'Reading load', '読みの量', '읽기량'],
    ['：長短篇共用一套分數。每一手各值多少分再加總（底分 20，這一手能下的衝四越多越高），加上深誘餌、禁手陷阱、解禁、反四、預備反四、手順這些技巧分，再乘上棋子使用率。',
      ': short and long puzzles share one score. Each move is scored and added up (base 20, higher when more fours are available at that move), plus technique points for deep decoys, forbidden traps, unlocks, counter-fours, prepared counter-fours and move order, then multiplied by stone usage.',
      '：短編・長編とも同じ点数。一手ごとの点を合計し（基本 20 点、その手で打てる四が多いほど高い）、深い誘い・禁手の罠・禁手解除・反四・予備反四・手順の技の点を足し、石の使用率を掛ける。',
      ': 짧은 문제와 긴 문제가 같은 점수를 씀. 수마다 점수를 매겨 합산(기본 20점, 그 수에서 둘 수 있는 4가 많을수록 높음)하고, 깊은 미끼·금수 함정·금수 해제·반사·예비 반사·수순 기술 점수를 더한 뒤 돌 사용률을 곱함.'],
    ['段位：用 4 手題當尺定初段到四段，五段以上一段比一段窄，傳說不再細分。分數線照玩家實際解題的結果校準過。評分引擎跟出題 AI 用的是同一套程式。',
      'Ranks: 4-move puzzles set the scale for 1 dan to 4 dan; from 5 dan up each rank is narrower than the one below, and Legend is not subdivided. The lines are calibrated on how players actually solved. The scoring engine is the same program the puzzle-making AI uses.',
      '段位：4 手の問題を物差しに初段〜四段を決め、五段以上は一段ずつ狭くなり、伝説は細分しない。線は実際の解答結果で調整済み。採点エンジンは出題 AI と同じプログラム。',
      '단: 4수 문제를 기준으로 초단~4단을 정하고, 5단부터는 단마다 폭이 좁아지며, 전설은 더 나누지 않음. 기준선은 실제 풀이 결과로 보정함. 채점 엔진은 출제 AI와 같은 프로그램.'],
    ['深誘餌', 'Deep decoys', '深い誘い', '깊은 미끼'],
    ['禁手陷阱', 'Forbidden traps', '禁手の罠', '금수 함정'],
    ['預備反四', 'Prepared counter-four', '予備反四', '예비 반사'],
    ['反四', 'Counter-four', '反四', '반사'],
    ['手順', 'Move order', '手順', '수순'],
    ['繞路', 'Detour', '迂回', '우회'],
    ['禁手勝', 'Forbidden win', '禁手勝ち', '금수승'],
    ['解禁', 'Unlock', '禁手解除', '금수 해제'],
    ['後段手數加成', 'Late-length bonus', '終盤手数ボーナス', '후반 수 보너스'],
    ['以少勝多', 'Few stones, long win', '少ない石で長く勝つ', '적은 돌로 승리'],
    ['手數超越子數', 'More moves than stones', '手数が石数を超える', '수가 돌 수를 넘음'],
    ['大幅超越子數', 'Far more moves than stones', '手数が石数を大きく超える', '수가 돌 수를 크게 넘음'],
    ['借用途中的子', 'Borrowing new stones', '途中の石を借りる', '도중 돌 빌리기'],
    ['一子多用', 'Multi-use stone', '一石多用', '한 돌 여러 번 쓰기'],
    ['逼對方下禁手', 'Force a forbidden block', '相手に禁手を打たせる', '상대에게 금수 두게 하기'],
    ['跳躍', 'Jumps', '跳躍', '점프'],
    ['途中誘餌', 'Mid-line decoys', '途中の誘い', '도중 미끼'],
    ['自製四', 'Self-made four', '自作の四', '자작 4'],
    ['途中生線', 'New lines midway', '途中で生まれる線', '도중에 생기는 줄'],
    ['延遲借用', 'Delayed borrowing', '遅れた借用', '지연 빌리기'],
    ['換處衝四', 'Switching area', '場所を変えて四', '장소 바꿔 4'],
    ['起始子分散', 'Scattered start', '初期石の分散', '초기 돌 분산'],
    ['明誘餌', 'Visible decoys', '見える誘い', '보이는 미끼'],
    ['黑白不一樣多', 'Unequal stone counts', '黒白の数が違う', '흑백 수가 다름'],
    // ---- 加分說明 ----
    ['每一手各值多少分，全題加總：底分 20，再加 20 × log₂(這一手能下的衝四數 ÷ 2)。只有一條路的手只拿底分；能下的衝四越多、要排除的假路越多，這一手越值錢。',
      'Each move is scored and the moves are added up: a base of 20, plus 20 × log₂(fours available at that move ÷ 2). A move with only one way forward gets just the base; the more fours there are to choose from, and the more false lines to rule out, the more the move is worth.',
      '一手ごとに点をつけて合計：基本 20 点に 20 × log₂(その手で打てる四の数 ÷ 2) を足す。一本道の手は基本点だけ。打てる四が多く、消すべき偽の筋が多い手ほど高い。',
      '수마다 점수를 매겨 합산: 기본 20점에 20 × log₂(그 수에서 둘 수 있는 4의 수 ÷ 2)를 더함. 길이 하나뿐인 수는 기본점만. 둘 수 있는 4가 많고 지워야 할 가짜 수순이 많을수록 그 수의 가치가 높음.'],
    ['錯的第一手要能連走至少 4 手、後一手用到這條路下過的子，而且連到解答用的棋，才算深誘餌。每條得 6 × 手數，走到被白反擊才斷再 +10，全部最多 120 分。太淺又單獨一區、不影響解答的錯路，每條扣 2 分，最多扣 20。',
      'A wrong first move counts as a deep decoy only if it can continue at least 4 fours, later moves use its stones, it connects to the solution stones, and it truly cannot win. Each line scores 6 × length, +10 if it ends by a white counter; total cap 120. Shallow isolated wrong lines cost 2 each, up to 20.',
      '間違った初手が 4 手以上続き、後の手がその道の石を使い、解答の石につながり、しかも本当に勝てないときだけ深い誘い。1 本 6 × 手数、白の反撃で途切れたら +10、合計上限 120。浅く孤立して解答に関係ない誤りは 1 本 −2、最大 −20。',
      '틀린 첫수가 4수 이상 이어지고, 뒤의 수가 그 길의 돌을 쓰고, 정답 돌과 이어지며, 정말로 이길 수 없을 때만 깊은 미끼. 줄마다 6 × 수, 백의 반격으로 끊기면 +10, 합계 최대 120. 얕고 고립되어 정답과 무관한 틀린 길은 줄마다 −2, 최대 −20.'],
    ['看起來能衝四，其實是禁手的點。同一點只算一次；第 k 個得 3 × (1 − 0.5^k)。', 'Points that look like fours but are forbidden. Each point counts once; the k-th scores 3 × (1 − 0.5^k).', '四に見えて実は禁手の点。同じ点は一度だけ。k 個目は 3 × (1 − 0.5^k)。', '4처럼 보이지만 금수인 점. 같은 점은 한 번만, k번째는 3 × (1 − 0.5^k).'],
    ['這一點原本是禁手，黑自己下的子讓它變可以下，解答又真的下在那裡。每次 30 分。', 'This point was forbidden; Black’s own stones made it playable, and the solution really plays there. 30 each.', 'もともと禁手の点が黒自身の石で打てるようになり、解答が実際にそこへ打つ。1 回 30 点。', '원래 금수였던 점이 흑 자신의 돌로 둘 수 있게 되고, 정답이 실제로 거기에 둠. 회당 30점.'],
    ['白擋下的同時自己成四，黑要先擋回去。第 k 次得 8 × (1 − 0.5^k)。', 'White’s block also makes a four, so Black must block back first. The k-th scores 8 × (1 − 0.5^k).', '白の止めが同時に四になり、黒は先に止め返す必要がある。k 回目は 8 × (1 − 0.5^k)。', '백의 막기가 동시에 4가 되어 흑이 먼저 되막아야 함. k번째는 8 × (1 − 0.5^k).'],
    ['黑擋回去的四，用到更早佈好、之前沒用過的子。每次 30 分。', 'Black’s blocking four uses stones prepared earlier and not used before. 30 each.', '黒が止め返す四が、早くから用意され、それまで使っていない石を使う。1 回 30 点。', '흑이 되막는 4가 미리 준비해 두고 아직 쓰지 않은 돌을 씀. 회당 30점.'],
    ['後面才該下的四，現在先衝就贏不了。每手最多算 2 個，每個 15 分。', 'A four that belongs later; playing it now loses. Up to 2 per move, 15 each.', '後で打つべき四を今打つと勝てない。一手につき最大 2 個、各 15 点。', '나중에 둬야 할 4를 지금 두면 못 이김. 수마다 최대 2개, 개당 15점.'],
    ['白先的最後一手逼黑擋在禁手點：黑擋不了，白勝。這叫禁手勝，加 30 分。', 'White’s last move forces Black to block on a forbidden point: Black cannot, White wins. This forbidden win adds 30.', '白先の最後の手で黒に禁手点で止めさせる：黒は止められず白の勝ち。禁手勝ちで +30。', '백선 마지막 수가 흑을 금수 자리에 막게 함: 흑은 못 막고 백 승. 금수승 +30.'],
    ['白先的結局是逼黑擋在禁手點（黑擋不了）才算禁手勝，加 30 分。這題的結局不是。', 'A forbidden win is when White’s finish forces Black to block on a forbidden point (+30). This puzzle’s finish is not.', '白先の結末で黒に禁手点で止めさせたときだけ禁手勝ち（+30）。この問題は違う。', '백선 결말에서 흑을 금수 자리에 막게 할 때만 금수승(+30). 이 문제는 아님.'],
    ['除了解答之外還有 {n} 條多走幾手也能贏的路，每條扣 15 分。', 'Besides the solution there are {n} longer winning lines, −15 each.', '解答のほかに手数の長い勝ち筋が {n} 本、1 本 −15。', '정답 외에 더 긴 승리 수순 {n}개, 개당 −15.'],
    ['第 {a} 手 {b}：{c} 個衝四可下', 'Move {a} {b}: {c} fours available', '第 {a} 手 {b}：打てる四 {c} 個', '{a}번째 수 {b}: 둘 수 있는 4 {c}개'],
    ['先走 {a}：連走 {b} 手，被白反擊才斷', 'Start with {a}: {b} fours, then cut by a white counter', '{a} から：{b} 手続き、白の反撃で途切れる', '{a}부터: {b}수 이어지다 백의 반격으로 끊김'],
    ['先走 {a}：連走 {b} 手', 'Start with {a}: {b} fours', '{a} から：{b} 手続く', '{a}부터: {b}수 이어짐'],
    ['先走 {a}：只有 {b} 手，單獨一區', 'Start with {a}: only {b} moves, isolated', '{a} から：{b} 手だけ、孤立', '{a}부터: {b}수뿐, 고립'],
    ['第 {a} 手：{b} 是禁手', 'Move {a}: {b} is forbidden', '第 {a} 手：{b} は禁手', '{a}번째 수: {b}는 금수'],
    ['第 {a} 手下在 {b}', 'Move {a} plays {b}', '第 {a} 手を {b} に打つ', '{a}번째 수를 {b}에 둠'],
    ['第 {a} 手白擋 {b} 同時成四', 'Move {a}: White blocks {b} and makes a four', '第 {a} 手：白が {b} で止めて同時に四', '{a}번째 수: 백이 {b}로 막으며 4'],
    ['第 {a} 手 {b} 擋回去', 'Move {a}: {b} blocks back', '第 {a} 手 {b} で止め返す', '{a}번째 수 {b}로 되막기'],
    ['第 {a} 手：{b} 現在衝太早', 'Move {a}: {b} is too early now', '第 {a} 手：{b} は今打つと早すぎる', '{a}번째 수: {b}는 지금 두면 너무 이름'],
    ['這題沒有。', 'None in this puzzle.', 'この問題にはありません。', '이 문제에는 없음.'],
    ['另外 {n} 個錯的第一手不夠深或沒連到解答，不算分。', '{n} other wrong first moves are too shallow or not connected to the solution, so they do not score.', 'ほかに {n} 個の誤った初手は浅いか解答につながらず、点になりません。', '다른 틀린 첫수 {n}개는 얕거나 정답과 이어지지 않아 점수 없음.'],
    ['深誘餌加起來 {n} 分，超過上限，只算 120。', 'Deep decoys add up to {n}, over the cap, so only 120 counts.', '深い誘いの合計 {n} 点は上限超えのため 120 点。', '깊은 미끼 합계 {n}점은 한도 초과라 120점만 인정.'],
    ['明細加起來 {a}，和分數 {b} 對不上，這題可能有問題。', 'Items add up to {a}, which does not match the score {b}; this puzzle may have a problem.', '内訳の合計 {a} が点数 {b} と合いません。問題があるかもしれません。', '내역 합계 {a}가 점수 {b}와 맞지 않음. 문제가 있을 수 있음.'],
    ['棋盤上每顆子都拿掉重算一次：拿掉就解不開的 {a} 顆、有用的 {b} 顆（拿掉分數掉 10% 以上，或要留著補黑白一樣多）、廢子 {c} 顆。總分乘上 1 +（使用率 − 75%），範圍 ×0.7 到 ×1.25。',
      'Every stone is removed once and rescored: {a} are essential (the puzzle breaks), {b} are useful (score drops 10%+ or needed for balance), {c} are wasted. The score is multiplied by 1 + (usage − 75%), within ×0.7 to ×1.25.',
      '盤上の石を一つずつ外して再計算：外すと解けない石 {a}、役に立つ石 {b}（点数が 10% 以上下がる、または黒白の数合わせ）、無駄石 {c}。点数に 1 +（使用率 − 75%）を掛け、×0.7〜×1.25。',
      '판의 돌을 하나씩 빼고 다시 계산: 빼면 풀리지 않는 돌 {a}개, 쓸모 있는 돌 {b}개(점수 10% 이상 하락 또는 흑백 수 맞추기), 낭비 돌 {c}개. 점수에 1 + (사용률 − 75%)를 곱함, ×0.7~×1.25.'],
    ['看拿掉也沒差的子（{n} 顆）', 'Show removable stones ({n})', '外しても変わらない石を見る（{n} 個）', '빼도 상관없는 돌 보기 ({n}개)'],
    ['拿掉也沒差的子', 'Removable stones', '外しても変わらない石', '빼도 상관없는 돌'],
    ['（虛線框）：', ' (dashed): ', '（点線枠）：', '(점선 테두리): '],
    ['。其中要留著補黑白一樣多的不算廢子。', '. Ones kept to balance the counts are not waste.', '。黒白の数合わせに残す石は無駄石ではありません。', '. 흑백 수를 맞추려고 남긴 돌은 낭비가 아님.'],
    ['棋子使用率 {n}%', 'Stone usage {n}%', '石の使用率 {n}%', '돌 사용률 {n}%'],
    ['白先的題目黑要比白多一顆，不是的話扣一點。', 'White-first puzzles should have one more black stone; otherwise a small penalty.', '白先の問題は黒が白より一つ多いのが基本で、違うと少し減点。', '백선 문제는 흑이 백보다 하나 많아야 하며, 아니면 조금 감점.'],
    ['黑先的題目黑白要一樣多，不一樣就扣一點。', 'Black-first puzzles should have equal counts; otherwise a small penalty.', '黒先の問題は黒白同数が基本で、違うと少し減点。', '흑선 문제는 흑백 수가 같아야 하며, 다르면 조금 감점.'],
    ['假路：先走 {a}', 'False line: start with {a}', '偽の道：{a} から', '가짜 길: {a}부터'],
    ['（虛線）。', ' (dashed). ', '（点線）。', ' (점선). '],
    ['只有這幾手，又跟解答無關，一眼就能排除。', 'Only these moves and unrelated to the solution; easy to rule out.', 'これだけの手で解答と無関係、すぐ除外できる。', '이 몇 수뿐이고 정답과 무관해 바로 배제 가능.'],
    ['連走 {n} 手之後被白反擊，就走不下去了，看起來能贏，其實不是解答。', 'After {n} fours White counters and it stops; it looks winning but is not the solution.', '{n} 手続いた後に白の反撃で行き詰まる。勝てそうに見えて解答ではない。', '{n}수 이어진 뒤 백의 반격으로 막힘. 이길 것 같지만 정답이 아님.'],
    ['連走 {n} 手之後，就走不下去了，看起來能贏，其實不是解答。', 'After {n} fours it cannot continue; it looks winning but is not the solution.', '{n} 手続いた後に行き詰まる。勝てそうに見えて解答ではない。', '{n}수 이어진 뒤 막힘. 이길 것 같지만 정답이 아님.'],
    ['這條 ', 'This line ', 'この道 ', '이 길 '],
    // ---- 逐手解說 ----
    ['按 ▶ 一手一手看解答。青圈＝這一手、橘圈＝當下也能衝但走不通的四（假路）、紅 ✕＝禁手陷阱。', 'Press ▶ to step through the solution. Teal ring = this move, orange ring = a four that is possible now but fails (false line), red ✕ = forbidden trap.', '▶ で一手ずつ解答を見る。青丸＝この手、橙丸＝今も打てるが通らない四（偽の道）、赤 ✕＝禁手の罠。', '▶로 한 수씩 정답 보기. 청록 원 = 이번 수, 주황 원 = 지금도 둘 수 있지만 안 통하는 4(가짜 길), 빨간 ✕ = 금수 함정.'],
    ['第 {a} 手 {b}', 'Move {a} {b}', '第 {a} 手 {b}', '{a}번째 수 {b}'],
    ['（白 {a}）', ' (White {a})', '（白 {a}）', ' (백 {a})'],
    ['白剛剛擋出四，這手只能擋回去，同時自己成四', 'White’s block made a four, so this move must block back while making a four', '白の止めが四になったので、この手は止め返しつつ自分も四', '백이 막으며 4를 만들어 이 수는 되막으면서 자신도 4'],
    ['一次做出兩個成五點，白擋不完，', 'Makes two five points at once; White cannot block both, ', '一度に五の点を二つ作り、白は止めきれない、', '오목 자리를 한 번에 두 개 만들어 백이 다 못 막음, '],
    ['黑勝', 'Black wins', '黒の勝ち', '흑 승'],
    ['白勝', 'White wins', '白の勝ち', '백 승'],
    ['白唯一的擋點是禁手，', 'White’s only blocking point is forbidden, ', '白の唯一の止め点が禁手、', '백의 유일한 막는 자리가 금수, '],
    ['衝四，白只能擋 {a}', 'Four; White can only block {a}', '四、白は {a} で止めるしかない', '4, 백은 {a}로만 막을 수 있음'],
    ['：這一點原本是禁手，前面黑下的子讓它可以下', ': this point was forbidden; Black’s earlier stones made it playable', '：もともと禁手の点が、前に打った黒石で打てるようになった', ': 원래 금수였던 점이 앞서 둔 흑돌로 둘 수 있게 됨'],
    ['這一點原本是禁手，但不是黑自己解開的（例如白擋掉），不算解禁', 'This point was forbidden but Black did not unlock it (e.g. White blocked), so it is not an unlock', 'もともと禁手の点だが黒自身が解いたのではない（白の止めなど）ので禁手解除ではない', '원래 금수였지만 흑이 스스로 푼 것이 아니라(예: 백이 막음) 금수 해제가 아님'],
    ['：{a} 看起來能衝，其實是禁手（✕）', ': {a} looks playable but is forbidden (✕)', '：{a} は打てそうで実は禁手（✕）', ': {a}는 둘 수 있어 보이지만 금수 (✕)'],
    ['另外 {a} 也能衝四（橘圈），但走不通', '{a} can also make a four (orange) but fails', 'ほかに {a} も四になる（橙丸）が通らない', '{a}도 4가 되지만(주황 원) 안 통함'],
    ['：{a} 之後要下，現在先衝就贏不了', ': {a} belongs later; playing it now loses', '：{a} は後で打つ手、今打つと勝てない', ': {a}는 나중에 둘 수, 지금 두면 못 이김'],
    ['：白這一擋自己也成四，黑下一手要先擋回去', ': White’s block also makes a four; Black must block back next', '：白の止めが自分も四になり、黒は次に止め返す', ': 백의 막기가 4가 되어 흑은 다음에 되막아야 함'],
    ['：擋回去的四用到更早佈好的子', ': the blocking four uses stones prepared earlier', '：止め返す四が早くから用意した石を使う', ': 되막는 4가 미리 준비한 돌을 씀'],
    ['這個四全用途中下的子', 'This four uses only stones played along the way', 'この四は途中で打った石だけを使う', '이 4는 도중에 둔 돌만 씀'],
    ['這個四借用途中下的 {n} 顆子', 'This four borrows {n} stones played along the way', 'この四は途中で打った石を {n} 個借りる', '이 4는 도중에 둔 돌 {n}개를 빌림'],
    ['換到遠處衝', 'Switches to a distant area', '遠くへ場所を変える', '먼 곳으로 옮겨 둠'],
    ['這手加分：', 'Points this move: ', 'この手の加点：', '이 수 가산점: '],
    ['這手沒有直接加分', 'No direct points this move', 'この手に直接の加点なし', '이 수는 직접 가산점 없음'],
    ['要讀 {n} 個局面', '{n} positions to read', '{n} 局面を読む', '{n}개 국면 읽기'],
    ['解答 {n} 手', 'Solution: {n} moves', '解答 {n} 手', '정답 {n}수'],
    ['試走中：從第 {a} 手開始，自己下了 {b} 手', 'Trying: from move {a}, {b} of your own moves', '試し打ち中：第 {a} 手から、自分で {b} 手', '시험 중: {a}번째 수부터 직접 {b}수'],
    // ---- 評分過程訊息 ----
    ['已取消。', 'Cancelled.', '中止しました。', '취소했습니다.'],
    ['棋盤上還沒有黑子。', 'There are no black stones yet.', '盤にまだ黒石がありません。', '판에 아직 흑돌이 없습니다.'],
    ['計算中：找最短 VCF、逐手檢查別解與繞路。長題可能要幾十秒。', 'Calculating: shortest VCF, then checking every move for other solutions. Long puzzles can take tens of seconds.', '計算中：最短 VCF を探し、一手ずつ別解を確認。長い問題は数十秒かかることがあります。', '계산 중: 최단 VCF를 찾고 수마다 다른 해를 확인. 긴 문제는 수십 초 걸릴 수 있음.'],
    ['長題：搜尋量不夠，自動加大到 ', 'Long puzzle: search budget too small, raising it to ', '長い問題：探索量が足りないので自動で ', '긴 문제: 탐색량이 부족해 자동으로 '],
    [' 重算中…（已算 {a} 秒，再按一次可取消）', ' and recalculating… ({a} s so far, press again to cancel)', ' に増やして再計算中…（{a} 秒経過、もう一度押すと中止）', '로 늘려 다시 계산 중… ({a}초 경과, 다시 누르면 취소)'],
    ['計算出錯：', 'Calculation error: ', '計算エラー：', '계산 오류: '],
    ['計算出錯了。', 'Calculation error.', '計算エラーです。', '계산 오류입니다.'],
    ['黑先算完，接著看白先…（再按一次可取消）', 'Black-first done, now checking white-first… (press again to cancel)', '黒先が終わり、白先を確認中…（もう一度押すと中止）', '흑선 계산 끝, 백선 확인 중… (다시 누르면 취소)'],
    ['這題', 'This puzzle is ', 'この問題は', '이 문제는 '],
    ['黑先、白先都成立', 'valid both as black-first and white-first', '黒先・白先ともに成立', '흑선·백선 모두 성립'],
    ['（雙先）：黑先 {a} 分、白先 {b} 分，下面顯示分數高的', ' (both): black-first {a}, white-first {b}; showing the higher one, ', '（双先）：黒先 {a} 点・白先 {b} 点、下は点の高い', '(양선): 흑선 {a}점, 백선 {b}점, 아래는 점수가 높은 '],
    ['自動判斷：這題是', 'Auto-detected: this puzzle is ', '自動判定：この問題は', '자동 판단: 이 문제는 '],
    ['黑先、白先都不成立，下面顯示黑先的檢查結果。', 'Neither black-first nor white-first works; showing the black-first check.', '黒先・白先とも不成立。下は黒先の検査結果。', '흑선·백선 모두 성립하지 않음. 아래는 흑선 검사 결과.'],
    ['計算時間 {a} 秒', 'Calculated in {a} s', '計算時間 {a} 秒', '계산 시간 {a}초'],
    ['（搜尋量自動加大到 ×{a}）', ' (search raised to ×{a})', '（探索量を ×{a} に自動拡大）', ' (탐색량 ×{a}로 자동 확대)'],
    ['黑先', 'black-first', '黒先', '흑선'],
    ['白先', 'white-first', '白先', '백선'],
    // ---- 試走 ----
    ['試走：從第 {a} 手開始，輪到', 'Try mode: from move {a}, it is ', '試し打ち：第 {a} 手から、', '시험 두기: {a}번째 수부터 '],
    ['（進攻方）。點棋盤上的空點下一手，電腦會照規則擋。', '’s turn (attacker). Tap an empty point; the computer blocks by the rules.', '（攻め方）の番。空いている点をタップして打つと、コンピューターがルール通り止めます。', '(공격 쪽) 차례. 빈 점을 누르면 컴퓨터가 규칙대로 막습니다.'],
    ['{a}：計算中…', '{a}: calculating…', '{a}：計算中…', '{a}: 계산 중…'],
    ['那裡已經有子了，換一個空點。', 'That point is taken; choose an empty one.', 'そこにはもう石があります。空いている点を選んでください。', '거기에는 이미 돌이 있습니다. 빈 점을 고르세요.'],
    ['{a} 不是四：VCF 每一手都要衝四，換一手。', '{a} is not a four: every VCF move must be a four. Try another.', '{a} は四ではありません：VCF は毎手四が必要です。別の手を。', '{a}는 4가 아닙니다: VCF는 매 수 4여야 합니다. 다른 수를.'],
    ['{a} 是黑的禁手，不能下。', '{a} is forbidden for Black.', '{a} は黒の禁手で打てません。', '{a}는 흑의 금수라 둘 수 없습니다.'],
    ['有四，要先擋 ', ' has a four; block first at ', 'に四があり、先に止める点は ', '에게 4가 있어 먼저 막을 곳: '],
    ['勝：', ' wins: ', 'の勝ち：', ' 승: '],
    ['要擋的 {a} 是禁手，擋不了（', ' must block {a}, which is forbidden (', 'が止める {a} は禁手で止められない（', '가 막아야 할 {a}는 금수라 못 막음 ('],
    ['）。按「退一手」可以再試別的。', '). Press "Undo" to try something else.', '）。「一手戻す」で別の手を試せます。', '). "한 수 무르기"로 다른 수를 시도할 수 있습니다.'],
    ['。按「退一手」可以再試別的。', '. Press "Undo" to try something else.', '。「一手戻す」で別の手を試せます。', '. "한 수 무르기"로 다른 수를 시도할 수 있습니다.'],
    ['電腦擋在 ', 'The computer blocks at ', 'コンピューターは ', '컴퓨터가 막은 곳: '],
    ['，這一擋', '; this block lets ', ' で止め、この止めで', ', 이 막기로 '],
    ['自己成五或做出雙四，', ' make five or a double four, ', 'が五か四々を作り、', '가 오목이나 쌍사를 만들어 '],
    ['輸了', ' loses', 'の負け', ' 패'],
    ['。按「退一手」換別的走法。', '. Press "Undo" to try another line.', '。「一手戻す」で別の手を。', '. "한 수 무르기"로 다른 길을.'],
    ['照這條路你還有 ', 'On this line you still have ', 'この道ではまだ ', '이 길로 아직 '],
    ['{n} 手', '{n} moves', '{n} 手', '{n}수'],
    [' VCF。', ' of VCF.', ' の VCF があります。', ' VCF가 남았습니다.'],
    ['照這條路', 'On this line ', 'この道では', '이 길로는 '],
    ['已經沒有 VCF', 'there is no VCF left', 'もう VCF がありません', '더 이상 VCF가 없습니다'],
    [' 了，按「退一手」換別的走法。', '; press "Undo" to try another line.', '。「一手戻す」で別の手を。', '. "한 수 무르기"로 다른 길을.'],
    ['剩下的變化太多，算不完。', 'Too many variations left to finish calculating.', '残りの変化が多すぎて計算しきれません。', '남은 변화가 너무 많아 계산을 끝낼 수 없습니다.'],
    ['注意：這一擋讓', 'Note: this block gives ', '注意：この止めで', '주의: 이 막기로 '],
    ['也成四，你下一手要先擋 ', ' a four too; your next move must block ', 'も四になり、次はまず ', '도 4가 되어 다음 수에 먼저 막아야 할 곳: '],
    ['退了一手，輪到你下。', 'Undid one move; your turn.', '一手戻しました。あなたの番です。', '한 수 물렀습니다. 당신 차례입니다.'],
    ['回到第 {a} 手，輪到你下。', 'Back to move {a}; your turn.', '第 {a} 手に戻りました。あなたの番です。', '{a}번째 수로 돌아왔습니다. 당신 차례입니다.'],
    // ---- 輸入、複製 ----
    ['用題號找題目', 'Find a puzzle by ID', '題番で問題を探す', '문제 번호로 찾기'],
    ['找題目', 'Find', '探す', '찾기'],
    ['題號（例：0015P5B9）', 'Puzzle ID (e.g. 0015P5B9)', '題番（例：0015P5B9）', '문제 번호 (예: 0015P5B9)'],
    ['題號格式不對：要 8 碼英數字（例：0015P5B9）', 'Not a valid ID: 8 letters/digits (e.g. 0015P5B9)', '題番の形式が違います：英数字 8 桁（例：0015P5B9）', '문제 번호 형식이 틀렸습니다: 영숫자 8자 (예: 0015P5B9)'],
    ['搜尋題號 {id}…（題庫第 {k} / {n} 個檔）', 'Searching {id}… (puzzle file {k} / {n})', '{id} を検索中…（問題ファイル {k} / {n}）', '{id} 검색 중… (문제 파일 {k} / {n})'],
    ['找到題號 {id}：{d}、{n} 手、攻方 {a}', 'Found {id}: {d}, {n} moves, attacker {a}', '{id} が見つかりました：{d}・{n} 手・攻め方 {a}', '{id} 찾음: {d}, {n}수, 공격 {a}'],
    ['找不到題號 {id}（已查完 {n} 個題庫檔）', 'No puzzle {id} found (searched all {n} files)', '{id} は見つかりません（{n} ファイルすべて確認済み）', '{id} 없음 ({n}개 파일 모두 확인)'],
    ['題庫讀不到，請稍後再試', 'Could not load the puzzle files. Try again later.', '問題ファイルを読み込めません。後でもう一度お試しください', '문제 파일을 불러오지 못했습니다. 잠시 후 다시 시도하세요'],
    ['看不懂這段輸入：請用「黑 H8 G7 ｜ 白 J9」、文字棋盤（●○）或題庫 JSON。', 'Could not read that: use "Black H8 G7 | White J9", a text board (●○) or puzzle JSON.', '入力を読めません：「黒 H8 G7 ｜ 白 J9」、テキスト盤面（●○）、問題 JSON のどれかで。', '입력을 읽을 수 없습니다: "흑 H8 G7 | 백 J9", 텍스트 판(●○), 문제 JSON 중 하나로.'],
    ['已讀入文字棋盤：', 'Text board loaded: ', 'テキスト盤面を読み込みました：', '텍스트 판을 읽었습니다: '],
    ['已複製盤面。', 'Position copied.', '局面をコピーしました。', '국면을 복사했습니다.'],
    ['已複製成文字棋盤（●黑 ○白），可以直接貼到聊天或文件。', 'Copied as a text board (● black ○ white); paste it into chats or documents.', 'テキスト盤面（●黒 ○白）でコピーしました。チャットや文書にそのまま貼れます。', '텍스트 판(●흑 ○백)으로 복사했습니다. 채팅이나 문서에 바로 붙여넣을 수 있습니다.'],
    ['產生圖片失敗。', 'Could not create the image.', '画像を作れませんでした。', '이미지를 만들지 못했습니다.'],
    ['已複製這題的連結，貼給朋友就能打開同一題。', 'Link copied; friends can open the same puzzle with it.', 'この問題のリンクをコピーしました。友だちに送ると同じ問題を開けます。', '이 문제 링크를 복사했습니다. 친구에게 보내면 같은 문제를 열 수 있습니다.'],
    // ---- 分享卡 ----
    ['詰題', 'Puzzle', '詰題', '묘수'],
    ['，找出 VCF', ': find the VCF', '、VCF を探せ', ', VCF를 찾아라'],
    ['鑑定分數', 'Rated score', '鑑定点', '감정 점수'],
    // ---- 通用短詞（最後套） ----
    ['黑 {a}', 'Black {a}', '黒 {a}', '흑 {a}'],
    ['白 {a}', 'White {a}', '白 {a}', '백 {a}'],
    ['黑', 'Black', '黒', '흑'],
    ['白', 'White', '白', '백'],
  ];
  const PUNCT = { en: [['，', ', '], ['。', '. '], ['；', '; '], ['：', ': '], ['（', ' ('], ['）', ') '], ['、', ', '], ['「', '"'], ['」', '"'], ['／', ' / '], ['　', ' ']],
                  ko: [['，', ', '], ['。', '. '], ['；', '; '], ['：', ': '], ['（', ' ('], ['）', ') '], ['、', ', '], ['「', '"'], ['」', '"'], ['　', ' ']] };
  const IDX = { en: 1, ja: 2, ko: 3 };
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const COMPILED = R.map(r => {
    const names = [];
    const src = esc(r[0]).replace(/\\\{(\w+)\\\}/g, (_, n) => { names.push(n); return '([^\\s，。；：（）「」]+)'; });
    return { re: new RegExp(src, 'g'), names, r, len: r[0].length };
  }).sort((a, b) => b.len - a.len);
  let lang = 'zh';
  try { lang = localStorage.getItem('vcfgame.lang') || ''; } catch {}
  if (!LANGS.some(l => l[0] === lang)) {
    const nav = (navigator.languages || [navigator.language || 'zh']).map(x => x.toLowerCase());
    lang = nav.some(x => x.startsWith('ja')) ? 'ja' : nav.some(x => x.startsWith('ko')) ? 'ko' : nav.some(x => x.startsWith('zh')) ? 'zh' : 'en';
  }
  function tr(s) {
    if (lang === 'zh' || !s || !/[一-鿿]/.test(s)) return s;
    const k = IDX[lang];
    let out = s;
    for (const c of COMPILED) {
      if (!out.includes(c.r[0].split('{')[0])) continue;
      out = out.replace(c.re, (...m) => { let t = c.r[k]; c.names.forEach((n, i) => { t = t.split('{' + n + '}').join(m[i + 1]); }); return t; });
    }
    if (PUNCT[lang]) for (const [a, b] of PUNCT[lang]) out = out.split(a).join(b);
    return out.replace(/ {2,}/g, ' ');
  }
  const ORIG = new WeakMap(), ATTRS = ['title', 'aria-label', 'placeholder'];
  let busy = false;
  function fixNode(n) {
    if (n.nodeType === 3) {
      const cur = n.nodeValue;
      let o = ORIG.get(n);
      if (o === undefined || (cur !== o.out)) o = { zh: cur };   // 程式改了字 → 新的中文原文
      const out = tr(o.zh);
      ORIG.set(n, { zh: o.zh, out });
      if (out !== cur) n.nodeValue = out;
      return;
    }
    if (n.nodeType !== 1 || n.tagName === 'SCRIPT' || n.tagName === 'STYLE') return;
    for (const a of ATTRS) {
      if (!n.hasAttribute(a)) continue;
      const key = 'data-zh-' + a, cur = n.getAttribute(a);
      const saved = n.getAttribute(key), last = n.getAttribute(key + '-out');
      const zh = saved !== null && cur === last ? saved : cur;
      const out = tr(zh);
      n.setAttribute(key, zh); n.setAttribute(key + '-out', out);
      if (out !== cur) n.setAttribute(a, out);
    }
    for (const c of n.childNodes) fixNode(c);
  }
  function apply() {
    busy = true;
    document.documentElement.lang = LANGS.find(l => l[0] === lang)[2];
    fixNode(document.body);
    if (!document.title.startsWith('VCF') || lang === 'zh') document.title = tr('詰題試煉場');
    busy = false;
  }
  const mo = new MutationObserver(ms => {
    if (busy) return;
    busy = true;
    for (const m of ms) {
      if (m.type === 'characterData') fixNode(m.target);
      else if (m.type === 'attributes') fixNode(m.target);
      else m.addedNodes.forEach(fixNode);
    }
    busy = false;
  });
  window.VCF_I18N = { tr: s => tr(s), get lang() { return lang; }, LANGS,
    set(l) { lang = l; try { localStorage.setItem('vcfgame.lang', l); } catch {} apply(); } };
  // 分享卡是畫在 canvas 上的字，攔 fillText 一起換
  const fill = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (t, ...rest) { return fill.call(this, tr(String(t)), ...rest); };
  // 語言選單：頁首右邊一個地球 icon（桌機、手機都有）
  function langMenu() {
    const head = document.querySelector('header');
    if (!head || document.getElementById('langBtn')) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'langBtn'; btn.className = 'icob'; btn.setAttribute('aria-label', '語言'); btn.setAttribute('aria-haspopup', 'true');
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" class="ico"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>';
    btn.style.display = 'inline-flex';
    const menu = document.createElement('div');
    menu.id = 'langMenu'; menu.setAttribute('role', 'menu');
    menu.style.cssText = 'position:absolute;right:56px;top:52px;z-index:31;background:var(--panel);border:1px solid var(--line2);border-radius:14px;padding:6px;display:none;flex-direction:column;min-width:140px;box-shadow:0 10px 30px rgba(0,0,0,.5)';
    const show = (on) => { menu.style.display = on ? 'flex' : 'none'; };   // 用 style 開關（display 寫在 style 裡會蓋掉 hidden）
    const draw = () => { menu.innerHTML = LANGS.map(([k, n, h]) => `<button type="button" role="menuitem" data-l="${k}" lang="${h}" style="min-height:44px;padding:0 14px;border:0;border-radius:10px;background:transparent;color:${k === lang ? 'var(--gold)' : 'var(--text)'};font:inherit;font-size:15px;text-align:left;cursor:pointer;font-weight:${k === lang ? 700 : 400}">${n}</button>`).join(''); };
    btn.onclick = (e) => { e.stopPropagation(); draw(); show(menu.style.display === 'none'); };
    menu.onclick = (e) => { const b = e.target.closest('[data-l]'); if (!b) return; show(false); window.VCF_I18N.set(b.dataset.l); };
    document.addEventListener('click', (e) => { if (menu.style.display !== 'none' && !menu.contains(e.target) && !btn.contains(e.target)) show(false); });
    head.style.position = 'relative';
    const more = document.getElementById('mMore');
    if (more) head.insertBefore(btn, more.previousElementSibling); else head.appendChild(btn);
    head.appendChild(menu);
  }
  function start() {
    langMenu();
    apply();
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
