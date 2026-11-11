// session-desk：Session 總管。
// 上半：本機所有 Claude Code session（~/.claude/sessions/*.json 的 busy／idle／waiting），
//       Enter 跳到它的 iTerm2 分頁（it2 session focus）；關掉但還綁著卡的 session 列在下面，Enter 開新分頁 resume。
// 下半：Sprint Board 上指派給我、還沒結案的卡（Notion plugin 的 MCP，view 模式不吃配額）。
// 兩邊可以綁在一起（存 $.store，跨 session 共用），卡片可以改 Status、開瀏覽器、開新 session；session 可以取別名。

import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, Register } from 'claude-code'

import type { Aliases, Binding, Bindings, Card, CardsMeta, DeskSession, Selection, Sprints, Stories } from '../types'
import type { It2Tab } from './model'
import {
  STATUSES,
  age,
  fallbackDirs,
  fit,
  mergeParked,
  normalizeBinding,
  notionId,
  parseIt2List,
  parsePs,
  parseSessionJson,
  preferredName,
  shellQuote,
  shortPath,
  shortPriority,
  shortStatus,
  dw,
  padTo,
  toCard,
  toDeskSession,
  transcriptPath,
} from './model'
import { palette } from './themes'
import type { Palette } from './themes'

const PANE = 'session-desk'
const TITLE = 'Desk'
const NOTION = 'plugin:Notion:notion'
/** 預設值；實際值從 plugin.json 的 userConfig 讀（register 裡的 options）。 */
const DEFAULT_VIEW_URL = 'https://www.notion.so/40097d91ff3781ed859befc87e22173e?v=40797d91ff378161baf7000cfa5b04ec'
const DEFAULT_IT2 = '/Applications/iTerm.app/Contents/Resources/utilities/it2'
/** Sprints 資料庫上「Last／Current／Next」三筆的 table view：view 模式一次查三筆，不用 fetch 整個 Sprint 頁。 */
const DEFAULT_SPRINTS_VIEW = 'view://40d97d91-ff37-8116-b518-000c84a7906d'
const SESSIONS_MS = 5_000
const CARDS_MS = 5 * 60_000
const CARDS_CACHE_MS = 4 * 60_000
const RETRY_AFTER_FAIL_MS = 30_000
/** Sprint 的 Current 狀態兩週才換一次，而 Sprint 頁掛著幾百張 Tasks（上百 KB），一天讀一次就夠；r 強制重整不受此限。 */
/** Sprint 是雙週一輪，一週查一次就夠；要立刻換用 r（隔 1 小時）。 */
const SPRINT_CACHE_MS = 7 * 24 * 3_600_000
/** r 強制重整時，Sprint 這份至少隔這麼久才再查：view 回傳 56 KB、每個 session 按 r 都會各查一次。 */
const SPRINT_FORCE_MIN_MS = 60 * 60_000
const SPRINT_FAIL_CACHE_MS = 30 * 60_000
const STORE_BINDINGS = 'bindings'
const STORE_ALIASES = 'aliases'
/** 快取的卡片形狀改了就把版號加一，舊版寫的快取才不會被讀進來。 */
const STORE_CARDS_CACHE = 'cardsCache-v3'
const STORE_SPRINTS = 'sprints'
const STORE_STORIES = 'stories'
/** Story (for Scrum) 資料庫：用 search 限定這個資料來源，一次拿回所有 Story 標題（回傳只有標題，很小）。 */
const STORIES_DS = 'collection://1eb97d91-ff37-817e-bbea-000bf32af58a'
// 不用 SQL／rows 模式：那是整個 Notion 工作區共用的額度（非 Business 方案），mod 不該吃團隊的；view 模式沒有方案額度。
/** Claude Code 對 MCP 回傳有大小上限，超過時交給 mod 的是這段錯誤文字而不是內容。 */
const OVERSIZED = /exceeds maximum allowed tokens/i
const STORY_CACHE_MS = 24 * 3_600_000

const sessions = atom({ plugin: 'session-desk', key: 'sessions' } as const, [] as DeskSession[], { shape: 'sessions-3' })
const cards = atom({ plugin: 'session-desk', key: 'cards' } as const, [] as Card[], { shape: 'cards-3' })
const meta = atom({ plugin: 'session-desk', key: 'meta' } as const, {
  loadedAt: 0,
  loading: false,
  onlyCurrent: true,
} as CardsMeta)
const sprints = atom({ plugin: 'session-desk', key: 'sprints' } as const, {} as Sprints)
const stories = atom({ plugin: 'session-desk', key: 'stories' } as const, {} as Stories)
const bindings = atom({ plugin: 'session-desk', key: 'bindings' } as const, {} as Bindings, { shape: 'bindings-2' })
const aliases = atom({ plugin: 'session-desk', key: 'aliases' } as const, {} as Aliases)
const sel = atom(
  { plugin: 'session-desk', key: 'sel' } as const,
  { picking: false, naming: false, sending: false, showAll: false, pickingSprint: false, note: '', noteAt: 0, draft: '', sendSeq: 0, groupToggles: {} } as Selection,
  { shape: 'sel-7' },
)
const tick = atom({ plugin: 'session-desk', key: 'tick' } as const, 0)

// ------------------------------------------------------------------ 這個 session 的工作狀態（hot reload 會清掉）
let home = ''
let selfId = ''
let cardsTimer: { cancel: () => void } | undefined
let retryTimer: { cancel: () => void } | undefined
/** 本 session 剛被取的別名：下一個 prompt 送出時經 classic hook 回給引擎當 sessionTitle。 */
let pendingTitle: string | undefined
/** 上次已交給引擎的別名；別的 session 幫這個 session 取的別名也要在這裡接手，改過才再交一次。 */
let appliedAlias: string | undefined
/** 綁定記的目錄還在不在（worktree 可能已經 remove），每輪 refreshSessions 查一次。 */
const dirAlive = new Map<string, boolean>()
let pal: Palette = palette('Claude Code')
let autoOpen = true
/** Notion 上「指派給我、未結案」的 view（view 模式查詢不吃方案配額）。 */
let VIEW_URL = DEFAULT_VIEW_URL
/** iTerm2 的 it2 CLI。 */
let IT2 = DEFAULT_IT2
/** Sprints 的 view（Last／Current／Next）。 */
let SPRINTS_VIEW = DEFAULT_SPRINTS_VIEW

async function note($: Engine, text: string): Promise<void> {
  const at = await $.clock.now()
  await update($, sel, s => ({ ...s, note: text, noteAt: at }))
}

// ------------------------------------------------------------------ store：綁定與別名

async function loadBindings($: Engine): Promise<Bindings> {
  const stored = (await $.store.get(STORE_BINDINGS)) as Record<string, unknown> | undefined
  const out: Bindings = {}
  for (const [k, v] of Object.entries(stored ?? {})) {
    const b = normalizeBinding(v)
    if (b) out[k] = b
  }
  return out
}

async function saveBindings($: Engine, fn: (b: Bindings) => Bindings): Promise<void> {
  const next = fn(await loadBindings($))
  await $.store.set(STORE_BINDINGS, next)
  await update($, bindings, () => next)
}

async function loadAliases($: Engine): Promise<Aliases> {
  const stored = (await $.store.get(STORE_ALIASES)) as Record<string, unknown> | undefined
  const out: Aliases = {}
  for (const [k, v] of Object.entries(stored ?? {})) if (typeof v === 'string' && v) out[k] = v
  return out
}

function displayName(s: { sessionId: string; name: string; nameSource: string; tabTitle?: string }, a: Aliases): string {
  return a[s.sessionId] ?? preferredName(s)
}

// ------------------------------------------------------------------ sessions

