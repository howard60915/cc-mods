// session-desk 的型別契約：$.state 裡的值。

/** 一個本機 Claude Code session（~/.claude/sessions/<pid>.json 加上 ps／it2 對出來的東西）。 */
export type DeskSession = {
  sessionId: string
  pid: number
  name: string
  /** interactive／bg。 */
  kind: string
  cwd: string
  /** busy／idle／waiting；檔案沒寫時是 unknown。 */
  status: string
  /** waiting 時在等什麼（dialog open…）。 */
  waitingFor?: string
  /** 狀態最後一次改變的時間（ms）。 */
  statusAt: number
  startedAt: number
  /** 這個 pane 所在的 session。 */
  isSelf: boolean
  /** 對應到的 iTerm2 session id；對不到就沒有。 */
  iterm?: string
  tty?: string
  /** 名字是誰取的：user（/rename）、auto、derived（系統派的 pluto-ff 這種）。 */
  nameSource: string
  /** iTerm2 分頁標題（去掉狀態符號與「(claude)」）；對不到分頁就沒有。 */
  tabTitle?: string
  /** 背景工作（kind bg）被 park 出去時，留在原分頁等的那個互動層。合併顯示成一列時放這裡。 */
  parked?: { sessionId: string; name: string; status: string; statusAt: number }
}

/** Sprint Board 上指派給我的一張卡。 */
export type Card = {
  url: string
  /** 32 位 hex 的 page id。 */
  id: string
  taskId: string
  title: string
  status: string
  priority: string
  type: string
  /** 卡掛在哪些 Sprint（page id）。 */
  sprintIds: string[]
  git: string
  lastEdited: string
  /** Assign 是空的（只有 owner 列到我）：待指派。 */
  unassigned: boolean
  /** 卡掛在哪個 Story（page id）；畫面依這個分組。 */
  storyIds: string[]
}

/** 卡上出現過的 Story：page id → 標題（讀不到時是空字串）。 */
export type Stories = Record<string, string>

export type CardsMeta = {
  /** 最後一次成功載入（ms）；0 = 還沒載過。 */
  loadedAt: number
  loading: boolean
  error?: string
  /** 目前 Sprint 的名稱與 page id；查不到就沒有。 */
  sprint?: { id: string; name: string }
  /** 只列目前 Sprint 的卡。 */
  onlyCurrent: boolean
  /** 指定只看某個 Sprint（page id）；有設時優先於 onlyCurrent。 */
  viewSprint?: string
}

/** 卡上出現過的 Sprint：page id → 名稱與狀態（Current／Next／Past…；讀不到時是空字串）。 */
export type Sprints = Record<string, { name: string; status: string }>

/** 一個 session 綁了哪張卡。session 關掉後還留著，才能顯示與 resume。 */
export type Binding = {
  cardUrl: string
  /** 綁定當時的顯示名稱（別名優先）。 */
  name: string
  /** 綁定當時的目錄，resume 用。 */
  cwd: string
  boundAt: number
}

/** session id → 綁定。存在 $.store，跨 session 共用；這裡是給畫面讀的鏡像。 */
export type Bindings = Record<string, Binding>

/** session id → 使用者取的別名。存在 $.store。 */
export type Aliases = Record<string, string>

export type Selection = {
  sessionId?: string
  cardUrl?: string
  /** 改狀態的下拉選單開著。 */
  picking: boolean
  /** 命名輸入框開著。 */
  naming: boolean
  /** 傳訊息輸入框開著。 */
  sending: boolean
  /** 操作列顯示全部，而不是只顯示當下用得到的。 */
  showAll: boolean
  /** 選 Sprint 的下拉選單開著。 */
  pickingSprint: boolean
  /** 最下面一行的提示。 */
  note: string
  noteAt: number
  /** 傳訊息對話框開啟時預先帶入的文字（貼選取用）。 */
  draft: string
  /** 每開一次對話框加一，讓輸入框重新掛載吃到新的 draft。 */
  sendSeq: number
}

declare module 'claude-code' {
  interface PluginState {
    'session-desk': {
      sessions: Shaped<DeskSession[]>
      cards: Shaped<Card[]>
      meta: CardsMeta
      sprints: Sprints
      stories: Stories
      bindings: Shaped<Bindings>
      aliases: Aliases
      sel: Shaped<Selection>
      tick: number
    }
  }
}
