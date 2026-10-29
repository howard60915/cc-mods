# session-desk

Claude Code 的 Session 總管 pane：一眼看完這台機器上所有 Claude Code session 的狀態（busy／idle／waiting）、跳到它的 iTerm2 分頁、對它傳訊息；同一個 pane 下半列出 Notion Sprint Board 上指派給我、還沒結案的卡，可以綁到 session、改狀態、開瀏覽器、用卡開新 session。

## 安裝

從 GitHub（在 Claude Code 的輸入框）：

```
/plugin install session-desk --marketplace howard60915/cc-mods
```

或 shell：`claude plugin install session-desk --marketplace howard60915/cc-mods`。這是私有 repo，裝的人要能讀它、機器上要有 github.com 的 git 憑證（`gh auth login` 後 `gh auth setup-git`）。

本機開發用資料夾當 marketplace：

```
claude plugin marketplace add ~/Howork/cc-mods
claude plugin install session-desk
```

marketplace 是資料夾、entry 是相對路徑，所以 Claude Code 直接讀 `~/Howork/cc-mods/session-desk`，改完檔案在任一 session 打 `/reload-plugins` 就生效。

開發時也可以 `claude --plugin-dir ~/Howork/cc-mods/session-desk`，存檔即熱重載。

## 用法

- `/desk` 開 pane 並拿到焦點；`ctrl+x tab` 進出焦點、`Esc` 回輸入框、`ctrl+x x` 關 pane。
- 方向鍵選列、Enter（或點一下）：session → 跳到它的 iTerm2 分頁；已關閉的 session → 開新分頁 `claude --resume`；卡 → 選取。
- 操作列是情境式的：選到什麼才列什麼，`a` 切成全部。
  - Session：`s` 傳訊息、`p` 把滑鼠選取的文字送過去、`m` 命名（Desk 別名＋iTerm2 分頁名；本 session 下一句送出後 Claude 的名稱也跟上）
  - 卡片：`o` 在 Notion 桌面 app 開（`notion://`，app 不在就退回瀏覽器）、`t` 改 Status、`n` 用卡在新分頁起 claude
  - 綁定：`b` 綁定／改綁、`u` 解除（綁定存在 plugin store，跨 session 共用；session 關掉後仍留在「已關閉・有綁卡」）
  - 檢視：`c` 本 Sprint／全部、`v` 選 Sprint、`r` 重整

## 設定（`/plugin` → session-desk）

| 項目 | 說明 |
|---|---|
| 配色 | Claude Code（跟亮暗主題）、終端機（ANSI 色）、或 15 組內建色碼 |
| 啟動時自動開 pane | on／off |
| Notion view 連結 | 「指派給我、未結案」的 table view（網址帶 `?v=`）。換人用時建自己的 view 填這裡 |
| it2 路徑 | iTerm2 的 it2 CLI |

## 需要的東西

- iTerm2（跳分頁、開新分頁、改分頁名都靠 `it2`）。其他終端機只少這些功能，列表照常。
- Claude Code 的 Notion plugin 已連線。mod 從計時器發的 MCP 呼叫會被 auto mode 分類器擋，要在 `~/.claude/settings.json` 的 `permissions.allow` 放行兩個唯讀工具：`mcp__plugin_Notion_notion__notion-query-data-sources`、`mcp__plugin_Notion_notion__notion-fetch`。改 Status 用的 `notion-update-page` 沒放行時會被擋，提示列會說。
- Notion 非 Business 方案：rows／SQL 查詢有共用配額，所以這裡只用 view 模式與單頁 fetch。

## 資料來源

- session：`~/.claude/sessions/<pid>.json`（Claude Code 自己寫的，含 name／status／waitingFor／cwd／jobId／parkedJobId），`ps` 判活，`it2 session list` 對分頁。park 出去的背景工作與它的互動層合成一列。
- 名字優先序：Desk 別名 > `/rename` 取的 > iTerm2 分頁標題 > 系統派的。

## 開發

```
claude plugin validate .
npx -y -p typescript tsc -p .        # 型別由引擎鋪在 .claude-plugin/types/
claude plugin test .
```

純邏輯在 `hooks/model.ts`（有測試），畫面與 `$` 呼叫在 `hooks/register.tsx`，配色在 `hooks/themes.ts`，state 契約在 `types/index.d.ts`（改值的形狀時把該 atom 的 `shape` 版號加一）。
