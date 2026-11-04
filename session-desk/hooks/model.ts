// 純函式：解析 session 檔、ps、it2、Notion 的回傳。沒有 $，方便測。

import type { Card, DeskSession } from '../types'

export type RawSession = {
  pid: number
  sessionId: string
  cwd: string
  startedAt: number
  kind: string
  name: string
  status?: string
  statusUpdatedAt?: number
  updatedAt?: number
  waitingFor?: string
  nameSource: string
  /** 背景工作自己的 job id。 */
  jobId?: string
  /** 互動層把工作 park 出去後記的 job id。 */
  parkedJobId?: string
}

export function parseSessionJson(text: string): RawSession | undefined {
  try {
    const d = JSON.parse(text) as Record<string, unknown>
    if (typeof d.pid !== 'number' || typeof d.sessionId !== 'string') return undefined
    return {
      pid: d.pid,
      sessionId: d.sessionId,
      cwd: typeof d.cwd === 'string' ? d.cwd : '',
      startedAt: typeof d.startedAt === 'number' ? d.startedAt : 0,
      kind: typeof d.kind === 'string' ? d.kind : 'interactive',
      name: typeof d.name === 'string' && d.name ? d.name : d.sessionId.slice(0, 6),
      status: typeof d.status === 'string' ? d.status : undefined,
      statusUpdatedAt: typeof d.statusUpdatedAt === 'number' ? d.statusUpdatedAt : undefined,
      updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : undefined,
      waitingFor: typeof d.waitingFor === 'string' ? d.waitingFor : undefined,
      nameSource: typeof d.nameSource === 'string' ? d.nameSource : 'derived',
      jobId: typeof d.jobId === 'string' ? d.jobId : undefined,
      parkedJobId: typeof d.parkedJobId === 'string' ? d.parkedJobId : undefined,
    }
  } catch {
    return undefined
  }
}

/** `ps -o pid=,tty= -p …` 的輸出 → pid → tty（ttys008）。沒列出來的 pid 已經死了。 */
export function parsePs(stdout: string): Map<number, string> {
  const out = new Map<number, string>()
  for (const line of stdout.split('\n')) {
    const m = line.trim().match(/^(\d+)\s+(\S+)/)
    if (m) out.set(Number(m[1]), m[2] ?? '')
  }
  return out
}

export type It2Tab = { id: string; title: string }

