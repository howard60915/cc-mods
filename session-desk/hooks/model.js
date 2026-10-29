"use strict";
// 純函式：解析 session 檔、ps、it2、Notion 的回傳。沒有 $，方便測。
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATUSES = void 0;
exports.parseSessionJson = parseSessionJson;
exports.parsePs = parsePs;
exports.cleanTabTitle = cleanTabTitle;
exports.parseIt2List = parseIt2List;
exports.toDeskSession = toDeskSession;
exports.mergeParked = mergeParked;
exports.preferredName = preferredName;
exports.parseNotionRows = parseNotionRows;
exports.notionId = notionId;
exports.unescapeTitle = unescapeTitle;
exports.toCard = toCard;
exports.age = age;
exports.shellQuote = shellQuote;
exports.shortPath = shortPath;
exports.fit = fit;
exports.shortStatus = shortStatus;
exports.shortPriority = shortPriority;
exports.transcriptPath = transcriptPath;
exports.normalizeBinding = normalizeBinding;
exports.dw = dw;
exports.padTo = padTo;
function parseSessionJson(text) {
    try {
        var d = JSON.parse(text);
        if (typeof d.pid !== 'number' || typeof d.sessionId !== 'string')
            return undefined;
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
        };
    }
    catch (_a) {
        return undefined;
    }
}
/** `ps -o pid=,tty= -p …` 的輸出 → pid → tty（ttys008）。沒列出來的 pid 已經死了。 */
function parsePs(stdout) {
    var _a;
    var out = new Map();
    for (var _i = 0, _b = stdout.split('\n'); _i < _b.length; _i++) {
        var line = _b[_i];
        var m = line.trim().match(/^(\d+)\s+(\S+)/);
        if (m)
            out.set(Number(m[1]), (_a = m[2]) !== null && _a !== void 0 ? _a : '');
    }
    return out;
}
/** 分頁標題去掉 Claude Code 加的狀態符號與「(claude)」：「◐ Session 總管 (claude)」→「Session 總管」。 */
function cleanTabTitle(raw) {
    return raw
        .replace(/\\\//g, '/')
        .replace(/^[\s\u2000-\u2BFF\u2600-\u27BF\u{1F300}-\u{1FAFF}]+/u, '')
        .replace(/\s*\((claude|-?zsh|bash|fish)\)\s*$/i, '')
        .trim();
}
/** `it2 session list` 一行一個 session，tab 分隔：id、名稱、標題、尺寸、tty（斜線被跳脫成 \/）。→ tty → { iTerm2 session id, 標題 }。 */
function parseIt2List(stdout) {
    var _a, _b, _c, _d, _e;
    var out = new Map();
    for (var _i = 0, _f = stdout.split('\n'); _i < _f.length; _i++) {
        var line = _f[_i];
        var cols = line.split('\t');
        if (cols.length < 2)
            continue;
        var id = (_b = (_a = cols[0]) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : '';
        var tty = ((_c = cols[cols.length - 1]) !== null && _c !== void 0 ? _c : '').replace(/\\\//g, '/').trim();
        var short = (_d = tty.split('/').pop()) !== null && _d !== void 0 ? _d : '';
        if (/^[0-9A-F-]{36}$/i.test(id) && short.startsWith('tty'))
            out.set(short, { id: id, title: cleanTabTitle((_e = cols[1]) !== null && _e !== void 0 ? _e : '') });
    }
    return out;
}
function toDeskSession(raw, tty, itermByTty, selfId) {
    var _a, _b, _c;
    var s = {
        sessionId: raw.sessionId,
        pid: raw.pid,
        name: raw.name,
        nameSource: raw.nameSource,
        kind: raw.kind,
        cwd: raw.cwd,
        status: (_a = raw.status) !== null && _a !== void 0 ? _a : 'unknown',
        statusAt: (_c = (_b = raw.statusUpdatedAt) !== null && _b !== void 0 ? _b : raw.updatedAt) !== null && _c !== void 0 ? _c : raw.startedAt,
        startedAt: raw.startedAt,
        isSelf: raw.sessionId === selfId,
    };
    if (raw.waitingFor)
        s.waitingFor = raw.waitingFor;
    if (tty) {
        s.tty = tty;
        var tab = itermByTty.get(tty);
        if (tab) {
            s.iterm = tab.id;
            if (tab.title)
                s.tabTitle = tab.title;
        }
    }
    return s;
}
/**
 * park 出去的工作：互動層（parkedJobId）與它的背景行程（jobId）是同一件事，合成一列。
 * 名字、狀態用背景行程的（那才是在跑的）；分頁用互動層的（背景行程沒有自己的分頁）。
 */
function mergeParked(list, raws) {
    var bgByJob = new Map();
    for (var _i = 0, list_1 = list; _i < list_1.length; _i++) {
        var s = list_1[_i];
        var raw = raws.get(s.sessionId);
        if (s.kind === 'bg' && (raw === null || raw === void 0 ? void 0 : raw.jobId))
            bgByJob.set(raw.jobId, s);
    }
    var swallowed = new Set();
    var out = [];
    for (var _a = 0, list_2 = list; _a < list_2.length; _a++) {
        var s = list_2[_a];
        var raw = raws.get(s.sessionId);
        var bg = (raw === null || raw === void 0 ? void 0 : raw.parkedJobId) ? bgByJob.get(raw.parkedJobId) : undefined;
        if (bg) {
            swallowed.add(s.sessionId);
            bg.parked = { sessionId: s.sessionId, name: s.name, status: s.status, statusAt: s.statusAt };
            if (s.tty)
                bg.tty = s.tty;
            if (s.iterm)
                bg.iterm = s.iterm;
            if (s.tabTitle)
                bg.tabTitle = s.tabTitle;
            if (s.isSelf)
                bg.isSelf = true;
        }
    }
    for (var _b = 0, list_3 = list; _b < list_3.length; _b++) {
        var s = list_3[_b];
        if (!swallowed.has(s.sessionId))
            out.push(s);
    }
    return out;
}
/** 畫面上用的名字：Desk 別名 > 使用者用 /rename 取的 > iTerm2 分頁標題（Claude 自動產生的 session title）> 系統派的。 */
function preferredName(s) {
    if (s.nameSource !== 'derived')
        return s.name;
    return s.tabTitle || s.name;
}
/** Notion MCP 回傳的 content[0].text 是 JSON 字串，裡面 results 是一列一個物件。 */
function parseNotionRows(content) {
    var _a;
    var text = (_a = content.find(function (c) { return c.type === 'text' && typeof c.text === 'string'; })) === null || _a === void 0 ? void 0 : _a.text;
    if (!text)
        return [];
    try {
        var d = JSON.parse(text);
        return Array.isArray(d.results) ? d.results : [];
    }
    catch (_b) {
        return [];
    }
}
/** app.notion.com/p/<32 hex> 或 notion.so/...-<32 hex> → 32 hex；對不出來回空字串。 */
function notionId(url) {
    var _a;
    var m = url.replace(/-/g, '').match(/([0-9a-f]{32})(?:\?|$)/i);
    return m ? ((_a = m[1]) !== null && _a !== void 0 ? _a : '').toLowerCase() : '';
}
function str(v) {
    return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
}
function urlList(v) {
    if (typeof v !== 'string' || !v.startsWith('['))
        return [];
    try {
        var arr = JSON.parse(v);
        return Array.isArray(arr) ? arr.filter(function (x) { return typeof x === 'string'; }) : [];
    }
    catch (_a) {
        return [];
    }
}
/** 標題欄（Items）回來時 Markdown 的 [ ] 被反斜線跳脫。 */
function unescapeTitle(s) {
    return s.replace(/\\([\[\]*_`~>#|])/g, '$1').trim();
}
function toCard(row) {
    var url = str(row.url);
    if (!url)
        return undefined;
    return {
        url: url,
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
    };
}
/** 幾分鐘前：45s → 「45s」、7 分 → 「7m」、3 小時 → 「3h」、2 天 → 「2d」。 */
function age(fromMs, nowMs) {
    var s = Math.max(0, Math.round((nowMs - fromMs) / 1000));
    if (s < 60)
        return "".concat(s, "s");
    var m = Math.round(s / 60);
    if (m < 60)
        return "".concat(m, "m");
    var h = Math.round(m / 60);
    if (h < 48)
        return "".concat(h, "h");
    return "".concat(Math.round(h / 24), "d");
}
/** 單引號包起來給 zsh -c 用。 */
function shellQuote(s) {
    return "'".concat(s.replace(/'/g, "'\\''"), "'");
}
/** ~/work/acme-shop 這種短寫。 */
function shortPath(p, home) {
    return home && p.startsWith(home) ? "~".concat(p.slice(home.length)) : p;
}
/** 把字串裁到 n 格寬（中文算 2 格），超過加 …。 */
function fit(s, n) {
    var w = 0;
    var out = '';
    for (var _i = 0, s_1 = s; _i < s_1.length; _i++) {
        var ch = s_1[_i];
        var cw = ch.charCodeAt(0) > 0x2e7f ? 2 : 1;
        if (w + cw > n - 1)
            return out + '…';
        out += ch;
        w += cw;
    }
    return out;
}
exports.STATUSES = [
    'Not started',
    'Pending',
    'In Development',
    'PR Reviewing',
    'Wait to Beta',
    'Wait to Prod',
    'PM Retest',
    'Monitoring',
    'Done',
];
/** 狀態的短寫，排版用。 */
function shortStatus(s) {
    var _a;
    var map = {
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
    };
    return (_a = map[s]) !== null && _a !== void 0 ? _a : s.slice(0, 5);
}
/** P0🔥 - 4hr → P0；High → Hi；沒有 → 空。 */
function shortPriority(p) {
    var m = p.match(/P\d/);
    if (m)
        return m[0];
    if (/^high/i.test(p))
        return 'Hi';
    if (/^med/i.test(p))
        return 'Md';
    if (/^low/i.test(p))
        return 'Lo';
    return p ? p.slice(0, 2) : '';
}
/** session 的 transcript 檔：~/.claude/projects/<cwd 的 / 與 . 換成 ->/<sessionId>.jsonl。 */
function transcriptPath(home, cwd, sessionId) {
    var slug = cwd.replace(/[\/.]/g, '-');
    return "".concat(home, "/.claude/projects/").concat(slug, "/").concat(sessionId, ".jsonl");
}
/** store 裡舊版綁定是純字串（卡片 url）；新版是物件。兩種都收。 */
function normalizeBinding(v) {
    if (typeof v === 'string')
        return v ? { cardUrl: v, name: '', cwd: '', boundAt: 0 } : undefined;
    if (v && typeof v === 'object') {
        var o = v;
        if (typeof o.cardUrl !== 'string' || !o.cardUrl)
            return undefined;
        return {
            cardUrl: o.cardUrl,
            name: typeof o.name === 'string' ? o.name : '',
            cwd: typeof o.cwd === 'string' ? o.cwd : '',
            boundAt: typeof o.boundAt === 'number' ? o.boundAt : 0,
        };
    }
    return undefined;
}
/** 顯示寬度：中日韓與全形算 2 格。 */
function dw(s) {
    var w = 0;
    for (var _i = 0, s_2 = s; _i < s_2.length; _i++) {
        var ch = s_2[_i];
        w += ch.charCodeAt(0) > 0x2e7f ? 2 : 1;
    }
    return w;
}
/** 補空白到 n 格顯示寬度（超過就裁）。 */
function padTo(s, n) {
    var cut = fit(s, n + 1);
    return cut + ' '.repeat(Math.max(0, n - dw(cut)));
}