async function refreshSessions($: Engine): Promise<void> {
  const dir = `${home}/.claude/sessions`
  let names: string[] = []
  try {
    names = (await $.fs.list(dir)).filter(f => f.kind === 'file' && f.name.endsWith('.json')).map(f => f.name)
  } catch {
    await update($, sessions, () => [])
    return
  }
  const raws = (
    await Promise.all(
      names.map(async n => {
        try {
          return parseSessionJson(await $.fs.read(`${dir}/${n}`))
        } catch {
          return undefined
        }
      }),
    )
  ).filter((r): r is NonNullable<typeof r> => r !== undefined)

  let list: DeskSession[] = []
  if (raws.length > 0) {
    // 活著的 pid 才算；ps 一次問完。
    let ttyByPid = new Map<number, string>()
    try {
      const ps = await $.process.run(['ps', '-o', 'pid=,tty=', '-p', raws.map(r => String(r.pid)).join(',')], {
        timeoutMs: 3000,
      })
      ttyByPid = parsePs(ps.stdout)
    } catch {
      for (const r of raws) ttyByPid.set(r.pid, '')
    }

    let itermByTty = new Map<string, It2Tab>()
    try {
      const it2 = await $.process.run([IT2, 'session', 'list'], { timeoutMs: 4000 })
      if (it2.exitCode === 0) itermByTty = parseIt2List(it2.stdout)
    } catch {
      // iTerm2 沒開或 it2 不在：只是跳不過去
    }

    const alive = raws.filter(r => ttyByPid.has(r.pid))
    list = mergeParked(
      alive.map(r => toDeskSession(r, ttyByPid.get(r.pid) || undefined, itermByTty, selfId)),
      new Map(alive.map(r => [r.sessionId, r] as const)),
    ).sort((a, b) => rank(a) - rank(b) || b.statusAt - a.statusAt)
  }
  await update($, sessions, () => list)

  // 綁定與別名存在 store，別的 session 也會改，每輪重讀。
  const a = await loadAliases($)
  await update($, aliases, () => a)
  // 別名存在共用 store：不管是哪個 session 幫我取的，下一句 prompt 把它交給引擎當 session 名稱。
  const mine = a[selfId]
  if (mine && mine !== appliedAlias) {
    const me = list.find(x => x.isSelf)
    if (!me || me.name !== mine) pendingTitle = mine
    appliedAlias = mine
  }
  let b = await loadBindings($)

  // 活著的 session 搬了目錄或改了名，綁定跟著走（目錄要真的存在才信，registry 有時還記著刪掉的 worktree）。
  const drift: Bindings = {}
  for (const live of list) {
    const bound = b[live.sessionId]
    if (!bound) continue
    const name = displayName(live, a)
    const cwdOk = live.cwd && live.cwd !== bound.cwd && (await $.fs.exists(live.cwd))
    if (cwdOk || name !== bound.name) drift[live.sessionId] = { ...bound, name, cwd: cwdOk ? live.cwd : bound.cwd }
  }
  if (Object.keys(drift).length > 0) {
    await saveBindings($, cur => ({ ...cur, ...drift }))
    b = await loadBindings($)
  }
  await update($, bindings, () => b)

  // 綁定的目錄還在不在，畫面標「目錄已刪」、resume 時退回主 repo。
  dirAlive.clear()
  for (const cwd of new Set(Object.values(b).map(x => x.cwd).filter(Boolean))) {
    try {
      dirAlive.set(cwd, await $.fs.exists(cwd))
    } catch {
      dirAlive.set(cwd, true)
    }
  }
  await update($, tick, n => n + 1)
}

/** 綁定目錄不在時，往 fallbackDirs 找第一個存在的目錄。 */
async function resumeDir($: Engine, cwd: string): Promise<{ dir: string; fellBack: boolean } | undefined> {
  if (await $.fs.exists(cwd)) return { dir: cwd, fellBack: false }
  for (const d of fallbackDirs(cwd)) {
    if (await $.fs.exists(d)) return { dir: d, fellBack: true }
  }
  return undefined
}

function rank(s: DeskSession): number {
  if (s.status === 'waiting') return 0
  if (s.status === 'busy') return 1
  if (s.status === 'idle') return 2
  return 3
}

// ------------------------------------------------------------------ Notion 卡

type CardsCache = { at: number; cards: Card[] }
type SprintInfo = { status: string; name: string; at: number }

async function refreshCards($: Engine, force = false): Promise<void> {
  // 別的 session 剛查過就直接用，所有 session 共用一份快取。
  if (!force) {
    const cached = (await $.store.get(STORE_CARDS_CACHE)) as CardsCache | undefined
    const now = await $.clock.now()
    const isFresh = (c: unknown): c is Card => Boolean(c) && typeof (c as Card).url === 'string' && Array.isArray((c as Card).storyIds) && Array.isArray((c as Card).sprintIds)
    if (cached && Array.isArray(cached.cards) && cached.cards.every(isFresh) && now - cached.at < CARDS_CACHE_MS) {
      await update($, cards, () => cached.cards)
      await update($, meta, m => ({ ...m, loadedAt: cached.at, loading: false }))
      await resolveSprint($, cached.cards)
      await resolveStories($, cached.cards)
      await pruneBindings($, cached.cards)
      return
    }
  }
  await update($, meta, m => ({ ...m, loading: true }))
  try {
    const list: Card[] = []
    let cursor: string | undefined
    // 每張卡約 2.5 KB（看板欄位很多），一頁 10 張才不會撞到 MCP 回傳上限；撞到也有 resultText 讀檔救回。
    for (let page = 0; page < 20; page += 1) {
      const res = await notion($, 'notion-query-data-sources', {
        data: { mode: 'view', view_url: VIEW_URL, page_size: 10, ...(cursor ? { start_cursor: cursor } : {}) },
      })
      if (res.isError) throw new Error(firstText(res.content) || 'Notion 查詢失敗')
      const text = await resultText($, res)
      if (OVERSIZED.test(text)) throw new Error('Notion 回傳太大，引擎沒給內容，也讀不到它存的檔案')
      const parsed = JSON.parse(text) as { results?: unknown; has_more?: boolean; next_cursor?: string }
      for (const row of Array.isArray(parsed.results) ? (parsed.results as Record<string, unknown>[]) : []) {
        const card = toCard(row)
        if (card) list.push(card)
      }
      if (!parsed.has_more || !parsed.next_cursor) break
      cursor = parsed.next_cursor
    }
    list.sort((a, b) => cardRank(a) - cardRank(b) || Number(b.taskId) - Number(a.taskId))

    const at = await $.clock.now()
    await $.store.set(STORE_CARDS_CACHE, { at, cards: list } satisfies CardsCache)
    await update($, cards, () => list)
    await update($, meta, m => {
      const next: CardsMeta = { ...m, loadedAt: at, loading: false }
      delete next.error
      return next
    })
    if (retryTimer) {
      retryTimer.cancel()
      retryTimer = undefined
    }
    await resolveSprint($, list, force)
    await resolveStories($, list, force)
    await pruneBindings($, list)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    dumpDebug($, { thrown: msg, at: new Date().toISOString() })
    const hadCards = (await read($, cards)).length > 0
    await update($, meta, m => ({ ...m, loading: false, error: fit(`${msg}${hadCards ? '（顯示的是上一次的清單）' : ''}`, 160) }))
    if (!retryTimer) {
      retryTimer = $.clock.after(RETRY_AFTER_FAIL_MS, () => {
        retryTimer = undefined
        void refreshCards($, true)
      })
    }
  }
}

/** 綁的卡已經不在清單上（Done／Archived／改指派）就把綁定清掉；活著或關掉的 session 都一樣。 */
async function pruneBindings($: Engine, list: Card[]): Promise<void> {
  const urls = new Set(list.map(c => c.url))
  const b = await loadBindings($)
  const stale = Object.entries(b).filter(([, v]) => !urls.has(v.cardUrl))
  if (stale.length === 0) return
  await saveBindings($, cur => {
    const next = { ...cur }
    for (const [k] of stale) delete next[k]
    return next
  })
}

