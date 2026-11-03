# session-desk — Claude Code 的 Session 總管

一個開在 Claude Code 右側的 pane，回答三個問題：

1. **這台機器上哪些 Claude Code session 在跑、誰在等我？** busy／idle／waiting 一眼看完，Enter 直接跳到那個 iTerm2 分頁，或把一段 context 送過去。
2. **Notion Sprint Board 上哪些卡是我的？** 指派給我或 owner 有我、還沒結案的卡，依 Story 分組；可以在 Notion app 開、改 Status、用它開新 session。
3. **哪個 session 在做哪張卡？** 兩邊綁在一起，session 關掉後還記得，Enter 就 resume 回來。

![session-desk pane 總覽](docs/overview.png)

> 圖是用 `docs/make-demo.py` 從真實畫面產生的（it2 抓文字、渲染、Chrome 截圖），改版面後跑一次就能更新。

## 安裝

### 從 GitHub（推薦）

在 Claude Code 的輸入框：

```
/plugin install session-desk --marketplace howard60915/cc-mods
```

第一次會問「Add marketplace?」答 `y`，scope 選 user。接著會列 4 個設定項（配色、自動開 pane、Notion view、it2 路徑），全部留預設即可，之後都能在 `/plugin` 裡改。裝完當下就載入，不用重開。

shell 版：`claude plugin install session-desk --marketplace howard60915/cc-mods`。

私有 repo：裝的人要能讀它，機器上要有 github.com 的 git 憑證（`gh auth login` 後 `gh auth setup-git`）。

### 本機資料夾（自己改程式用）

```
git clone https://github.com/howard60915/cc-mods.git ~/Howork/cc-mods
claude plugin marketplace add ~/Howork/cc-mods
claude plugin install session-desk
```

Claude Code 直接讀 `~/Howork/cc-mods/session-desk`，改完檔案在任一 session 打 `/reload-plugins` 就生效。只想試一個 session：`claude --plugin-dir ~/Howork/cc-mods/session-desk`，存檔即熱重載。

## 裝完要做的三件事

### 1. 放行兩個 Notion 唯讀工具

mod 從計時器發的 Notion MCP 呼叫會被 Claude Code 的 auto mode 分類器擋下（因為沒有對應的使用者請求可判定）。在 `~/.claude/settings.json` 的 `permissions.allow` 加：

```json
"mcp__plugin_Notion_notion__notion-query-data-sources",
"mcp__plugin_Notion_notion__notion-fetch"
```

或在 Claude Code 打 `/permissions` 用介面加。兩個都是唯讀：前者查 view 裡的卡，後者讀 Sprint／Story 頁的標題。改 Status 用的 `notion-update-page` 是寫入，刻意不放行；按 `t` 被擋時提示列會說，要的話再自己加。

前提：Claude Code 的 Notion plugin 已連線（`/mcp` 看得到 `plugin:Notion:notion`）。

### 2. 在 Notion 建一個自己的 view

卡片是從一個 **table view** 查的（view 模式不吃 Notion 非 Business 方案的查詢配額，rows／SQL 模式會）。在你自己的 Notion 頁面放一個 New Sprint Board 的連結資料庫，加一個 table view，篩選：

- `Assign` 包含我 **或** `owner` 包含我
- `Status` 不是 Done
- `Status` 不是 Archived

複製該 view 的網址（帶 `?v=`），填進 `/plugin` → session-desk → 「Notion view 連結」。留空會用 Howard 的 view，別人用會查到 Howard 的卡。

### 3. iTerm2

跳分頁、開新分頁、改分頁名都靠 iTerm2 的 `it2` CLI（`/Applications/iTerm.app/Contents/Resources/utilities/it2`，路徑可在設定改）。用別的終端機時列表照常，只是這幾個動作不能用，對不到分頁的 session 會標 `⌀`。

## 怎麼用

### 開 pane、進出焦點

- 終端寬度 144 欄以上時每個 session 啟動會自動開在右側（可在設定關掉）；或打 `/desk`。
- 鍵盤要進 pane：`ctrl+x tab`。想要單鍵可以在 `~/.claude/keybindings.json` 加 `{"context":"Chat","bindings":{"ctrl+shift+d":"abovePrompt:focus"}}`。
- `Esc` 回輸入框、`ctrl+x x` 關 pane、`ctrl+x ←／→` 調寬度。滑鼠點列也可以。

### 看狀態

![Sessions 與已關閉區](docs/sessions.png)

上圖：兩個 busy、四個 idle；選到的那列（▸）多一行顯示目錄；`⧉ #2041` 表示它綁著那張卡；`⇢bg` 是 park 出去的背景工作；`⌀` 對不到 iTerm2 分頁。下方「已關閉・有綁卡」是關掉但還綁著卡的 session，Enter 就 resume。