/** 分頁標題去掉 Claude Code 加的狀態符號與「(claude)」：「◐ Session 總管 (claude)」→「Session 總管」。 */
export function cleanTabTitle(raw: string): string {
  return raw
    .replace(/\\\//g, '/')
    .replace(/^[\s\u2000-\u2BFF\u2600-\u27BF\u{1F300}-\u{1FAFF}]+/u, '')
    .replace(/\s*\((claude|-?zsh|bash|fish)\)\s*$/i, '')
    .trim()
}

/** `it2 session list` 一行一個 session，tab 分隔：id、名稱、標題、尺寸、tty（斜線被跳脫成 \/）。→ tty → { iTerm2 session id, 標題 }。 */
export function parseIt2List(stdout: string): Map<string, It2Tab> {
  const out = new Map<string, It2Tab>()
  for (const line of stdout.split('\n')) {
    const cols = line.split('\t')
    if (cols.length < 2) continue
    const id = cols[0]?.trim() ?? ''
    const tty = (cols[cols.length - 1] ?? '').replace(/\\\//g, '/').trim()
    const short = tty.split('/').pop() ?? ''
    if (/^[0-9A-F-]{36}$/i.test(id) && short.startsWith('tty')) out.set(short, { id, title: cleanTabTitle(cols[1] ?? '') })
  }
  return out
}

export function toDeskSession(
  raw: RawSession,
  tty: string | undefined,
  itermByTty: Map<string, It2Tab>,
  selfId: string,
): DeskSession {
  const s: DeskSession = {
    sessionId: raw.sessionId,
    pid: raw.pid,
    name: raw.name,
    nameSource: raw.nameSource,
    kind: raw.kind,
    cwd: raw.cwd,
    status: raw.status ?? 'unknown',
    statusAt: raw.statusUpdatedAt ?? raw.updatedAt ?? raw.startedAt,
    startedAt: raw.startedAt,
    isSelf: raw.sessionId === selfId,
  }
  if (raw.waitingFor) s.waitingFor = raw.waitingFor
  if (tty) {
    s.tty = tty
    const tab = itermByTty.get(tty)
    if (tab) {
      s.iterm = tab.id
      if (tab.title) s.tabTitle = tab.title
    }
  }
  return s
}

/**
 * park 出去的工作：互動層（parkedJobId）與它的背景行程（jobId）是同一件事，合成一列。
 * 名字、狀態用背景行程的（那才是在跑的）；分頁用互動層的（背景行程沒有自己的分頁）。
 */
export function mergeParked(list: DeskSession[], raws: Map<string, RawSession>): DeskSession[] {
  const bgByJob = new Map<string, DeskSession>()
  for (const s of list) {
    const raw = raws.get(s.sessionId)
    if (s.kind === 'bg' && raw?.jobId) bgByJob.set(raw.jobId, s)
  }
  const swallowed = new Set<string>()
  const out: DeskSession[] = []
  for (const s of list) {
    const raw = raws.get(s.sessionId)
    const bg = raw?.parkedJobId ? bgByJob.get(raw.parkedJobId) : undefined
    if (bg) {
      swallowed.add(s.sessionId)
      bg.parked = { sessionId: s.sessionId, name: s.name, status: s.status, statusAt: s.statusAt }
      if (s.tty) bg.tty = s.tty
      if (s.iterm) bg.iterm = s.iterm
      if (s.tabTitle) bg.tabTitle = s.tabTitle
      if (s.isSelf) bg.isSelf = true
    }
  }
  for (const s of list) if (!swallowed.has(s.sessionId)) out.push(s)
  return out
}

/** 畫面上用的名字：Desk 別名 > 使用者用 /rename 取的 > iTerm2 分頁標題（Claude 自動產生的 session title）> 系統派的。 */
export function preferredName(s: { name: string; nameSource: string; tabTitle?: string }): string {
  if (s.nameSource !== 'derived') return s.name
  return s.tabTitle || s.name
}

/** Notion MCP 回傳的 content[0].text 是 JSON 字串，裡面 results 是一列一個物件。 */
export function parseNotionRows(content: readonly { type: string; text?: string }[]): Record<string, unknown>[] {
  const text = content.find(c => c.type === 'text' && typeof c.text === 'string')?.text
  if (!text) return []
  try {
    const d = JSON.parse(text) as { results?: unknown }
    return Array.isArray(d.results) ? (d.results as Record<string, unknown>[]) : []
  } catch {
    return []
  }
}

/** app.notion.com/p/<32 hex> 或 notion.so/...-<32 hex> → 32 hex；對不出來回空字串。 */
export function notionId(url: string): string {
  const m = url.replace(/-/g, '').match(/([0-9a-f]{32})(?:\?|$)/i)
  return m ? (m[1] ?? '').toLowerCase() : ''
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''
}

function urlList(v: unknown): string[] {
  if (typeof v !== 'string' || !v.startsWith('[')) return []
  try {
    const arr = JSON.parse(v) as unknown
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** 標題欄（Items）回來時 Markdown 的 [ ] 被反斜線跳脫。 */
export function unescapeTitle(s: string): string {
  return s.replace(/\\([\[\]*_`~>#|])/g, '$1').trim()
}

export function toCard(row: Record<string, unknown>): Card | undefined {
  const url = str(row.url)
  if (!url) return undefined
  return {
    url,
    id: notionId(url),
    taskId: str(row['Task ID']),
    title: unescapeTitle(str(row.Items)) || '（無標題）',
    status: str(row.Status) || 'Not started',
    priority: str(row.Priority),
    type: str(row['類型']),
    sprintIds: urlList(row.Sprint).map(notionId).filter(Boolean),
    git: str(row.Git),
    lastEdited: str(row['Last edited time']),
    unassigned: urlList(row.Assign).length === 0,
    storyIds: urlList(row.Story).map(notionId).filter(Boolean),
  }
}

/** 幾分鐘前：45s → 「45s」、7 分 → 「7m」、3 小時 → 「3h」、2 天 → 「2d」。 */
export function age(fromMs: number, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - fromMs) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h`
  return `${Math.round(h / 24)}d`
}

/** 單引號包起來給 zsh -c 用。 */
export function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

/** ~/work/acme-shop 這種短寫。 */
export function shortPath(p: string, home: string): string {
  return home && p.startsWith(home) ? `~${p.slice(home.length)}` : p
}

/** 把字串裁到 n 格寬（中文算 2 格），超過加 …。 */
export function fit(s: string, n: number): string {
  let w = 0
  let out = ''
  for (const ch of s) {
    const cw = ch.charCodeAt(0) > 0x2e7f ? 2 : 1
    if (w + cw > n - 1) return out + '…'
    out += ch
    w += cw
  }
  return out
}

export const STATUSES = [
  'Not started',
  'Pending',
  'In Development',
  'PR Reviewing',
  'Wait to Beta',
  'Wait to Prod',
  'PM Retest',
  'Monitoring',
  'Done',
] as const

/** 狀態的短寫，排版用。 */
export function shortStatus(s: string): string {
  const map: Record<string, string> = {
    'Not started': 'todo',
    'Pending': 'pend',
    'Pending Assignment': 'p-asg',
    'In Design': 'dsgn',
    'In Progress': 'prog',
    'In Development': 'dev',
    'In Diversity Testing': 'test',
    'PR Reviewing': 'pr',
    'Wait to Beta': 'beta',
    'Wait to Prod': 'prod',
    'PM Retest': 'retst',
    'Monitoring': 'mon',
    'Done': 'done',
    'Archived': 'arch',
  }
  return map[s] ?? s.slice(0, 5)
}

/** P0🔥 - 4hr → P0；High → Hi；沒有 → 空。 */
export function shortPriority(p: string): string {
  const m = p.match(/P\d/)
  if (m) return m[0]
  if (/^high/i.test(p)) return 'Hi'
  if (/^med/i.test(p)) return 'Md'
  if (/^low/i.test(p)) return 'Lo'
  return p ? p.slice(0, 2) : ''
}

/** session 的 transcript 檔：~/.claude/projects/<cwd 的 / 與 . 換成 ->/<sessionId>.jsonl。 */
export function transcriptPath(home: string, cwd: string, sessionId: string): string {
  const slug = cwd.replace(/[\/.]/g, '-')
  return `${home}/.claude/projects/${slug}/${sessionId}.jsonl`
}

/** store 裡舊版綁定是純字串（卡片 url）；新版是物件。兩種都收。 */
export function normalizeBinding(v: unknown): { cardUrl: string; name: string; cwd: string; boundAt: number } | undefined {
  if (typeof v === 'string') return v ? { cardUrl: v, name: '', cwd: '', boundAt: 0 } : undefined
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (typeof o.cardUrl !== 'string' || !o.cardUrl) return undefined
    return {
      cardUrl: o.cardUrl,
      name: typeof o.name === 'string' ? o.name : '',
      cwd: typeof o.cwd === 'string' ? o.cwd : '',
      boundAt: typeof o.boundAt === 'number' ? o.boundAt : 0,
    }
  }
  return undefined
}

/** 顯示寬度：中日韓與全形算 2 格。 */
export function dw(s: string): number {
  let w = 0
  for (const ch of s) w += ch.charCodeAt(0) > 0x2e7f ? 2 : 1
  return w
}

/** 補空白到 n 格顯示寬度（超過就裁）。 */
export function padTo(s: string, n: number): string {
  const cut = fit(s, n + 1)
  return cut + ' '.repeat(Math.max(0, n - dw(cut)))
}

/**
 * 綁定的目錄不在了（worktree 刪掉）時可以退回的候選目錄，由近到遠：
 * 先把最後一段的 `-後綴` 逐段拿掉（acme-shop-2041-x → acme-shop-2041 → pluto），再往上層走。
 * 只產生候選，存不存在由呼叫端查。
 */
export function fallbackDirs(cwd: string): string[] {
  const out: string[] = []
  const parts = cwd.split('/').filter(Boolean)
  if (parts.length === 0) return out
  const parent = '/' + parts.slice(0, -1).join('/')
  let last = parts[parts.length - 1]!
  while (last.includes('-')) {
    last = last.slice(0, last.lastIndexOf('-'))
    if (last) out.push(parent === '/' ? `/${last}` : `${parent}/${last}`)
  }
  for (let i = parts.length - 1; i >= 1; i--) out.push('/' + parts.slice(0, i).join('/'))
  return out
}