/**
 * Sprint 的名稱與狀態：查 Sprints 的「Last／Current／Next」view（view 模式不吃配額，一次三筆），
 * 存 store 7 天，所有 session 共用；r 強制重整也要距上次超過 1 小時才重查。不再 fetch 任何 Sprint 頁。
 * 卡片掛的 Sprint 不在這三筆裡（更早的 Sprint）時只顯示 id，不另外去讀。
 */
async function resolveSprint($: Engine, list: Card[], force = false): Promise<void> {
  const now = await $.clock.now()
  let known = ((await $.store.get(STORE_SPRINTS)) as Record<string, SprintInfo> | undefined) ?? {}
  const latest = Math.max(0, ...Object.values(known).map(v => v.at ?? 0))
  const stale = now - latest >= (force ? SPRINT_FORCE_MIN_MS : SPRINT_CACHE_MS)
  if (stale || Object.keys(known).length === 0) {
    try {
      const res = await notion($, 'notion-query-data-sources', { data: { mode: 'view', view_url: SPRINTS_VIEW, page_size: 10 } })
      const text = await resultText($, res)
      if (!res.isError && !OVERSIZED.test(text)) {
        const parsed = JSON.parse(text) as { results?: Record<string, unknown>[] }
        const fresh: Record<string, SprintInfo> = {}
        for (const row of parsed.results ?? []) {
          const id = typeof row.url === 'string' ? notionId(row.url) : ''
          if (!id) continue
          fresh[id] = {
            name: typeof row['Sprint name'] === 'string' ? row['Sprint name'] : 'Sprint',
            status: typeof row['Sprint status'] === 'string' ? row['Sprint status'] : '',
            at: now,
          }
        }
        if (Object.keys(fresh).length > 0) {
          known = fresh
          await $.store.set(STORE_SPRINTS, known)
        }
      } else {
        dumpDebug($, { sprintsView: res.isError ? text.slice(0, 300) : 'oversized' })
      }
    } catch (err) {
      dumpDebug($, { sprintsView: err instanceof Error ? err.message : String(err) })
    }
  }
  const ids = new Set([...list.flatMap(c => c.sprintIds), ...Object.keys(known)])
  const mirror: Sprints = {}
  for (const id of ids) mirror[id] = { name: known[id]?.name ?? '', status: known[id]?.status ?? '' }
  await update($, sprints, () => mirror)
  const current = Object.entries(known).find(([, info]) => info.status === 'Current')
  await update($, meta, m => {
    const next: CardsMeta = { ...m }
    if (current) next.sprint = { id: current[0], name: current[1].name }
    else delete next.sprint
    return next
  })
}

type StoryInfo = { name: string; at: number; unreadable?: boolean }

/**
 * Story 的標題。先用一次 notion-search（限定 Story 資料庫）把所有 Story 的標題拿回來——回傳只有標題，很小；
 * search 沒放行或沒命中的，才逐頁 notion-fetch。整頁太大讀不完的記 24 小時（名稱留空，畫面顯示 Story xxxxxx），
 * 其他失敗記 30 分鐘。結果存 store 一天；r 強制重整會重讀。
 */
async function resolveStories($: Engine, list: Card[], force = false): Promise<void> {
  const ids = [...new Set(list.flatMap(c => c.storyIds ?? []))]
  if (ids.length === 0) return
  const now = await $.clock.now()
  const known = ((await $.store.get(STORE_STORIES)) as Record<string, StoryInfo> | undefined) ?? {}
  const fresh = (hit: StoryInfo | undefined) =>
    Boolean(hit) && now - hit!.at < (hit!.name || hit!.unreadable ? STORY_CACHE_MS : SPRINT_FAIL_CACHE_MS) && !force
  let pending = ids.filter(id => !fresh(known[id]))
  let changed = false

  if (pending.length > 0) {
    // 一次 search 補齊能補的
    try {
      const res = await notion($, 'notion-search', { query: 'Story', data_source_url: STORIES_DS, page_size: 50, max_highlight_length: 0 })
      if (!res.isError) {
        const parsed = JSON.parse(await resultText($, res)) as { results?: { url?: string; title?: string }[] }
        const titles = new Map<string, string>()
        for (const r of parsed.results ?? []) {
          const id = typeof r.url === 'string' ? notionId(r.url) : ''
          if (id && typeof r.title === 'string' && r.title.trim()) titles.set(id, r.title.trim())
        }
        for (const id of pending) {
          const name = titles.get(id)
          if (name) {
            known[id] = { name, at: now }
            changed = true
          }
        }
        pending = pending.filter(id => !titles.has(id))
      }
    } catch {
      // search 沒放行或壞掉：全部走 fetch
    }
  }

  for (const id of pending) {
    try {
      const res = await notion($, 'notion-fetch', { id })
      const text = await resultText($, res)
      if (res.isError || OVERSIZED.test(text)) {
        known[id] = { name: '', at: now, unreadable: OVERSIZED.test(text) }
      } else {
        const outer = JSON.parse(text) as { title?: string }
        known[id] = { name: typeof outer.title === 'string' ? outer.title.trim() : '', at: now }
      }
    } catch {
      known[id] = { name: '', at: now }
    }
    changed = true
  }
  // 舊版留下的壞 key
  if ('undefined' in known) {
    delete known['undefined']
    changed = true
  }
  if (changed) await $.store.set(STORE_STORIES, known)
  const mirror: Stories = {}
  for (const id of ids) mirror[id] = known[id]?.name ?? ''
  await update($, stories, () => mirror)
}

/** 除錯：寫進 Claude Code 的 debug log（`claude --debug` 看得到），不落地檔案。 */
function dumpDebug($: Engine, data: unknown): void {
  try {
    $.ui.log(`session-desk: ${JSON.stringify(data).slice(0, 4000)}`, { to: 'debug' })
  } catch {
    // 寫不進去就算了
  }
}

const TRANSIENT = /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|socket|fetch failed|network|timed? ?out|\b50[234]\b|rate.?limit|429/i
const RETRY_WAITS_MS = [1500, 4000, 8000]

/**
 * Notion MCP 呼叫的包裝：
 * - auto mode 的分類器對計時器發出的呼叫沒有判定，第一次會拒；照它的提示原樣重發一次。
 * - 網路抖動（ECONNRESET、逾時、5xx、429）最多再試三次，間隔拉長。
 */
async function notion($: Engine, tool: string, args: Record<string, unknown>) {
  let verdictRetried = false
  for (let attempt = 0; ; attempt += 1) {
    try {
      const res = await $.mcp.call(NOTION, tool, args)
      // 伺服器端用 isError 回的暫時性錯誤也算
      if (res.isError && attempt < RETRY_WAITS_MS.length && TRANSIENT.test(firstText(res.content))) {
        await $.clock.sleep(RETRY_WAITS_MS[attempt]!)
        continue
      }
      return res
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!verdictRetried && /gave no verdict|Issue the action again/.test(msg)) {
        verdictRetried = true
        continue
      }
      if (attempt < RETRY_WAITS_MS.length && TRANSIENT.test(msg)) {
        await $.clock.sleep(RETRY_WAITS_MS[attempt]!)
        continue
      }
      throw err
    }
  }
}

function firstText(content: readonly { type: string; text?: string }[]): string {
  return content.find(c => c.type === 'text' && c.text)?.text ?? ''
}

/**
 * MCP 結果太大時引擎不給內容，只給一段「exceeds maximum allowed tokens… Output has been saved to <檔案>」。
 * 檔案是完整結果，直接讀回來當內容用；讀不到才維持原本的錯誤文字。
 */
