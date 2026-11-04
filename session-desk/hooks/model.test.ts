import { expect, test } from 'claude-code/testing'

import { age, cleanTabTitle, fallbackDirs, fit, mergeParked, normalizeBinding, notionId, parseIt2List, parsePs, parseSessionJson, preferredName, shellQuote, toCard, transcriptPath, unescapeTitle } from './model'

test('it2 session list：tty 對到 iTerm2 session id', async () => {
  const out = [
    '2D77C218-996D-42AA-81D8-1CA187F2E12F\t✳ sales (claude)\t✳ sales (claude)\t237x66\t\\/dev\\/ttys001',
    '8486818A-5F8A-4840-8F3A-84FA7082C45D\t..acoon\\/neptune (-zsh)\t..acoon/neptune (-zsh)\t237x69\t\\/dev\\/ttys007',
    '',
  ].join('\n')
  const map = parseIt2List(out)
  expect(map.get('ttys001')?.id).toBe('2D77C218-996D-42AA-81D8-1CA187F2E12F')
  expect(map.get('ttys001')?.title).toBe('sales')
  expect(map.get('ttys007')?.id).toBe('8486818A-5F8A-4840-8F3A-84FA7082C45D')
  expect(cleanTabTitle('◐ Session 總管與 Notion 卡管理 (claude)')).toBe('Session 總管與 Notion 卡管理')
  expect(cleanTabTitle('✳ search-tuning-phase-0 (claude)')).toBe('search-tuning-phase-0')
  expect(preferredName({ name: 'pluto-ff', nameSource: 'derived', tabTitle: 'Session 總管' })).toBe('Session 總管')
  expect(preferredName({ name: '我取的', nameSource: 'user', tabTitle: '自動標題' })).toBe('我取的')
})

test('ps：pid 對 tty，死掉的不在裡面', async () => {
  const map = parsePs('12425 ttys008\n74290 ttys009\n')
  expect(map.get(12425)).toBe('ttys008')
  expect(map.has(99999)).toBe(false)
})

test('session json：waiting 帶 waitingFor', async () => {
  const raw = parseSessionJson(
    JSON.stringify({ pid: 1, sessionId: 'abc', cwd: '/x', startedAt: 10, kind: 'interactive', name: 'n', status: 'waiting', waitingFor: 'dialog open', statusUpdatedAt: 20 }),
  )
  expect(raw?.status).toBe('waiting')
  expect(raw?.waitingFor).toBe('dialog open')
  expect(parseSessionJson('not json')).toBeUndefined()
})

test('Notion row → Card', async () => {
  const card = toCard({
    url: 'https://app.notion.com/p/40297d91ff3781ff981dd2bb99b62817',
    Items: '\\[FE\\] 結帳頁優惠碼輸入框驗證 (US-3)',
    Status: 'Not started',
    Priority: 'P2🟡 - 5wd',
    類型: '功能',
    'Task ID': '9985',
    Sprint: '["https://app.notion.com/p/3e397d91ff378062a86fe17fe23994ed"]',
  })
  expect(card?.id).toBe('40297d91ff3781ff981dd2bb99b62817')
  expect(card?.title).toBe('[FE] 結帳頁優惠碼輸入框驗證 (US-3)')
  expect(card?.sprintIds[0]).toBe('3e397d91ff378062a86fe17fe23994ed')
  expect(card?.unassigned).toBe(true)
  expect(toCard({ url: 'https://app.notion.com/p/40297d91ff3781ff981dd2bb99b62817', Items: 'x', Assign: '["user://3c9d"]' })?.unassigned).toBe(false)
  expect(notionId('https://www.notion.so/jtcg/Foo-3e397d91ff378062a86fe17fe23994ed?pvs=4')).toBe('3e397d91ff378062a86fe17fe23994ed')
  expect(unescapeTitle('a \\[b\\]')).toBe('a [b]')
})

test('小工具', async () => {
  expect(age(0, 45_000)).toBe('45s')
  expect(age(0, 7 * 60_000)).toBe('7m')
  expect(age(0, 3 * 3_600_000)).toBe('3h')
  expect(fit('中文字串很長', 6)).toBe('中文…')
  expect(shellQuote(`it's`)).toBe(`'it'\\''s'`)
})

test('transcript 路徑與舊版綁定相容', async () => {
  expect(transcriptPath('/Users/h', '/Users/h/work/acme-shop/.claude/worktrees/x', 'abc')).toBe(
    '/Users/h/.claude/projects/-Users-h-work-acme-shop--claude-worktrees-x/abc.jsonl',
  )
  expect(normalizeBinding('https://x/y')?.cardUrl).toBe('https://x/y')
  expect(normalizeBinding({ cardUrl: 'u', name: 'n', cwd: '/c', boundAt: 1 })?.name).toBe('n')
  expect(normalizeBinding('')).toBeUndefined()
})

test('park 出去的工作與它的背景行程合成一列', async () => {
  const raws = new Map([
    ['shell', { pid: 1, sessionId: 'shell', cwd: '/x', startedAt: 0, kind: 'interactive', name: 'pluto-5e', nameSource: 'derived', parkedJobId: 'job1' }],
    ['job1', { pid: 2, sessionId: 'job1', cwd: '/x', startedAt: 0, kind: 'bg', name: '會員摘要', nameSource: 'auto', jobId: 'job1' }],
    ['other', { pid: 3, sessionId: 'other', cwd: '/x', startedAt: 0, kind: 'interactive', name: 'pluto-ff', nameSource: 'derived' }],
  ])
  const base = (id: string, kind: string, name: string, status: string) => ({
    sessionId: id, pid: 0, name, nameSource: 'derived', kind, cwd: '/x', status, statusAt: 5, startedAt: 0, isSelf: false,
  })
  const list = mergeParked(
    [
      { ...base('shell', 'interactive', 'pluto-5e', 'idle'), tty: 'ttys003', iterm: 'ITERM-3', tabTitle: '會員摘要' },
      { ...base('job1', 'bg', '會員摘要', 'busy'), tty: 'ttys009' },
      { ...base('other', 'interactive', 'pluto-ff', 'busy'), tty: 'ttys008', iterm: 'ITERM-8' },
    ],
    raws,
  )
  expect(list.map(s => s.sessionId)).toEqual(['job1', 'other'])
  const merged = list[0]!
  expect(merged.status).toBe('busy')
  expect(merged.iterm).toBe('ITERM-3')
  expect(merged.parked?.sessionId).toBe('shell')
  expect(merged.parked?.status).toBe('idle')
})

test('fallbackDirs：先拿掉 -後綴，再往上層', async () => {
  expect(fallbackDirs('/Users/h/work/acme-shop-2041')).toEqual(['/Users/h/work/acme-shop', '/Users/h/work/acme', '/Users/h/work', '/Users/h', '/Users'])
  expect(fallbackDirs('/Users/h/work/acme-shop-2041-b')).toEqual(['/Users/h/work/acme-shop-2041', '/Users/h/work/acme-shop', '/Users/h/work/acme', '/Users/h/work', '/Users/h', '/Users'])
  expect(fallbackDirs('/Users/h/work/acme-shop')).toEqual(['/Users/h/work/acme', '/Users/h/work', '/Users/h', '/Users'])
  expect(fallbackDirs('/')).toEqual([])
})