| 符號 | 意思 |
|---|---|
| `●` busy | 正在跑 |
| `◐` waiting | 在等你（後面接在等什麼，例如 `dialog open`） |
| `○` idle | 閒著，後面是閒了多久 |
| `⇢bg` | 這是 park 出去的背景工作，已和它的互動層合成一列；選到會多一行寫互動層在等 |
| `⌀` | 對不到 iTerm2 分頁，Enter 跳不過去 |
| `⧉ #9983` | 這個 session 綁著那張卡 |
| `⟲ … closed` | 已關閉但還綁著卡的 session，Enter 開新分頁 `claude --resume` |

waiting 的排最上面，再 busy、再 idle。名字的優先序：Desk 別名 > `/rename` 取的 > iTerm2 分頁標題（Claude 自動產生的 session title）> 系統派的 `pluto-ff`。

### 跳過去、傳 context

- 方向鍵選到 session 按 **Enter**：切到它的 iTerm2 分頁。
- **`s` 傳訊息**：底下出現輸入框，Enter 送出，對方把它當一則 peer 訊息排進對話，回覆會回來。
- **`p` 貼選取**：先用滑鼠在對話區選一段文字（錯誤、log、結論），再選到目標 session 按 `p`，整段送過去並註明來源。選取只在按鍵當下有效，中間別按別的鍵。
- **`m` 命名**：取別名，pane 顯示、iTerm2 分頁名都跟著改；命名的是這個 session 本身時，下一句 prompt 送出後 Claude 自己的 session 名稱也會改。留空送出清掉別名。

### 卡片

![notions 區：依 Story 分組的卡片](docs/notions.png)

上圖：卡片依 Story 分組；每列是卡號、狀態短寫、優先度、標題；`⚑待指派` 是 Assign 空著、只有 owner 列到你的卡；卡列下的 `⌁ …` 是綁著它的 session（「（已關閉）」表示那個 session 已經關了）。

- notions 區依 **Story** 分組，組名是 Story 頁標題；沒 Story 的在最後一組。第一次載入組名可能短暫是 `Story xxxxxx`，標題抓回來就換掉。
- 列：`卡號 狀態短寫 優先度 標題`。狀態短寫：`todo` Not started、`pend` Pending、`p-asg` Pending Assignment、`dev` In Development、`pr` PR Reviewing、`beta` Wait to Beta、`prod` Wait to Prod、`retst` PM Retest。`⚑待指派` 表示 Assign 是空的、只有 owner 列到你。
- 選到卡（Enter 或點）後：**`o`** 在 Notion 桌面 app 開（`notion://`，app 不在就退回瀏覽器）、**`t`** 改 Status（跳選單，選完寫回 Notion）、**`n`** 在 iTerm2 開新分頁、同目錄起 `claude`，開場 prompt 就是這張卡。
- 範圍：**`c`** 在「本 Sprint」與「全部」間切換；**`v`** 跳選單挑特定 Sprint（名單是你卡上出現過的 Sprint）。**`r`** 強制重抓卡片與 Sprint／Story 標題。

### 綁定：哪個 session 在做哪張卡

- 選一個活著的 session（Enter）和一張卡（Enter），按 **`b`**。session 列尾出現 `⧉ #卡號`，卡列下出現 `⌁ session 名`。已綁別張時 `b` 變成「改綁」。
- **`u`** 解除。
- 綁定存在 plugin store，所有 session 共用。session 關掉後移到「已關閉・有綁卡」，選到按 Enter 會在 iTerm2 開新分頁、回原目錄 `claude --resume <id>`（transcript 不在就只提示）。綁的卡 Done／Archived／改指派後自動清掉。

### 操作列

![情境式操作列](docs/actions.png)

上圖：選到一個 session 和一張卡時的操作列。標題線寫目前選了什麼；左組是 session 的操作、中間是卡片的、`u` 是因為這個 session 已綁著卡才出現；最右組永遠都在。

情境式：選到 session 才列 session 的鍵，選到卡才列卡的，兩邊都選到才有 `b`。沒顯示的鍵按了沒反應。按 **`a`** 切成四行的完整清單（Session／卡片／綁定／檢視），再按一次回精簡。

## 設定（`/plugin` → session-desk）