async function resultText($: Engine, res: { content: readonly { type: string; text?: string }[] }): Promise<string> {
  const text = firstText(res.content)
  if (!OVERSIZED.test(text)) return text
  const saved = /saved to (\/\S+?\.txt)/.exec(text)?.[1]
  if (!saved) return text
  try {
    return await $.fs.read(saved)
  } catch {
    return text
  }
}

const CARD_ORDER = ['PR Reviewing', 'In Development', 'In Progress', 'In Diversity Testing', 'PM Retest', 'Wait to Beta', 'Wait to Prod', 'Monitoring', 'Pending', 'Pending Assignment', 'In Design', 'Not started']

function cardRank(c: Card): number {
  const i = CARD_ORDER.indexOf(c.status)
  return i < 0 ? CARD_ORDER.length : i
}

async function setStatus($: Engine, card: Card, status: string): Promise<void> {
  try {
    const res = await notion($, 'notion-update-page', {
      page_id: card.url,
      command: 'update_properties',
      properties: { Status: status },
      allow_async: false,
    })
    if (res.isError) throw new Error(firstText(res.content) || 'update 失敗')
    await update($, cards, list => list.map(c => (c.url === card.url ? { ...c, status } : c)))
    const cached = (await $.store.get(STORE_CARDS_CACHE)) as CardsCache | undefined
    if (cached) await $.store.set(STORE_CARDS_CACHE, { ...cached, cards: cached.cards.map(c => (c.url === card.url ? { ...c, status } : c)) })
    await note($, `#${card.taskId} → ${status}`)
  } catch (err) {
    await note($, `改狀態失敗：${fit(err instanceof Error ? err.message : String(err), 50)}`)
  }
}

// ------------------------------------------------------------------ 動作

async function it2(argv: string[], $: Engine): Promise<string | undefined> {
  try {
    const r = await $.process.run([IT2, ...argv], { timeoutMs: 6000 })
    return r.exitCode === 0 ? undefined : fit(r.stderr || r.stdout || `exit ${r.exitCode}`, 50)
  } catch (err) {
    return fit(String(err), 50)
  }
}

/** Enter 在 session 列上：第一次只選取，已選到的再按一次才跳過去。 */
async function pickSession($: Engine, s: DeskSession, a: Aliases): Promise<void> {
  const cur = await read($, sel)
  if (cur.sessionId === s.sessionId) {
    await focusSession($, s, a)
    return
  }
  await update($, sel, x => ({ ...x, sessionId: s.sessionId, picking: false, naming: false, sending: false }))
  await note($, s.isSelf ? `選到 ${displayName(s, a)}（就是這個視窗）` : `選到 ${displayName(s, a)}，再按 Enter 或 j 跳過去`)
}

/** Enter 在已關閉的 session 列上：第一次只選取，再按一次才 resume。 */
async function pickClosed($: Engine, id: string, b: Binding): Promise<void> {
  const cur = await read($, sel)
  if (cur.sessionId === id) {
    await resumeSession($, id, b)
    return
  }
  await update($, sel, x => ({ ...x, sessionId: id, picking: false, naming: false, sending: false }))
  await note($, `選到 ${b.name}（已關閉），再按 Enter 或 j 開新分頁 resume`)
}

async function focusSession($: Engine, s: DeskSession, a: Aliases): Promise<void> {
  await update($, sel, x => ({ ...x, sessionId: s.sessionId, picking: false, naming: false }))
  const name = displayName(s, a)
  if (s.isSelf) {
    await note($, `${name} 就是這個視窗`)
    return
  }
  if (!s.iterm) {
    await note($, `${name} 對不到 iTerm2 分頁（tty ${s.tty ?? '?'}）`)
    return
  }
  const err = await it2(['session', 'focus', s.iterm], $)
  await note($, err ? `it2 focus 失敗：${err}` : `→ ${name}`)
}

/** 關掉的 session：開新分頁、回原目錄 claude --resume。 */
async function resumeSession($: Engine, id: string, b: Binding): Promise<void> {
  await update($, sel, x => ({ ...x, sessionId: id, picking: false, naming: false }))
  if (!b.cwd) {
    await note($, '這筆綁定沒記目錄（舊版綁的），無法 resume')
    return
  }
  // transcript 存在原目錄的 slug 底下；目錄刪掉後從別的目錄 --resume 一樣找得到（實測 2.1.318）。
  if (!(await $.fs.exists(transcriptPath(home, b.cwd, id)))) {
    await note($, `找不到 ${b.name || id.slice(0, 6)} 的 transcript，無法 resume`)
    return
  }
  const where = await resumeDir($, b.cwd)
  if (!where) {
    await note($, `${shortPath(b.cwd, home)} 已經不在，上層也找不到可用目錄，無法 resume`)
    return
  }
  const cmd = `cd ${shellQuote(where.dir)} && exec claude --resume ${shellQuote(id)}`
  const err = await it2(['tab', 'new', '--command', `/bin/zsh -lc ${shellQuote(cmd)}`], $)
  const label = b.name || id.slice(0, 6)
  await note($, err ? `it2 tab new 失敗：${err}` : where.fellBack ? `⟲ ${label} 原目錄已刪，改在 ${shortPath(where.dir, home)} resume` : `⟲ 已開新分頁 resume ${label}`)
}

async function bind($: Engine): Promise<void> {
  const s = await read($, sel)
  const card = (await read($, cards)).find(c => c.url === s.cardUrl)
  const ss = (await read($, sessions)).find(x => x.sessionId === s.sessionId)
  if (!ss || !card) {
    await note($, '先選一個活著的 session（Enter）和一張卡（Enter），再按 b')
    return
  }
  const a = await read($, aliases)
  const at = await $.clock.now()
  await saveBindings($, b => ({ ...b, [ss.sessionId]: { cardUrl: card.url, name: displayName(ss, a), cwd: ss.cwd, boundAt: at } }))
  await note($, `${displayName(ss, a)} ⇄ #${card.taskId}`)
}

async function unbind($: Engine): Promise<void> {
  const s = await read($, sel)
  if (!s.sessionId) {
    await note($, '先選一個 session 再按 u')
    return
  }
  const id = s.sessionId
  await saveBindings($, b => {
    const next = { ...b }
    delete next[id]
    return next
  })
  await note($, '已解除綁定')
}

async function rename($: Engine, name: string): Promise<void> {
  const s = await read($, sel)
  await update($, sel, x => ({ ...x, naming: false }))
  const id = s.sessionId
  if (!id) return
  const trimmed = name.trim()
  const list = await read($, sessions)
  const live = list.find(x => x.sessionId === id)
  const cur = await loadAliases($)
  if (trimmed) cur[id] = trimmed
  else delete cur[id]
  await $.store.set(STORE_ALIASES, cur)
  await update($, aliases, () => cur)
  // 綁定裡記的名稱跟著改
  const b = await loadBindings($)
  const bound = b[id]
  if (bound) await saveBindings($, all => ({ ...all, [id]: { ...bound, name: trimmed || live?.name || bound.name } }))
  if (!trimmed) {
    await note($, '已清掉別名')
    return
  }
  // iTerm2 分頁名跟著改；本 session 另外在下一個 prompt 回 sessionTitle 給引擎
  if (live?.iterm) await it2(['session', 'set-name', trimmed, '--session', live.iterm], $)
  if (live?.isSelf) {
    pendingTitle = trimmed
    appliedAlias = trimmed
  }
  await note($, live ? `已命名 ${trimmed}（那個 session 下一句 prompt 送出後，Claude 自己的名稱也會跟上）` : `已命名 ${trimmed}`)
}

