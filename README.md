# cc-mods

Howard 的 Claude Code mods（plugin）。這個 repo 同時是一個 Claude Code marketplace（`.claude-plugin/marketplace.json`），裡面每個子資料夾是一個 mod。

| mod | 做什麼 |
|---|---|
| [`session-desk`](./session-desk) | Session 總管 pane：一眼看完這台機器上所有 Claude Code session 的狀態、跳到它的 iTerm2 分頁、對它傳 context；同一個 pane 列出 Notion Sprint Board 上自己的卡，可綁到 session、改狀態、在 Notion app 開、用卡開新 session |

## 安裝

在 Claude Code 的輸入框打：

```
/plugin install session-desk --marketplace howard60915/cc-mods
```

第一次會問「Add marketplace?」答 `y`，scope 選 user（預設）。裝完立刻生效，之後每個 session 都會自動載入。

shell 版：

```
claude plugin install session-desk --marketplace howard60915/cc-mods
```

這是私有 repo：裝的人要能在 GitHub 讀到它，而且機器上要有 github.com 的 git 憑證（`gh auth login`，再 `gh auth setup-git`）。

### 本機 clone 當 marketplace（自己改程式用）

```
git clone https://github.com/howard60915/cc-mods.git ~/Howork/cc-mods
claude plugin marketplace add ~/Howork/cc-mods
claude plugin install session-desk
```

marketplace 是資料夾、entry 是相對路徑，所以 Claude Code **直接讀那個資料夾**，不複製。改完檔案在任一 session 打 `/reload-plugins` 就生效。

## 更新

- 從 GitHub 裝的：`claude plugin update session-desk`（或重新 install）。
- 本機 clone 的：`git pull` 後 `/reload-plugins`。

## 每個 mod 的細節

各子資料夾的 README：安裝後要做的設定、操作方式、疑難排解、開發流程。