| 項目 | 說明 | 預設 |
|---|---|---|
| 配色 | `Claude Code`（跟 Claude 亮暗主題）、`終端機`（ANSI 色，跟 iTerm2 profile）、或 Catppuccin／Tokyo Night／Nord／Gruvbox／Dracula／Rosé Pine／Kanagawa… 15 組色碼（有底色的會塗整個 pane） | Claude Code |
| 啟動時自動開 pane | `on`／`off`；off 時只有 `/desk` 才開 | on |
| Notion view 連結 | 「指派給我或 owner 有我、未結案」的 table view 網址（帶 `?v=`） | Howard 的 view |
| it2 路徑 | iTerm2 的 it2 CLI | `/Applications/iTerm.app/…/it2` |

設定改完若沒生效，`/reload-plugins` 或重開 session。

## 疑難排解

| 現象 | 原因與處理 |
|---|---|
| notions 區紅字 `… refused: The server-side auto mode classifier gave no verdict` 或對話區出現 `notion-fetch denied by auto mode` | 步驟 1 的放行規則沒加（或只加了一個）。加完 `r`。 |
| 紅字 `Your workspace has used up its Query Data Source allowance` | Notion 非 Business 方案的 rows／SQL 配額被吃光（約 60 分鐘重置）。本 mod 只用 view 模式，正常不會碰到；若你把 view 連結填成別的東西或同時有別的工具在查，等重置。 |
| 紅字 `ECONNRESET`／逾時 | Notion MCP 連線抖動。mod 會自動重試三次、30 秒後再補查，期間顯示上一次的清單（後面會註明）。 |
| 卡片區標題一直是「全部」、`c` 切不到本 Sprint | Sprint 頁讀不到（通常是 `notion-fetch` 沒放行）。放行後 `r`。 |
| 組名停在 `Story xxxxxx` | Story 頁讀取失敗，30 分鐘後自動重試，或 `r`。 |
| pane 開不出來 | 終端寬度不到 144 欄時不會自動開；打 `/desk` 可在 110 欄以上強制開。 |
| session 列有 `⌀`、Enter 跳不過去 | 不是 iTerm2，或 `it2` 路徑不對（設定可改）。 |
| 按 `t` 改狀態被擋 | `notion-update-page` 是寫入工具，預設沒放行；要用就加進 `permissions.allow`。 |
| `s`／`p` 顯示「送不出去」 | 對方 session 已關，或這就是目前的 session。 |
| 改完程式重載後畫面掛掉、提示 `ui.render hook skipped` | 多半是 plugin store 裡的舊快取形狀不合；程式裡快取鍵帶版號，改卡片形狀時把 `cardsCache-vN` 的 N 加一。 |

## 資料從哪來

- **session**：`~/.claude/sessions/<pid>.json`（Claude Code 自己寫的：name、status、waitingFor、cwd、jobId、parkedJobId），每 5 秒讀一次；`ps` 判活；`it2 session list` 把 tty 對到 iTerm2 分頁。
- **卡片**：Notion plugin MCP 的 `notion-query-data-sources`（view 模式），結果存 plugin store 4 分鐘、所有 session 共用；每 5 分鐘重查。Sprint 頁 24 小時、Story 頁 24 小時各讀一次（`notion-fetch`）。
- **綁定、別名**：plugin store（`$.store`），跨 session 共用，不隨 session 結束消失。

## 開發

```
claude plugin validate .
npx -y -p typescript tsc -p .        # 型別由引擎鋪在 .claude-plugin/types/，第一次載入後才有
claude plugin test .
```

| 檔案 | 內容 |
|---|---|
| `hooks/register.tsx` | 畫面與所有 `$` 呼叫（session 刷新、Notion 查詢、動作、render） |
| `hooks/model.ts` | 純函式：解析 sessions json／ps／it2、Notion row → Card、名字優先序、park 合併、寬度工具（有測試） |
| `hooks/themes.ts` | 配色表 |
| `types/index.d.ts` | `$.state` 的型別契約；改值的形狀時把該 atom 的 `shape` 版號加一，舊值才會被丟掉 |
| `hooks/model.test.ts` | `claude plugin test` 跑的測試 |

改完 `/reload-plugins` 看效果，commit 後 `git push`。

### 重做 README 的 demo 圖

```
cd session-desk/docs
python3 make-demo.py                 # 抓「目前 active 的 iTerm2 分頁」的 pane 畫面
python3 make-demo.py --from pane-sample.txt   # 不抓畫面，用上次存的文字重畫
```

流程：`it2 session capture` 抓終端文字 → 依顯示欄寬切出 pane → `render.py` 依內容上色畫成 SVG → Chrome headless 以 2x 截成 PNG。先把 pane 開著、選一列 session 和一張卡再跑，圖才有選取與操作列。不用安裝任何套件（只靠 iTerm2 與 Chrome）。