/** 開傳訊息對話框：把要帶的文字放進草稿，Desk pane 整個換成傳訊息畫面。 */
async function openSendPane($: Engine, prefill = ''): Promise<void> {
  const s = await read($, sel)
  const list = await read($, sessions)
  const target = list.find(x => x.sessionId === s.sessionId)
  if (!target) {
    await note($, s.sessionId ? '這個 session 沒在跑，送不過去' : '先選一個活著的 session')
    return
  }
  if (target.isSelf) {
    await note($, '這就是目前的 session，選別的')
    return
  }
  await update($, sel, x => ({ ...x, sending: true, naming: false, picking: false, pickingSprint: false, draft: prefill, sendSeq: (x.sendSeq ?? 0) + 1 }))
}

/** 關掉傳訊息對話框，不送。 */
async function cancelSend($: Engine): Promise<void> {
  await update($, sel, x => ({ ...x, sending: false, draft: '' }))
  await note($, '取消傳訊息')
}

/** 送一段文字給選到的 session（活著、不是自己）。對方會把它當 peer 訊息排進對話。 */
async function sendTo($: Engine, text: string): Promise<void> {
  await update($, sel, x => ({ ...x, sending: false, draft: '' }))
  const body = text.trim()
  if (!body) {
    await note($, '沒有內容，取消傳訊息')
    return
  }
  const s = await read($, sel)
  const list = await read($, sessions)
  const a = await read($, aliases)
  const target = list.find(x => x.sessionId === s.sessionId)
  if (!target) {
    await note($, s.sessionId ? '這個 session 沒在跑，送不過去' : '先選一個 session')
    return
  }
  if (target.isSelf) {
    await note($, '這就是目前的 session')
    return
  }
  try {
    const sent = await $.session.send({ to: { sessionId: target.sessionId }, text: body })
    if (sent.isDelivered) {
      await note($, `✓ 已送給 ${displayName(target, a)}（${dw(body)} 字）`)
    } else {
      dumpDebug($, { send: 'refused', to: target.sessionId, reason: sent.reason })
      await note($, `送不出去：${fit(sent.reason, 120)}`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    dumpDebug($, { send: 'threw', to: target.sessionId, error: msg })
    await note($, `送不出去：${fit(msg, 120)}`)
  }
}

/** 把滑鼠選取的那段文字帶進傳訊息對話框，讓人補一句再送。 */
async function pasteSelection($: Engine): Promise<void> {
  const picked = await $.ui.selection()
  if (!picked || !picked.text.trim()) {
    await note($, '先用滑鼠在對話區選一段文字，再按 p')
    return
  }
  const me = (await read($, sessions)).find(x => x.isSelf)
  const a = await read($, aliases)
  const from = me ? displayName(me, a) : 'Desk'
  await openSendPane($, `（從 ${from} 轉貼的 context）\n${picked.text.trim()}\n\n`)
}

/** 在 Notion 桌面 app 開卡（notion:// 協定），app 不在就退回瀏覽器。 */
async function openCardInApp($: Engine, card: Card): Promise<void> {
  const appUrl = card.id ? `notion://www.notion.so/${card.id}` : card.url
  try {
    const r = await $.process.run(['open', appUrl], { timeoutMs: 5000 })
    if (r.exitCode !== 0) await $.process.run(['open', card.url], { timeoutMs: 5000 })
    await note($, `Notion 開啟 #${card.taskId}`)
  } catch (err) {
    await note($, `開不了：${fit(String(err), 50)}`)
  }
}

/** o：把選到的卡在 Notion 桌面 app 開（notion:// 協定），app 不在就退回瀏覽器。 */
async function openCard($: Engine): Promise<void> {
  const sl = await read($, sel)
  const card = (await read($, cards)).find(c => c.url === sl.cardUrl)
  if (!card) {
    await note($, '先選一張卡再按 o')
    return
  }
  await openCardInApp($, card)
}

/** 用選到的卡在 iTerm2 開一個新分頁、同一個目錄起 claude，開場就是這張卡。 */
async function newSession($: Engine): Promise<void> {
  const s = await read($, sel)
  const card = (await read($, cards)).find(c => c.url === s.cardUrl)
  if (!card) {
    await note($, '先選一張卡再按 n')
    return
  }
  const cwd = await $.session.cwd()
  const prompt = `處理 Notion 卡 #${card.taskId}「${card.title}」：${card.url}\n先讀卡片，整理要做什麼、再跟我確認方向。`
  const cmd = `cd ${shellQuote(cwd)} && exec claude ${shellQuote(prompt)}`
  const err = await it2(['tab', 'new', '--command', `/bin/zsh -lc ${shellQuote(cmd)}`], $)
  await note($, err ? `it2 tab new 失敗：${err}` : `已開新分頁：#${card.taskId}`)
}

// ------------------------------------------------------------------ 註冊

export const register: Register = (on, options) => {
  pal = palette(options.theme)
  autoOpen = options.autoOpen !== 'off'
  VIEW_URL = typeof options.viewUrl === 'string' && options.viewUrl.trim() ? options.viewUrl.trim() : DEFAULT_VIEW_URL
  IT2 = typeof options.it2Path === 'string' && options.it2Path.trim() ? options.it2Path.trim() : DEFAULT_IT2
  SPRINTS_VIEW = typeof options.sprintsViewUrl === 'string' && options.sprintsViewUrl.trim() ? options.sprintsViewUrl.trim() : DEFAULT_SPRINTS_VIEW

  on('session.start', async ($, e, next) => {
    const result = await next(e)

    home = (await $.env.get('HOME')) ?? ''
    selfId = await $.session.id()

    await $.command.register({ name: 'desk', description: 'Session 總管：本機 session 與指派給我的 Notion 卡' })

    await refreshSessions($)
    $.clock.every(SESSIONS_MS, () => void refreshSessions($))
    void refreshCards($)
    cardsTimer = $.clock.every(CARDS_MS, () => void refreshCards($))

    if (autoOpen) void $.ui.open(paneArgs(false))

    return result
  })

  on('command.run', { command: 'desk' }, async $ => {
    const opened = await $.ui.open(paneArgs(true))
    if (!opened.isPlaced) return { text: `Desk 開不出來：${opened.reason}` }
    void refreshSessions($)
    return { text: 'Desk 開了。Enter 跳 session／選卡、o 在 Notion 開卡、b 綁卡、m 命名、t 改狀態、Esc 回來。' }
  })

  // 本 session 被取別名後，下一個 prompt 把名稱交給引擎（UserPromptSubmit 的 sessionTitle）。
  on('classic.UserPromptSubmit', async (_$, e, next) => {
    const result = await next(e)
    if (!pendingTitle) return result
    const sessionTitle = pendingTitle
    pendingTitle = undefined
    return { ...result, sessionTitle }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const table = $.ui.resolve(e)
    const { Box, Text, Button } = table
    const Select = 'Select' in table ? table.Select : undefined
    const Input = 'Input' in table ? table.Input : undefined
    const list: DeskSession[] = await read($, sessions)
    const cardList: Card[] = await read($, cards)
    const m: CardsMeta = await read($, meta)
    const sp: Sprints = await read($, sprints)
    const st: Stories = await read($, stories)
    const b: Bindings = await read($, bindings)
    const a: Aliases = await read($, aliases)
    const s: Selection = await read($, sel)
    await read($, tick) // 訂閱：每輪 refresh 重畫，idle 幾分鐘才會跟著走
    const now = await $.clock.now()
    const width = Math.max(44, e.props.bodyColumns)
    const inner = width - 4 // 「│ 」與「 │」
    const cardByUrl = new Map<string, Card>(cardList.map(c => [c.url, c] as const))
    const alive = new Set(list.flatMap(x => (x.parked ? [x.sessionId, x.parked.sessionId] : [x.sessionId])))
    const closed = Object.entries(b).filter(([id]) => !alive.has(id))
    /** 卡 → 綁它的 session 顯示名（活著或關掉）。 */
    const ownerByCard = new Map<string, { name: string; isClosed: boolean }>()
    for (const ss of list) {
      const bound = b[ss.sessionId]
      if (bound) ownerByCard.set(bound.cardUrl, { name: displayName(ss, a), isClosed: false })
    }
    for (const [id, bound] of closed) {
      if (!ownerByCard.has(bound.cardUrl)) ownerByCard.set(bound.cardUrl, { name: a[id] ?? bound.name ?? id.slice(0, 6), isClosed: true })
    }

    const sprintLabel = (id: string) => sp[id]?.name || `Sprint ${id.slice(0, 6)}`
    const shown = m.viewSprint
      ? cardList.filter(c => c.sprintIds.includes(m.viewSprint!))
      : m.onlyCurrent && m.sprint
        ? cardList.filter(c => c.sprintIds.includes(m.sprint!.id))
        : cardList
    const scopeLabel = m.viewSprint ? sprintLabel(m.viewSprint) : m.onlyCurrent && m.sprint ? m.sprint.name : '全部'
    const counts = { waiting: 0, busy: 0, idle: 0 }
    for (const ss of list) if (ss.status in counts) counts[ss.status as keyof typeof counts] += 1
    const nameW = Math.min(24, Math.max(10, Math.floor(inner * 0.36)))
    const selected = list.find(x => x.sessionId === s.sessionId)
    const selectedClosed = closed.find(([id]) => id === s.sessionId)

    // ---- 畫框的小工具：標題嵌在上框線，右側可放摘要；內容列用 flexGrow 把右框線推到底。
    const dimProps = pal.muted ? { color: pal.muted } : { dimColor: true }
    const textProps = pal.text ? { color: pal.text } : {}
    const header = (title: string, count: string, right?: readonly { text: string; color?: string }[]) => {
      const countText = count ? ` · ${count} ` : ' '
      const left = `╭─ ${title}${countText}`
      const rightText = right && right.length > 0 ? ` ${right.map(r => r.text).join(' ')} ` : ''
      const fill = Math.max(1, width - dw(left) - dw(rightText) - 2)
      return (
        <Box width={width} overflow="hidden">
          <Text color={pal.border}>╭─ </Text>
          <Text bold {...textProps}>{title}</Text>
          <Text {...dimProps}>{countText}</Text>
          <Text color={pal.border}>{'─'.repeat(fill)}</Text>
          {right && right.length > 0 && (
            <Text>
              {' '}
              {right.map((r, i) => (
                <Text color={r.color} {...(r.color ? {} : dimProps)}>
                  {i > 0 ? ' ' : ''}
                  {r.text}
                </Text>
              ))}{' '}
            </Text>
          )}
          <Text color={pal.border}>─╮</Text>
        </Box>
      )
    }
    const footer = () => <Text color={pal.border}>{'╰' + '─'.repeat(Math.max(1, width - 2)) + '╯'}</Text>
    const row = (children: JSX.Element, tail?: JSX.Element) => (
      <Box width={width} overflow="hidden">
        <Text color={pal.border}>│ </Text>
        {children}
        <Box flexGrow={1} />
        {tail}
        <Text color={pal.border}> │</Text>
      </Box>
    )
    const empty = (text: string) => row(<Text {...dimProps}>{text}</Text>)
    const statusGlyph = (st: string) => (st === 'busy' ? '●' : st === 'waiting' ? '◐' : st === 'idle' ? '○' : '·')
    const statusTone = (st: string) => (st === 'busy' ? pal.busy : st === 'waiting' ? pal.waiting : pal.closed)
    // plain + hotkey 的 Button 引擎會自己畫成「o: 標籤」，字母不用再畫一次。
    const key = (k: string, label: string, onPress: () => void) => (
      <Button key={`k:${k}`} plain hotkey={k} onPress={onPress}>
        <Text {...dimProps}>{label}</Text>
      </Button>
    )

    const renderCard = (c: Card) => {
          const picked = s.cardUrl === c.url
          const owner = ownerByCard.get(c.url)
          const titleW = Math.max(12, inner - 2 - 6 - 6 - 4)
          const line = row(
            <Button key={`c:${c.id}`} plain onPress={() => void update($, sel, x => ({ ...x, cardUrl: c.url, picking: false, naming: false, sending: false, pickingSprint: false }))}>
              <Text color={pal.accent}>{picked ? '▸ ' : '  '}</Text>
              <Text {...dimProps}>{c.taskId.padStart(5)} </Text>
              <Text color={statusColor(c.status)}>{shortStatus(c.status).padEnd(5)} </Text>
              <Text color={/P0|P1/.test(c.priority) ? pal.waiting : pal.muted} dimColor={!pal.muted && !/P0|P1/.test(c.priority)}>
                {shortPriority(c.priority).padEnd(3)}
              </Text>
              <Text color={picked ? pal.accent : pal.text}>{fit(c.title, titleW - (c.unassigned ? 7 : 0))}</Text>
              {c.unassigned && <Text color={pal.busy}> ⚑待指派</Text>}
            </Button>,
          )
          if (!owner) return line
          return (
            <Box flexDirection="column">
              {line}
              {row(
                <Text color={owner.isClosed ? pal.closed : pal.ok}>
                  {'                    '}⌁ {fit(owner.name, 20)}
                  {owner.isClosed ? '（已關閉）' : ''}
                </Text>,
              )}
            </Box>
          )
            }

    if (Input && s.sending && selected && !selected.isSelf) {
      const statusText = selected.status === 'busy' ? '忙碌中，訊息會排到它下一輪' : selected.status === 'waiting' ? `等你：${selected.waitingFor ?? ''}` : '閒置，會馬上處理'
      const draftLines = s.draft ? s.draft.split('\n').length : 0
      return (
        <Box flexDirection="column">
          {header('傳訊息', '', [])}
          <Box paddingX={1}>
            <Text bold color={pal.accent}>傳給 </Text>
            <Text bold>{fit(displayName(selected, a), inner - 24)}</Text>
            <Text {...dimProps}>{`  ${fit(shortPath(selected.cwd, home), 20)}`}</Text>
          </Box>
          <Box paddingX={1}>
            <Text {...dimProps}>{statusText}{draftLines > 1 ? `　· 已帶入 ${draftLines} 行選取文字，可在後面補說明` : ''}</Text>
          </Box>
          <Box marginTop={1} paddingX={1} flexDirection="column">
            <Input
              key={`draft-${s.sendSeq ?? 0}`}
              value={s.draft ?? ''}
              placeholder="要交給那個 session 的 context、指示或交接內容"
              rows={Math.min(10, Math.max(6, draftLines + 3))}
              submitLabel="送出"
              autoFocus
              onSubmit={value => void sendTo($, value)}
            />
          </Box>
          <Box marginTop={1} paddingX={1}>
            <Button key="send-cancel" plain hotkey="q" onPress={() => void cancelSend($)}>
              <Text {...dimProps}>取消</Text>
            </Button>
          </Box>
          <Box paddingX={1}>
            <Text {...dimProps}>{e.props.isFocused ? 'Enter 送出 · \\ 加 Enter 換行 · 送出空白或 Tab 到「取消」＝不送' : 'ctrl+x tab 或點一下進來打字'}</Text>
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        {header('Sessions', String(list.length), [
          { text: `●${counts.busy}`, color: pal.busy },
          { text: `◐${counts.waiting}`, color: pal.waiting },
          { text: `○${counts.idle}` },
        ])}
        {list.length === 0 && empty('沒有活著的 session。')}
        {list.map(ss => {
          const bound = b[ss.sessionId] ? cardByUrl.get(b[ss.sessionId]!.cardUrl) : undefined
          const picked = s.sessionId === ss.sessionId
          const tone = statusTone(ss.status)
          const detail = ss.status === 'waiting' && ss.waitingFor ? `${fit(ss.waitingFor, 14)} ` : ''
          const line = row(
            <Button key={`s:${ss.sessionId}`} plain onPress={() => void pickSession($, ss, a)}>
              <Text color={pal.accent}>{picked ? '▸ ' : '  '}</Text>
              <Text color={tone}>{statusGlyph(ss.status)} </Text>
              <Text bold={ss.isSelf} color={picked ? pal.accent : pal.text}>{padTo(displayName(ss, a), nameW)} </Text>
              <Text color={tone}>{ss.status.padEnd(8)}</Text>
              <Text {...dimProps}>
                {detail}
                {age(ss.statusAt, now).padStart(3)}
                {ss.kind === 'bg' ? (ss.parked ? ' ⇢bg' : ' bg') : ''}
                {ss.iterm ? '' : ' ⌀'}
              </Text>
            </Button>,
            bound ? <Text color={pal.ok}>⧉ #{bound.taskId}</Text> : undefined,
          )
          if (!picked) return line
          return (
            <Box flexDirection="column">
              {line}
              {row(
                <Text {...dimProps}>
                  {'      '}
                  {fit(shortPath(ss.cwd, home), inner - 14)}
                  {dirAlive.get(ss.cwd) === false ? <Text color={pal.waiting}> 目錄已刪</Text> : ''}
                </Text>,
              )}
              {ss.parked &&
                row(
                  <Text {...dimProps}>
                    {'      ↳ 互動層 '}
                    {fit(ss.parked.name, 18)} 在等（{ss.parked.status} {age(ss.parked.statusAt, now)}）
                  </Text>,
                )}
            </Box>
          )
        })}
        {footer()}

        {closed.length > 0 && header('已關閉・有綁卡', String(closed.length), [{ text: 'Enter resume' }])}
        {closed.map(([id, bound]) => {
          const card = cardByUrl.get(bound.cardUrl)
          const picked = s.sessionId === id
          const name = a[id] ?? bound.name ?? id.slice(0, 6)
          return row(
            <Button key={`z:${id}`} plain onPress={() => void pickClosed($, id, bound)}>
              <Text color={pal.accent}>{picked ? '▸ ' : '  '}</Text>
              <Text color={pal.closed}>⟲ </Text>
              <Text color={picked ? pal.accent : pal.closed}>{padTo(name || id.slice(0, 6), nameW)} </Text>
              <Text color={pal.closed}>{'closed'.padEnd(8)}</Text>
              <Text {...dimProps}>
                {bound.boundAt ? age(bound.boundAt, now).padStart(3) : '   '} {fit(shortPath(bound.cwd, home), Math.max(6, inner - nameW - 24 - (dirAlive.get(bound.cwd) === false ? 7 : 0)))}
              </Text>
              {dirAlive.get(bound.cwd) === false && <Text color={pal.waiting}> 目錄已刪</Text>}
            </Button>,
            card ? <Text color={pal.ok}>⧉ #{card.taskId}</Text> : undefined,
          )
        })}
        {closed.length > 0 && footer()}

        {header(
          'notions',
          `${scopeLabel} · ${shown.length}`,
          m.loading ? [{ text: '載入中…' }] : m.loadedAt ? [{ text: `${age(m.loadedAt, now)} 前` }] : undefined,
        )}
        {m.error && row(<Text color={pal.waiting}>{fit(m.error, inner)}</Text>)}
        {shown.length === 0 && !m.loading && empty(m.error ? '載入失敗，按 r 重試。' : '沒有指派給你、還沒結案的卡。')}
        {(() => {
          // 卡太多會把操作列擠出畫面：算一下整棵樹要幾列，放不下就把 Story 群組收起來，只展開選到的那組（或第一組）。
          const groups = groupByStory(shown, st)
          const cardRows = (c: Card) => (ownerByCard.get(c.url) ? 2 : 1)
          const allCardRows = groups.reduce((n, g) => n + 1 + g.cards.reduce((k, c) => k + cardRows(c), 0), 0)
          const otherRows =
            2 + list.length + (selected ? 1 + (selected.parked ? 1 : 0) : 0) +
            (closed.length > 0 ? 2 + closed.length : 0) +
            2 + (s.showAll ? 6 : 4) + 1 +
            (s.naming || s.picking || s.pickingSprint ? 6 : 0)
          const roomRows = e.props.scroll.bodyRows > 0 ? e.props.scroll.bodyRows : Number.POSITIVE_INFINITY
          const compact = allCardRows + otherRows > roomRows
          const selGroup = groups.find(g => g.cards.some(c => c.url === s.cardUrl))?.id ?? groups[0]?.id
          const toggles = s.groupToggles ?? {}
          const isOpen = (id: string) => (id in toggles ? toggles[id]! : !compact || id === selGroup)
          return groups.map(group => {
            const open = isOpen(group.id)
            return (
              <Box flexDirection="column">
                {row(
                  <Button key={`g:${group.id}`} plain onPress={() => void update($, sel, x => ({ ...x, groupToggles: { ...(x.groupToggles ?? {}), [group.id]: !open } }))}>
                    <Text color={pal.accent}>{open ? '▍' : '▸'}</Text>
                    <Text bold {...textProps}>{fit(group.name, inner - 14)}</Text>
                    <Text {...dimProps}> · {group.cards.length}{open ? '' : '　收合'}</Text>
                  </Button>,
                )}
                {open && group.cards.map(c => renderCard(c))}
              </Box>
            )
          })
        })()}
        {footer()}

        {Select && s.pickingSprint && (
          <Box marginTop={1} flexDirection="column">
            <Text {...dimProps}>要看哪個 Sprint：</Text>
            <Select
              key="sprint"
              autoFocus
              options={[
                { value: 'all', label: '全部' },
                ...(m.sprint ? [{ value: 'current', label: `本 Sprint（${m.sprint.name}）` }] : []),
                ...Object.keys(sp)
                  .sort((x, y) => sprintLabel(y).localeCompare(sprintLabel(x)))
                  .map(id => ({ value: id, label: `${sprintLabel(id)}${sp[id]?.status ? ` · ${sp[id]!.status}` : ''}` })),
              ]}
              value={m.viewSprint ?? (m.onlyCurrent ? 'current' : 'all')}
              onSelect={value => {
                void update($, sel, x => ({ ...x, pickingSprint: false }))
                void update($, meta, x => {
                  const next: CardsMeta = { ...x }
                  if (value === 'all') {
                    next.onlyCurrent = false
                    delete next.viewSprint
                  } else if (value === 'current') {
                    next.onlyCurrent = true
                    delete next.viewSprint
                  } else {
                    next.viewSprint = value
                  }
                  return next
                })
              }}
            />
          </Box>
        )}

        {Select && s.picking && s.cardUrl && cardByUrl.has(s.cardUrl) && (
          <Box marginTop={1} flexDirection="column">
            <Text {...dimProps}>#{cardByUrl.get(s.cardUrl)!.taskId} 新狀態：</Text>
            <Select
              key="status"
              autoFocus
              options={STATUSES.map(v => ({ value: v }))}
              value={cardByUrl.get(s.cardUrl)!.status}
              onSelect={value => {
                const card = cardByUrl.get(s.cardUrl!)
                void update($, sel, x => ({ ...x, picking: false }))
                if (card && value !== card.status) void setStatus($, card, value)
              }}
            />
          </Box>
        )}

        {Input && s.naming && s.sessionId && (selected || selectedClosed) && (
          <Box marginTop={1} flexDirection="column">
            <Input
              key="alias"
              label={`命名 ${selected ? displayName(selected, a) : selectedClosed?.[1].name ?? ''}（留空清掉別名）`}
              value={a[s.sessionId] ?? ''}
              placeholder="例如：9983 預約回覆發送"
              autoFocus
              onSubmit={value => void rename($, value)}
            />
          </Box>
        )}

        {(() => {
          // ---- 操作列：情境式。選到什麼就列什麼；a 切成全部。
          const selCard = s.cardUrl ? cardByUrl.get(s.cardUrl) : undefined
          const selName = selected ? displayName(selected, a) : selectedClosed ? (a[selectedClosed[0]] ?? selectedClosed[1].name) : undefined
          const boundHere = s.sessionId ? b[s.sessionId] : undefined
          const canBind = Boolean(selected && selCard)
          const sep = <Text color={pal.border}> │ </Text>
          const group = (items: readonly (JSX.Element | false | undefined)[]) => {
            const kept = items.filter((x): x is JSX.Element => Boolean(x))
            return kept.length === 0 ? undefined : (
              <Box columnGap={2}>{kept}</Box>
            )
          }
          const sessionOps = group([
            selected && !selected.isSelf && key('j', '跳過去', () => void focusSession($, selected, a)),
            selectedClosed && key('j', 'resume', () => void resumeSession($, selectedClosed[0], selectedClosed[1])),
            selected && !selected.isSelf && key('s', '傳訊息', () => void openSendPane($)),
            selected && !selected.isSelf && key('p', '貼選取', () => void pasteSelection($)),
            (selected || selectedClosed) && key('m', '命名', () => void update($, sel, x => ({ ...x, naming: !x.naming, picking: false, sending: false, pickingSprint: false }))),
          ])
          const cardOps = group([
            selCard && key('o', '開卡片', () => void openCard($)),
            selCard && key('t', '改狀態', () => void update($, sel, x => ({ ...x, picking: !x.picking, naming: false, sending: false, pickingSprint: false }))),
            selCard && key('n', '新 session', () => void newSession($)),
          ])
          const bindOps = group([
            canBind && !boundHere && key('b', `綁定 ${fit(selName ?? '', 14)} ⇄ #${selCard!.taskId}`, () => void bind($)),
            canBind && boundHere && boundHere.cardUrl !== selCard!.url && key('b', `改綁 #${selCard!.taskId}`, () => void bind($)),
            boundHere && key('u', `解除 #${cardByUrl.get(boundHere.cardUrl)?.taskId ?? ''}`, () => void unbind($)),
          ])
          const viewOps = group([
            key('c', m.viewSprint || !m.onlyCurrent ? '本 Sprint' : '看全部卡', () =>
              void update($, meta, x => {
                const next: CardsMeta = { ...x, onlyCurrent: x.viewSprint ? true : !x.onlyCurrent }
                delete next.viewSprint
                return next
              }),
            ),
            key('v', '選 Sprint', () => void update($, sel, x => ({ ...x, pickingSprint: !x.pickingSprint, picking: false, naming: false, sending: false }))),
            key('r', '重整', () => {
              void refreshSessions($)
              void refreshCards($, true)
            }),
            key('a', s.showAll ? '精簡' : '全部操作', () => void update($, sel, x => ({ ...x, showAll: !x.showAll }))),
          ])
          const title = s.showAll
            ? '全部操作'
            : selName || selCard
              ? `已選${selName ? ` ${fit(selName, 18)}` : ''}${selCard ? ` · #${selCard.taskId}` : ''}`
              : '選一列 session 或卡片開始'
          const rule = (
            <Box width={width} overflow="hidden">
              <Text color={pal.border}>── </Text>
              <Text {...dimProps}>{title}</Text>
              <Text color={pal.border}> {'─'.repeat(Math.max(1, width - dw(title) - 5))}</Text>
            </Box>
          )
          if (s.showAll) {
            const all = (keys: readonly [string, string, () => void][]) => (
              <Box columnGap={2}>{keys.map(([k, label, fn]) => key(k, label, fn))}</Box>
            )
            const noop = (text: string) => () => void note($, text)
            return (
              <Box marginTop={1} flexDirection="column">
                {rule}
                <Box>
                  <Text {...dimProps}>{padTo('Session', 8)}</Text>
                  {all([
                    ['j', '跳過去', selected && !selected.isSelf ? () => void focusSession($, selected, a) : selectedClosed ? () => void resumeSession($, selectedClosed[0], selectedClosed[1]) : noop('先選一個 session')],
                    ['s', '傳訊息', selected && !selected.isSelf ? () => void openSendPane($) : noop('先選一個活著的 session')],
                    ['p', '貼選取', () => void pasteSelection($)],
                    ['m', '命名', selected || selectedClosed ? () => void update($, sel, x => ({ ...x, naming: !x.naming, picking: false, sending: false, pickingSprint: false })) : noop('先選一個 session')],
                  ])}
                </Box>
                <Box>
                  <Text {...dimProps}>{padTo('卡片', 8)}</Text>
                  {all([
                    ['o', '開卡片', () => void openCard($)],
                    ['t', '改狀態', selCard ? () => void update($, sel, x => ({ ...x, picking: !x.picking, naming: false, sending: false, pickingSprint: false })) : noop('先選一張卡')],
                    ['n', '新 session', () => void newSession($)],
                  ])}
                </Box>
                <Box>
                  <Text {...dimProps}>{padTo('綁定', 8)}</Text>
                  {all([
                    ['b', '綁定', () => void bind($)],
                    ['u', '解除', () => void unbind($)],
                  ])}
                </Box>
                <Box>
                  <Text {...dimProps}>{padTo('檢視', 8)}</Text>
                  {viewOps}
                </Box>
              </Box>
            )
          }
          const groups = [sessionOps, cardOps, bindOps, viewOps].filter((g): g is JSX.Element => Boolean(g))
          return (
            <Box marginTop={1} flexDirection="column">
              {rule}
              <Box width={width} flexWrap="wrap">
                {groups.map((g, i) => (
                  <Box>
                    {i > 0 && sep}
                    {g}
                  </Box>
                ))}
              </Box>
            </Box>
          )
        })()}
        <Text {...dimProps}>{s.note && now - s.noteAt < 20_000 ? s.note : e.props.isFocused ? 'Enter 選取（再按一次跳過去／resume）· j 跳過去 · o 在 Notion 開 · Esc 回到輸入框' : 'ctrl+x tab 或點一下進來操作'}</Text>
      </Box>
    )
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    if (e.origin.kind === 'unload' && cardsTimer) cardsTimer.cancel()
    return next(e)
  })

}

function statusColor(status: string): string | undefined {
  if (status === 'PR Reviewing') return pal.busy
  if (status === 'In Development' || status === 'In Progress') return pal.accent
  if (status.startsWith('Wait')) return pal.ok
  if (status === 'Not started') return pal.closed
  return pal.text
}

function paneArgs(focus: boolean) {
  return {
    id: PANE,
    title: TITLE,
    columns: 72,
    ...(focus ? { focus: true as const } : {}),
    ...(pal.bg ? { backgroundColor: pal.bg } : {}),
  }
}

/** 依 Story 分組；沒 Story 的放最後一組。組內維持原排序，組間依卡數多到少、同數依名稱。 */
function groupByStory(list: Card[], names: Stories): { id: string; name: string; cards: Card[] }[] {
  const groups = new Map<string, Card[]>()
  for (const c of list) {
    const id = c.storyIds?.[0] ?? ''
    const arr = groups.get(id) ?? []
    arr.push(c)
    groups.set(id, arr)
  }
  return [...groups.entries()]
    .map(([id, cards]) => ({ id, name: id ? names[id] || `Story ${id.slice(0, 6)}` : '（沒有 Story）', cards }))
    .sort((a, b) => (a.id === '' ? 1 : 0) - (b.id === '' ? 1 : 0) || b.cards.length - a.cards.length || a.name.localeCompare(b.name))
}
