# 效能優化交接單

**日期**：2026/04/12  
**目標檔案**：`index.html`  
**背景**：本次對話分析了 VCF 搜尋的效能瓶頸，找出兩個可優化方向，尚未動手，交由下一位實作。

---

## 優化一：`countFoursInDir` / `isLiveFourInDir` 改用 Line Buffer

### 問題

這兩個函數都有相同結構：

```javascript
for(let dist=-4;dist<=4;dist++){
  const nr=r+dist*dr, nc=c+dist*dc;
  if(!inBounds(nr,nc)||b[nr][nc]!==EMPTY) continue;
  b[nr][nc]=BLACK;
  const len=lineCount(b,nr,nc,dr,dc,BLACK);  // ← 每次呼叫 2 次 countDir while loop
  b[nr][nc]=EMPTY;
  if(len===5) ...
}
```

`lineCount` 每次都呼叫 `countDir` 兩次，`countDir` 是 while 迴圈，每步存取二維陣列 `b[rr][cc]` 並做 bounds check。

在 VCF DFS 中，`countFoursInDir` 被 `countRealFourDirs`（4 方向）呼叫，`isLiveFourInDir` 被 `isLiveThreeInDir`（9 個候選 × 4 方向）呼叫。每次搜尋節點都觸發，是明確的熱路徑。

### 優化方案：預提取 11 格 buffer

以落子點 `(r,c)` 為中心，在每個方向預先取出 ±5 格（11 格）到 local array，後續所有掃描都在 local array 上操作。

**正確性保證**：
- 合法遊戲中，落子點任一側最多 4 個連續同色子（5 連 = 勝利，不會出現在後續棋盤上）
- 因此候選空格最遠在 ±4，連子計算最多需要到 ±5（比候選再多 1 格）
- ±5 = 11 格完全涵蓋所有情況，不會有 false positive / false negative

**實作方式**：

```javascript
function countFoursInDir(b, r, c, dr, dc) {
  // 1. 一次提取 11 格 (±5)
  const buf = new Int8Array(11);
  for(let i = 0; i < 11; i++){
    const nr = r + (i-5)*dr, nc = c + (i-5)*dc;
    buf[i] = inBounds(nr, nc) ? b[nr][nc] : -1; // -1 = 邊界/白子當壁
  }
  // buf[5] = b[r][c] = BLACK（落子點）

  // 2. 在 buffer 上掃描，找所有補子後成五的位置
  const dists = [];
  for(let i = 0; i < 11; i++){
    if(buf[i] !== EMPTY) continue;
    buf[i] = BLACK;
    let left = 0, right = 0;
    for(let k = i-1; k >= 0 && buf[k] === BLACK; k--) left++;
    for(let k = i+1; k < 11 && buf[k] === BLACK; k++) right++;
    if(1 + left + right === 5) dists.push(i - 5);
    buf[i] = EMPTY;
  }

  // 3. grouping 邏輯不變
  if(!dists.length) return 0;
  let groups = 1;
  for(let i = 1; i < dists.length; i++){
    if(dists[i] - dists[i-1] !== 5) groups++;
  }
  return groups;
}
```

`isLiveFourInDir` 同理，把計數 `len===5` 改成累加 `validFivePts`：

```javascript
function isLiveFourInDir(b, r, c, dr, dc) {
  const buf = new Int8Array(11);
  for(let i = 0; i < 11; i++){
    const nr = r + (i-5)*dr, nc = c + (i-5)*dc;
    buf[i] = inBounds(nr, nc) ? b[nr][nc] : -1;
  }
  let validFivePts = 0;
  for(let i = 0; i < 11; i++){
    if(buf[i] !== EMPTY) continue;
    buf[i] = BLACK;
    let left = 0, right = 0;
    for(let k = i-1; k >= 0 && buf[k] === BLACK; k--) left++;
    for(let k = i+1; k < 11 && buf[k] === BLACK; k++) right++;
    if(1 + left + right === 5) validFivePts++;
    buf[i] = EMPTY;
  }
  return validFivePts >= 2;
}
```

### 注意

- `isLiveThreeInDir` 內部呼叫 `isLiveFourInDir(b, nr, nc, dr, dc)` 時，`nr,nc` 是不同的中心點，buffer 會重新提取，正確。
- **`isForbiddenWithVisited` / `isLiveThreeInDir` 本體不動**（CLAUDE.md 明確禁止）。

---

## 優化二：`countRealFourDirs` 加早退

### 問題

```javascript
function countRealFourDirs(b, r, c){
  let cnt = 0;
  for(const [dr,dc] of DIRS) cnt += countFoursInDir(b,r,c,dr,dc);
  return cnt;
}
```

呼叫端：

```javascript
else if(countRealFourDirs(b,r,c) >= 2) result = true;
```

第一、二方向就已達 cnt >= 2，仍繼續跑第三、四方向。

### 修法（2 行）

```javascript
function countRealFourDirs(b, r, c){
  let cnt = 0;
  for(const [dr,dc] of DIRS){
    cnt += countFoursInDir(b,r,c,dr,dc);
    if(cnt >= 2) return cnt;  // 早退
  }
  return cnt;
}
```

---

## 優化三：`bbLineIdx` 預計算 lookup table（選做）

### 問題

```javascript
function bbLineIdx(r, c, dir){
  switch(dir){
    case 0: return {i:r,      p:c};
    case 1: return {i:c,      p:r};
    case 2: return {i:r-c+14, p:c};
    case 3: return {i:r+c,    p:r};
  }
}
```

每次呼叫都 allocate 一個新 object `{i, p}`，在 `isFive`、`isOverline`、`bbSet`、`bbClear` 的熱路徑上累積 GC 壓力。

### 修法

```javascript
// 在 BL 宣告旁邊加，初始化一次
const BB_I = new Uint8Array(15 * 15 * 4);
const BB_P = new Uint8Array(15 * 15 * 4);
(function buildBBIdx(){
  for(let r=0;r<15;r++) for(let c=0;c<15;c++){
    const base=(r*15+c)*4;
    BB_I[base+0]=r;      BB_P[base+0]=c;
    BB_I[base+1]=c;      BB_P[base+1]=r;
    BB_I[base+2]=r-c+14; BB_P[base+2]=c;
    BB_I[base+3]=r+c;    BB_P[base+3]=r;
  }
})();
```

所有 `const {i, p:pos} = bbLineIdx(r, c, d)` 改為：

```javascript
const base = (r*15+c)*4+d;
const i = BB_I[base], pos = BB_P[base];
```

`bbSet` / `bbClear` 可展開：

```javascript
function bbSet(r,c,p){
  const bl=BL[p-1], base=(r*15+c)*4;
  bl[0][BB_I[base]]  |=(1<<BB_P[base]);
  bl[1][BB_I[base+1]]|=(1<<BB_P[base+1]);
  bl[2][BB_I[base+2]]|=(1<<BB_P[base+2]);
  bl[3][BB_I[base+3]]|=(1<<BB_P[base+3]);
}
// bbClear 同理，| 改 &=~
```

---

## 建議動手順序

1. **優化二**（早退）— 2 行，改完即驗
2. **優化一**（line buffer）— 先改 `countFoursInDir`，用既有測試局面對比結果，再改 `isLiveFourInDir`
3. **優化三**（bbLineIdx）— 選做，改完要確認 `isFive`/`isOverline`/`bbSet`/`bbClear` 行為一致

每個優化改完後，用至少一題已知答案的 VCF 局面驗證搜尋結果不變。
