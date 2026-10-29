"use strict";
// session-desk：Session 總管。
// 上半：本機所有 Claude Code session（~/.claude/sessions/*.json 的 busy／idle／waiting），
//       Enter 跳到它的 iTerm2 分頁（it2 session focus）；關掉但還綁著卡的 session 列在下面，Enter 開新分頁 resume。
// 下半：Sprint Board 上指派給我、還沒結案的卡（Notion plugin 的 MCP，view 模式不吃配額）。
// 兩邊可以綁在一起（存 $.store，跨 session 共用），卡片可以改 Status、開瀏覽器、開新 session；session 可以取別名。
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = void 0;
var claude_code_1 = require("claude-code");
var model_1 = require("./model");
var themes_1 = require("./themes");
var PANE = 'session-desk';
var TITLE = 'Desk';
var NOTION = 'plugin:Notion:notion';
/** 預設值；實際值從 plugin.json 的 userConfig 讀（register 裡的 options）。 */
var DEFAULT_VIEW_URL = 'https://www.notion.so/40097d91ff3781ed859befc87e22173e?v=40797d91ff378161baf7000cfa5b04ec';
var DEFAULT_IT2 = '/Applications/iTerm.app/Contents/Resources/utilities/it2';
var SESSIONS_MS = 5000;
var CARDS_MS = 5 * 60000;
var CARDS_CACHE_MS = 4 * 60000;
var RETRY_AFTER_FAIL_MS = 30000;
var SPRINT_CACHE_MS = 6 * 3600000;
var SPRINT_FAIL_CACHE_MS = 30 * 60000;
var STORE_BINDINGS = 'bindings';
var STORE_ALIASES = 'aliases';
var STORE_CARDS_CACHE = 'cardsCache';
var STORE_SPRINTS = 'sprints';
var sessions = (0, claude_code_1.atom)({ plugin: 'session-desk', key: 'sessions' }, [], { shape: 'sessions-3' });
var cards = (0, claude_code_1.atom)({ plugin: 'session-desk', key: 'cards' }, [], { shape: 'cards-2' });
var meta = (0, claude_code_1.atom)({ plugin: 'session-desk', key: 'meta' }, {
    loadedAt: 0,
    loading: false,
    onlyCurrent: true,
});
var sprints = (0, claude_code_1.atom)({ plugin: 'session-desk', key: 'sprints' }, {});
var bindings = (0, claude_code_1.atom)({ plugin: 'session-desk', key: 'bindings' }, {}, { shape: 'bindings-2' });
var aliases = (0, claude_code_1.atom)({ plugin: 'session-desk', key: 'aliases' }, {});
var sel = (0, claude_code_1.atom)({ plugin: 'session-desk', key: 'sel' }, { picking: false, naming: false, sending: false, showAll: false, pickingSprint: false, note: '', noteAt: 0 }, { shape: 'sel-5' });
var tick = (0, claude_code_1.atom)({ plugin: 'session-desk', key: 'tick' }, 0);
// ------------------------------------------------------------------ 這個 session 的工作狀態（hot reload 會清掉）
var home = '';
var selfId = '';
var cardsTimer;
var retryTimer;
/** 本 session 剛被取的別名：下一個 prompt 送出時經 classic hook 回給引擎當 sessionTitle。 */
var pendingTitle;
var pal = (0, themes_1.palette)('Claude Code');
var autoOpen = true;
/** Notion 上「指派給我、未結案」的 view（view 模式查詢不吃方案配額）。 */
var VIEW_URL = DEFAULT_VIEW_URL;
/** iTerm2 的 it2 CLI。 */
var IT2 = DEFAULT_IT2;
function note($, text) {
    return __awaiter(this, void 0, void 0, function () {
        var at;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $.clock.now()];
                case 1:
                    at = _a.sent();
                    return [4 /*yield*/, (0, claude_code_1.update)($, sel, function (s) { return (__assign(__assign({}, s), { note: text, noteAt: at })); })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// ------------------------------------------------------------------ store：綁定與別名
function loadBindings($) {
    return __awaiter(this, void 0, void 0, function () {
        var stored, out, _i, _a, _b, k, v, b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, $.store.get(STORE_BINDINGS)];
                case 1:
                    stored = (_c.sent());
                    out = {};
                    for (_i = 0, _a = Object.entries(stored !== null && stored !== void 0 ? stored : {}); _i < _a.length; _i++) {
                        _b = _a[_i], k = _b[0], v = _b[1];
                        b = (0, model_1.normalizeBinding)(v);
                        if (b)
                            out[k] = b;
                    }
                    return [2 /*return*/, out];
            }
        });
    });
}
function saveBindings($, fn) {
    return __awaiter(this, void 0, void 0, function () {
        var next, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = fn;
                    return [4 /*yield*/, loadBindings($)];
                case 1:
                    next = _a.apply(void 0, [_b.sent()]);
                    return [4 /*yield*/, $.store.set(STORE_BINDINGS, next)];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, (0, claude_code_1.update)($, bindings, function () { return next; })];
                case 3:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function loadAliases($) {
    return __awaiter(this, void 0, void 0, function () {
        var stored, out, _i, _a, _b, k, v;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, $.store.get(STORE_ALIASES)];
                case 1:
                    stored = (_c.sent());
                    out = {};
                    for (_i = 0, _a = Object.entries(stored !== null && stored !== void 0 ? stored : {}); _i < _a.length; _i++) {
                        _b = _a[_i], k = _b[0], v = _b[1];
                        if (typeof v === 'string' && v)
                            out[k] = v;
                    }
                    return [2 /*return*/, out];
            }
        });
    });
}
function displayName(s, a) {
    var _a;
    return (_a = a[s.sessionId]) !== null && _a !== void 0 ? _a : (0, model_1.preferredName)(s);
}
// ------------------------------------------------------------------ sessions
function refreshSessions($) {
    return __awaiter(this, void 0, void 0, function () {
        var dir, names, _a, raws, list, ttyByPid_1, ps, _b, _i, raws_1, r, itermByTty_1, it2_1, _c, alive, b, a;
        var _this = this;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    dir = "".concat(home, "/.claude/sessions");
                    names = [];
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, , 5]);
                    return [4 /*yield*/, $.fs.list(dir)];
                case 2:
                    names = (_d.sent()).filter(function (f) { return f.kind === 'file' && f.name.endsWith('.json'); }).map(function (f) { return f.name; });
                    return [3 /*break*/, 5];
                case 3:
                    _a = _d.sent();
                    return [4 /*yield*/, (0, claude_code_1.update)($, sessions, function () { return []; })];
                case 4:
                    _d.sent();
                    return [2 /*return*/];
                case 5: return [4 /*yield*/, Promise.all(names.map(function (n) { return __awaiter(_this, void 0, void 0, function () {
                        var _a, _b;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 2, , 3]);
                                    _a = model_1.parseSessionJson;
                                    return [4 /*yield*/, $.fs.read("".concat(dir, "/").concat(n))];
                                case 1: return [2 /*return*/, _a.apply(void 0, [_c.sent()])];
                                case 2:
                                    _b = _c.sent();
                                    return [2 /*return*/, undefined];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); }))];
                case 6:
                    raws = (_d.sent()).filter(function (r) { return r !== undefined; });
                    list = [];
                    if (!(raws.length > 0)) return [3 /*break*/, 15];
                    ttyByPid_1 = new Map();
                    _d.label = 7;
                case 7:
                    _d.trys.push([7, 9, , 10]);
                    return [4 /*yield*/, $.process.run(['ps', '-o', 'pid=,tty=', '-p', raws.map(function (r) { return String(r.pid); }).join(',')], {
                            timeoutMs: 3000,
                        })];
                case 8:
                    ps = _d.sent();
                    ttyByPid_1 = (0, model_1.parsePs)(ps.stdout);
                    return [3 /*break*/, 10];
                case 9:
                    _b = _d.sent();
                    for (_i = 0, raws_1 = raws; _i < raws_1.length; _i++) {
                        r = raws_1[_i];
                        ttyByPid_1.set(r.pid, '');
                    }
                    return [3 /*break*/, 10];
                case 10:
                    itermByTty_1 = new Map();
                    _d.label = 11;
                case 11:
                    _d.trys.push([11, 13, , 14]);
                    return [4 /*yield*/, $.process.run([IT2, 'session', 'list'], { timeoutMs: 4000 })];
                case 12:
                    it2_1 = _d.sent();
                    if (it2_1.exitCode === 0)
                        itermByTty_1 = (0, model_1.parseIt2List)(it2_1.stdout);
                    return [3 /*break*/, 14];
                case 13:
                    _c = _d.sent();
                    return [3 /*break*/, 14];
                case 14:
                    alive = raws.filter(function (r) { return ttyByPid_1.has(r.pid); });
                    list = (0, model_1.mergeParked)(alive.map(function (r) { return (0, model_1.toDeskSession)(r, ttyByPid_1.get(r.pid) || undefined, itermByTty_1, selfId); }), new Map(alive.map(function (r) { return [r.sessionId, r]; }))).sort(function (a, b) { return rank(a) - rank(b) || b.statusAt - a.statusAt; });
                    _d.label = 15;
                case 15: return [4 /*yield*/, (0, claude_code_1.update)($, sessions, function () { return list; })
                    // 綁定與別名存在 store，別的 session 也會改，每輪重讀。
                ];
                case 16:
                    _d.sent();
                    return [4 /*yield*/, loadBindings($)];
                case 17:
                    b = _d.sent();
                    return [4 /*yield*/, (0, claude_code_1.update)($, bindings, function () { return b; })];
                case 18:
                    _d.sent();
                    return [4 /*yield*/, loadAliases($)];
                case 19:
                    a = _d.sent();
                    return [4 /*yield*/, (0, claude_code_1.update)($, aliases, function () { return a; })];
                case 20:
                    _d.sent();
                    return [4 /*yield*/, (0, claude_code_1.update)($, tick, function (n) { return n + 1; })];
                case 21:
                    _d.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function rank(s) {
    if (s.status === 'waiting')
        return 0;
    if (s.status === 'busy')
        return 1;
    if (s.status === 'idle')
        return 2;
    return 3;
}
function refreshCards($_1) {
    return __awaiter(this, arguments, void 0, function ($, force) {
        var cached_1, now, list_1, cursor, page, res, parsed, _i, _a, row, card, at_1, err_1, msg_1, hadCards_1;
        if (force === void 0) { force = false; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!!force) return [3 /*break*/, 7];
                    return [4 /*yield*/, $.store.get(STORE_CARDS_CACHE)];
                case 1:
                    cached_1 = (_b.sent());
                    return [4 /*yield*/, $.clock.now()];
                case 2:
                    now = _b.sent();
                    if (!(cached_1 && Array.isArray(cached_1.cards) && now - cached_1.at < CARDS_CACHE_MS)) return [3 /*break*/, 7];
                    return [4 /*yield*/, (0, claude_code_1.update)($, cards, function () { return cached_1.cards; })];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, (0, claude_code_1.update)($, meta, function (m) { return (__assign(__assign({}, m), { loadedAt: cached_1.at, loading: false })); })];
                case 4:
                    _b.sent();
                    return [4 /*yield*/, resolveSprint($, cached_1.cards)];
                case 5:
                    _b.sent();
                    return [4 /*yield*/, pruneBindings($, cached_1.cards)];
                case 6:
                    _b.sent();
                    return [2 /*return*/];
                case 7: return [4 /*yield*/, (0, claude_code_1.update)($, meta, function (m) { return (__assign(__assign({}, m), { loading: true })); })];
                case 8:
                    _b.sent();
                    _b.label = 9;
                case 9:
                    _b.trys.push([9, 20, , 23]);
                    list_1 = [];
                    cursor = void 0;
                    page = 0;
                    _b.label = 10;
                case 10:
                    if (!(page < 5)) return [3 /*break*/, 13];
                    return [4 /*yield*/, notion($, 'notion-query-data-sources', {
                            data: __assign({ mode: 'view', view_url: VIEW_URL, page_size: 100 }, (cursor ? { start_cursor: cursor } : {})),
                        })];
                case 11:
                    res = _b.sent();
                    if (res.isError)
                        throw new Error(firstText(res.content) || 'Notion 查詢失敗');
                    parsed = JSON.parse(firstText(res.content));
                    for (_i = 0, _a = Array.isArray(parsed.results) ? parsed.results : []; _i < _a.length; _i++) {
                        row = _a[_i];
                        card = (0, model_1.toCard)(row);
                        if (card)
                            list_1.push(card);
                    }
                    if (!parsed.has_more || !parsed.next_cursor)
                        return [3 /*break*/, 13];
                    cursor = parsed.next_cursor;
                    _b.label = 12;
                case 12:
                    page += 1;
                    return [3 /*break*/, 10];
                case 13:
                    list_1.sort(function (a, b) { return cardRank(a) - cardRank(b) || Number(b.taskId) - Number(a.taskId); });
                    return [4 /*yield*/, $.clock.now()];
                case 14:
                    at_1 = _b.sent();
                    return [4 /*yield*/, $.store.set(STORE_CARDS_CACHE, { at: at_1, cards: list_1 })];
                case 15:
                    _b.sent();
                    return [4 /*yield*/, (0, claude_code_1.update)($, cards, function () { return list_1; })];
                case 16:
                    _b.sent();
                    return [4 /*yield*/, (0, claude_code_1.update)($, meta, function (m) {
                            var next = __assign(__assign({}, m), { loadedAt: at_1, loading: false });
                            delete next.error;
                            return next;
                        })];
                case 17:
                    _b.sent();
                    if (retryTimer) {
                        retryTimer.cancel();
                        retryTimer = undefined;
                    }
                    return [4 /*yield*/, resolveSprint($, list_1, force)];
                case 18:
                    _b.sent();
                    return [4 /*yield*/, pruneBindings($, list_1)];
                case 19:
                    _b.sent();
                    return [3 /*break*/, 23];
                case 20:
                    err_1 = _b.sent();
                    msg_1 = err_1 instanceof Error ? err_1.message : String(err_1);
                    dumpDebug($, { thrown: msg_1, at: new Date().toISOString() });
                    return [4 /*yield*/, (0, claude_code_1.read)($, cards)];
                case 21:
                    hadCards_1 = (_b.sent()).length > 0;
                    return [4 /*yield*/, (0, claude_code_1.update)($, meta, function (m) { return (__assign(__assign({}, m), { loading: false, error: (0, model_1.fit)("".concat(msg_1).concat(hadCards_1 ? '（顯示的是上一次的清單）' : ''), 160) })); })];
                case 22:
                    _b.sent();
                    if (!retryTimer) {
                        retryTimer = $.clock.after(RETRY_AFTER_FAIL_MS, function () {
                            retryTimer = undefined;
                            void refreshCards($, true);
                        });
                    }
                    return [3 /*break*/, 23];
                case 23: return [2 /*return*/];
            }
        });
    });
}
/** 綁的卡已經不在清單上（Done／Archived／改指派）就把綁定清掉；活著或關掉的 session 都一樣。 */
function pruneBindings($, list) {
    return __awaiter(this, void 0, void 0, function () {
        var urls, b, stale;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    urls = new Set(list.map(function (c) { return c.url; }));
                    return [4 /*yield*/, loadBindings($)];
                case 1:
                    b = _a.sent();
                    stale = Object.entries(b).filter(function (_a) {
                        var v = _a[1];
                        return !urls.has(v.cardUrl);
                    });
                    if (stale.length === 0)
                        return [2 /*return*/];
                    return [4 /*yield*/, saveBindings($, function (cur) {
                            var next = __assign({}, cur);
                            for (var _i = 0, stale_1 = stale; _i < stale_1.length; _i++) {
                                var k = stale_1[_i][0];
                                delete next[k];
                            }
                            return next;
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/** 哪個 Sprint 是 Current：卡上掛的 Sprint 頁各讀一次（fetch 不吃配額），結果存 store 6 小時。 */
function resolveSprint($_1, list_2) {
    return __awaiter(this, arguments, void 0, function ($, list, force) {
        var ids, now, known, changed, _i, ids_1, id, hit, res, outer, m, props, _a, mirror, _b, ids_2, id, current;
        var _c, _d, _e, _f, _g, _h, _j;
        if (force === void 0) { force = false; }
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    ids = __spreadArray([], new Set(list.flatMap(function (c) { return c.sprintIds; })), true);
                    if (ids.length === 0)
                        return [2 /*return*/];
                    return [4 /*yield*/, $.clock.now()];
                case 1:
                    now = _k.sent();
                    return [4 /*yield*/, $.store.get(STORE_SPRINTS)];
                case 2:
                    known = (_c = (_k.sent())) !== null && _c !== void 0 ? _c : {};
                    changed = false;
                    _i = 0, ids_1 = ids;
                    _k.label = 3;
                case 3:
                    if (!(_i < ids_1.length)) return [3 /*break*/, 8];
                    id = ids_1[_i];
                    hit = known[id];
                    // 讀成功的記 6 小時；讀失敗的（被擋、網路）也記 30 分鐘，免得每輪都撞牆、每撞一次對話區就多一行。
                    if (hit && now - hit.at < (hit.status ? SPRINT_CACHE_MS : SPRINT_FAIL_CACHE_MS) && !(force && !hit.status))
                        return [3 /*break*/, 7];
                    _k.label = 4;
                case 4:
                    _k.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, notion($, 'notion-fetch', { id: id })];
                case 5:
                    res = _k.sent();
                    if (res.isError) {
                        known[id] = { status: '', name: '', at: now };
                        changed = true;
                        return [3 /*break*/, 7];
                    }
                    outer = JSON.parse(firstText(res.content));
                    m = ((_d = outer.text) !== null && _d !== void 0 ? _d : '').match(/<properties>\s*([\s\S]*?)\s*<\/properties>/);
                    if (!m)
                        return [3 /*break*/, 7];
                    props = JSON.parse((_e = m[1]) !== null && _e !== void 0 ? _e : '{}');
                    known[id] = {
                        status: typeof props['Sprint status'] === 'string' ? props['Sprint status'] : '',
                        name: typeof props['Sprint name'] === 'string' ? props['Sprint name'] : 'Sprint',
                        at: now,
                    };
                    changed = true;
                    return [3 /*break*/, 7];
                case 6:
                    _a = _k.sent();
                    known[id] = { status: '', name: '', at: now };
                    changed = true;
                    return [3 /*break*/, 7];
                case 7:
                    _i++;
                    return [3 /*break*/, 3];
                case 8:
                    if (!changed) return [3 /*break*/, 10];
                    return [4 /*yield*/, $.store.set(STORE_SPRINTS, known)];
                case 9:
                    _k.sent();
                    _k.label = 10;
                case 10:
                    mirror = {};
                    for (_b = 0, ids_2 = ids; _b < ids_2.length; _b++) {
                        id = ids_2[_b];
                        mirror[id] = { name: (_g = (_f = known[id]) === null || _f === void 0 ? void 0 : _f.name) !== null && _g !== void 0 ? _g : '', status: (_j = (_h = known[id]) === null || _h === void 0 ? void 0 : _h.status) !== null && _j !== void 0 ? _j : '' };
                    }
                    return [4 /*yield*/, (0, claude_code_1.update)($, sprints, function () { return mirror; })];
                case 11:
                    _k.sent();
                    current = ids.map(function (id) { return [id, known[id]]; }).find(function (_a) {
                        var info = _a[1];
                        return (info === null || info === void 0 ? void 0 : info.status) === 'Current';
                    });
                    return [4 /*yield*/, (0, claude_code_1.update)($, meta, function (m) {
                            var next = __assign({}, m);
                            if (current && current[1])
                                next.sprint = { id: current[0], name: current[1].name };
                            else
                                delete next.sprint;
                            return next;
                        })];
                case 12:
                    _k.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/** 除錯：寫進 Claude Code 的 debug log（`claude --debug` 看得到），不落地檔案。 */
function dumpDebug($, data) {
    try {
        $.ui.log("session-desk: ".concat(JSON.stringify(data).slice(0, 4000)), { to: 'debug' });
    }
    catch (_a) {
        // 寫不進去就算了
    }
}
var TRANSIENT = /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|socket|fetch failed|network|timed? ?out|\b50[234]\b|rate.?limit|429/i;
var RETRY_WAITS_MS = [1500, 4000, 8000];
/**
 * Notion MCP 呼叫的包裝：
 * - auto mode 的分類器對計時器發出的呼叫沒有判定，第一次會拒；照它的提示原樣重發一次。
 * - 網路抖動（ECONNRESET、逾時、5xx、429）最多再試三次，間隔拉長。
 */
function notion($, tool, args) {
    return __awaiter(this, void 0, void 0, function () {
        var verdictRetried, attempt, res, err_2, msg;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    verdictRetried = false;
                    attempt = 0;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 8]);
                    return [4 /*yield*/, $.mcp.call(NOTION, tool, args)
                        // 伺服器端用 isError 回的暫時性錯誤也算
                    ];
                case 2:
                    res = _a.sent();
                    if (!(res.isError && attempt < RETRY_WAITS_MS.length && TRANSIENT.test(firstText(res.content)))) return [3 /*break*/, 4];
                    return [4 /*yield*/, $.clock.sleep(RETRY_WAITS_MS[attempt])];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 8];
                case 4: return [2 /*return*/, res];
                case 5:
                    err_2 = _a.sent();
                    msg = err_2 instanceof Error ? err_2.message : String(err_2);
                    if (!verdictRetried && /gave no verdict|Issue the action again/.test(msg)) {
                        verdictRetried = true;
                        return [3 /*break*/, 8];
                    }
                    if (!(attempt < RETRY_WAITS_MS.length && TRANSIENT.test(msg))) return [3 /*break*/, 7];
                    return [4 /*yield*/, $.clock.sleep(RETRY_WAITS_MS[attempt])];
                case 6:
                    _a.sent();
                    return [3 /*break*/, 8];
                case 7: throw err_2;
                case 8:
                    attempt += 1;
                    return [3 /*break*/, 1];
                case 9: return [2 /*return*/];
            }
        });
    });
}
function firstText(content) {
    var _a, _b;
    return (_b = (_a = content.find(function (c) { return c.type === 'text' && c.text; })) === null || _a === void 0 ? void 0 : _a.text) !== null && _b !== void 0 ? _b : '';
}
var CARD_ORDER = ['PR Reviewing', 'In Development', 'In Progress', 'In Diversity Testing', 'PM Retest', 'Wait to Beta', 'Wait to Prod', 'Monitoring', 'Pending', 'Pending Assignment', 'In Design', 'Not started'];
function cardRank(c) {
    var i = CARD_ORDER.indexOf(c.status);
    return i < 0 ? CARD_ORDER.length : i;
}
function setStatus($, card, status) {
    return __awaiter(this, void 0, void 0, function () {
        var res, cached, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 7, , 9]);
                    return [4 /*yield*/, notion($, 'notion-update-page', {
                            page_id: card.url,
                            command: 'update_properties',
                            properties: { Status: status },
                            allow_async: false,
                        })];
                case 1:
                    res = _a.sent();
                    if (res.isError)
                        throw new Error(firstText(res.content) || 'update 失敗');
                    return [4 /*yield*/, (0, claude_code_1.update)($, cards, function (list) { return list.map(function (c) { return (c.url === card.url ? __assign(__assign({}, c), { status: status }) : c); }); })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, $.store.get(STORE_CARDS_CACHE)];
                case 3:
                    cached = (_a.sent());
                    if (!cached) return [3 /*break*/, 5];
                    return [4 /*yield*/, $.store.set(STORE_CARDS_CACHE, __assign(__assign({}, cached), { cards: cached.cards.map(function (c) { return (c.url === card.url ? __assign(__assign({}, c), { status: status }) : c); }) }))];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5: return [4 /*yield*/, note($, "#".concat(card.taskId, " \u2192 ").concat(status))];
                case 6:
                    _a.sent();
                    return [3 /*break*/, 9];
                case 7:
                    err_3 = _a.sent();
                    return [4 /*yield*/, note($, "\u6539\u72C0\u614B\u5931\u6557\uFF1A".concat((0, model_1.fit)(err_3 instanceof Error ? err_3.message : String(err_3), 50)))];
                case 8:
                    _a.sent();
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    });
}
// ------------------------------------------------------------------ 動作
function it2(argv, $) {
    return __awaiter(this, void 0, void 0, function () {
        var r, err_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, $.process.run(__spreadArray([IT2], argv, true), { timeoutMs: 6000 })];
                case 1:
                    r = _a.sent();
                    return [2 /*return*/, r.exitCode === 0 ? undefined : (0, model_1.fit)(r.stderr || r.stdout || "exit ".concat(r.exitCode), 50)];
                case 2:
                    err_4 = _a.sent();
                    return [2 /*return*/, (0, model_1.fit)(String(err_4), 50)];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function focusSession($, s, a) {
    return __awaiter(this, void 0, void 0, function () {
        var name, err;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, (0, claude_code_1.update)($, sel, function (x) { return (__assign(__assign({}, x), { sessionId: s.sessionId, picking: false, naming: false })); })];
                case 1:
                    _b.sent();
                    name = displayName(s, a);
                    if (!s.isSelf) return [3 /*break*/, 3];
                    return [4 /*yield*/, note($, "".concat(name, " \u5C31\u662F\u9019\u500B\u8996\u7A97"))];
                case 2:
                    _b.sent();
                    return [2 /*return*/];
                case 3:
                    if (!!s.iterm) return [3 /*break*/, 5];
                    return [4 /*yield*/, note($, "".concat(name, " \u5C0D\u4E0D\u5230 iTerm2 \u5206\u9801\uFF08tty ").concat((_a = s.tty) !== null && _a !== void 0 ? _a : '?', "\uFF09"))];
                case 4:
                    _b.sent();
                    return [2 /*return*/];
                case 5: return [4 /*yield*/, it2(['session', 'focus', s.iterm], $)];
                case 6:
                    err = _b.sent();
                    return [4 /*yield*/, note($, err ? "it2 focus \u5931\u6557\uFF1A".concat(err) : "\u2192 ".concat(name))];
                case 7:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/** 關掉的 session：開新分頁、回原目錄 claude --resume。 */
function resumeSession($, id, b) {
    return __awaiter(this, void 0, void 0, function () {
        var cmd, err;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, claude_code_1.update)($, sel, function (x) { return (__assign(__assign({}, x), { sessionId: id, picking: false, naming: false })); })];
                case 1:
                    _a.sent();
                    if (!!b.cwd) return [3 /*break*/, 3];
                    return [4 /*yield*/, note($, '這筆綁定沒記目錄（舊版綁的），無法 resume')];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
                case 3: return [4 /*yield*/, $.fs.exists((0, model_1.transcriptPath)(home, b.cwd, id))];
                case 4:
                    if (!!(_a.sent())) return [3 /*break*/, 6];
                    return [4 /*yield*/, note($, "\u627E\u4E0D\u5230 ".concat(b.name || id.slice(0, 6), " \u7684 transcript\uFF0C\u7121\u6CD5 resume"))];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
                case 6:
                    cmd = "cd ".concat((0, model_1.shellQuote)(b.cwd), " && exec claude --resume ").concat((0, model_1.shellQuote)(id));
                    return [4 /*yield*/, it2(['tab', 'new', '--command', "/bin/zsh -lc ".concat((0, model_1.shellQuote)(cmd))], $)];
                case 7:
                    err = _a.sent();
                    return [4 /*yield*/, note($, err ? "it2 tab new \u5931\u6557\uFF1A".concat(err) : "\u27F2 \u5DF2\u958B\u65B0\u5206\u9801 resume ".concat(b.name || id.slice(0, 6)))];
                case 8:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function bind($) {
    return __awaiter(this, void 0, void 0, function () {
        var s, card, ss, a, at;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, claude_code_1.read)($, sel)];
                case 1:
                    s = _a.sent();
                    return [4 /*yield*/, (0, claude_code_1.read)($, cards)];
                case 2:
                    card = (_a.sent()).find(function (c) { return c.url === s.cardUrl; });
                    return [4 /*yield*/, (0, claude_code_1.read)($, sessions)];
                case 3:
                    ss = (_a.sent()).find(function (x) { return x.sessionId === s.sessionId; });
                    if (!(!ss || !card)) return [3 /*break*/, 5];
                    return [4 /*yield*/, note($, '先選一個活著的 session（Enter）和一張卡（Enter），再按 b')];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
                case 5: return [4 /*yield*/, (0, claude_code_1.read)($, aliases)];
                case 6:
                    a = _a.sent();
                    return [4 /*yield*/, $.clock.now()];
                case 7:
                    at = _a.sent();
                    return [4 /*yield*/, saveBindings($, function (b) {
                            var _a;
                            return (__assign(__assign({}, b), (_a = {}, _a[ss.sessionId] = { cardUrl: card.url, name: displayName(ss, a), cwd: ss.cwd, boundAt: at }, _a)));
                        })];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, note($, "".concat(displayName(ss, a), " \u21C4 #").concat(card.taskId))];
                case 9:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function unbind($) {
    return __awaiter(this, void 0, void 0, function () {
        var s, id;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, claude_code_1.read)($, sel)];
                case 1:
                    s = _a.sent();
                    if (!!s.sessionId) return [3 /*break*/, 3];
                    return [4 /*yield*/, note($, '先選一個 session 再按 u')];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
                case 3:
                    id = s.sessionId;
                    return [4 /*yield*/, saveBindings($, function (b) {
                            var next = __assign({}, b);
                            delete next[id];
                            return next;
                        })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, note($, '已解除綁定')];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function rename($, name) {
    return __awaiter(this, void 0, void 0, function () {
        var s, id, trimmed, list, live, cur, b, bound;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, claude_code_1.read)($, sel)];
                case 1:
                    s = _a.sent();
                    return [4 /*yield*/, (0, claude_code_1.update)($, sel, function (x) { return (__assign(__assign({}, x), { naming: false })); })];
                case 2:
                    _a.sent();
                    id = s.sessionId;
                    if (!id)
                        return [2 /*return*/];
                    trimmed = name.trim();
                    return [4 /*yield*/, (0, claude_code_1.read)($, sessions)];
                case 3:
                    list = _a.sent();
                    live = list.find(function (x) { return x.sessionId === id; });
                    return [4 /*yield*/, loadAliases($)];
                case 4:
                    cur = _a.sent();
                    if (trimmed)
                        cur[id] = trimmed;
                    else
                        delete cur[id];
                    return [4 /*yield*/, $.store.set(STORE_ALIASES, cur)];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, (0, claude_code_1.update)($, aliases, function () { return cur; })
                        // 綁定裡記的名稱跟著改
                    ];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, loadBindings($)];
                case 7:
                    b = _a.sent();
                    bound = b[id];
                    if (!bound) return [3 /*break*/, 9];
                    return [4 /*yield*/, saveBindings($, function (all) {
                            var _a;
                            return (__assign(__assign({}, all), (_a = {}, _a[id] = __assign(__assign({}, bound), { name: trimmed || (live === null || live === void 0 ? void 0 : live.name) || bound.name }), _a)));
                        })];
                case 8:
                    _a.sent();
                    _a.label = 9;
                case 9:
                    if (!!trimmed) return [3 /*break*/, 11];
                    return [4 /*yield*/, note($, '已清掉別名')];
                case 10:
                    _a.sent();
                    return [2 /*return*/];
                case 11:
                    if (!(live === null || live === void 0 ? void 0 : live.iterm)) return [3 /*break*/, 13];
                    return [4 /*yield*/, it2(['session', 'set-name', trimmed, '--session', live.iterm], $)];
                case 12:
                    _a.sent();
                    _a.label = 13;
                case 13:
                    if (live === null || live === void 0 ? void 0 : live.isSelf)
                        pendingTitle = trimmed;
                    return [4 /*yield*/, note($, (live === null || live === void 0 ? void 0 : live.isSelf) ? "\u5DF2\u547D\u540D ".concat(trimmed, "\uFF08Claude \u7684\u540D\u7A31\u5728\u4E0B\u4E00\u53E5\u9001\u51FA\u5F8C\u8DDF\u4E0A\uFF09") : "\u5DF2\u547D\u540D ".concat(trimmed))];
                case 14:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/** 送一段文字給選到的 session（活著、不是自己）。對方會把它當 peer 訊息排進對話。 */
function sendTo($, text) {
    return __awaiter(this, void 0, void 0, function () {
        var body, s, list, a, target, sent, err_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, claude_code_1.update)($, sel, function (x) { return (__assign(__assign({}, x), { sending: false })); })];
                case 1:
                    _a.sent();
                    body = text.trim();
                    if (!body)
                        return [2 /*return*/];
                    return [4 /*yield*/, (0, claude_code_1.read)($, sel)];
                case 2:
                    s = _a.sent();
                    return [4 /*yield*/, (0, claude_code_1.read)($, sessions)];
                case 3:
                    list = _a.sent();
                    return [4 /*yield*/, (0, claude_code_1.read)($, aliases)];
                case 4:
                    a = _a.sent();
                    target = list.find(function (x) { return x.sessionId === s.sessionId; });
                    if (!!target) return [3 /*break*/, 6];
                    return [4 /*yield*/, note($, s.sessionId ? '這個 session 沒在跑，送不過去' : '先選一個 session')];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
                case 6:
                    if (!target.isSelf) return [3 /*break*/, 8];
                    return [4 /*yield*/, note($, '這就是目前的 session')];
                case 7:
                    _a.sent();
                    return [2 /*return*/];
                case 8:
                    _a.trys.push([8, 11, , 13]);
                    return [4 /*yield*/, $.session.send({ to: { sessionId: target.sessionId }, text: body })];
                case 9:
                    sent = _a.sent();
                    return [4 /*yield*/, note($, sent.isDelivered ? "\u2713 \u5DF2\u9001\u7D66 ".concat(displayName(target, a), "\uFF08").concat((0, model_1.dw)(body), " \u5B57\uFF09") : "\u9001\u4E0D\u51FA\u53BB\uFF1A".concat((0, model_1.fit)(sent.reason, 50)))];
                case 10:
                    _a.sent();
                    return [3 /*break*/, 13];
                case 11:
                    err_5 = _a.sent();
                    return [4 /*yield*/, note($, "\u9001\u4E0D\u51FA\u53BB\uFF1A".concat((0, model_1.fit)(err_5 instanceof Error ? err_5.message : String(err_5), 50)))];
                case 12:
                    _a.sent();
                    return [3 /*break*/, 13];
                case 13: return [2 /*return*/];
            }
        });
    });
}
/** 把滑鼠選取的那段文字送給選到的 session。 */
function pasteSelection($) {
    return __awaiter(this, void 0, void 0, function () {
        var picked, me, a, from;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $.ui.selection()];
                case 1:
                    picked = _a.sent();
                    if (!(!picked || !picked.text.trim())) return [3 /*break*/, 3];
                    return [4 /*yield*/, note($, '先用滑鼠在對話區選一段文字，再按 p')];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
                case 3: return [4 /*yield*/, (0, claude_code_1.read)($, sessions)];
                case 4:
                    me = (_a.sent()).find(function (x) { return x.isSelf; });
                    return [4 /*yield*/, (0, claude_code_1.read)($, aliases)];
                case 5:
                    a = _a.sent();
                    from = me ? displayName(me, a) : 'Desk';
                    return [4 /*yield*/, sendTo($, "\uFF08\u5F9E ".concat(from, " \u8F49\u8CBC\u7684 context\uFF09\n").concat(picked.text))];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function openCard($) {
    return __awaiter(this, void 0, void 0, function () {
        var s, card;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, claude_code_1.read)($, sel)];
                case 1:
                    s = _a.sent();
                    return [4 /*yield*/, (0, claude_code_1.read)($, cards)];
                case 2:
                    card = (_a.sent()).find(function (c) { return c.url === s.cardUrl; });
                    if (!!card) return [3 /*break*/, 4];
                    return [4 /*yield*/, note($, '先選一張卡再按 o')];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
                case 4: return [4 /*yield*/, $.process.run(['open', card.url], { timeoutMs: 5000 })];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, note($, "\u958B\u555F #".concat(card.taskId))];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/** 用選到的卡在 iTerm2 開一個新分頁、同一個目錄起 claude，開場就是這張卡。 */
function newSession($) {
    return __awaiter(this, void 0, void 0, function () {
        var s, card, cwd, prompt, cmd, err;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, claude_code_1.read)($, sel)];
                case 1:
                    s = _a.sent();
                    return [4 /*yield*/, (0, claude_code_1.read)($, cards)];
                case 2:
                    card = (_a.sent()).find(function (c) { return c.url === s.cardUrl; });
                    if (!!card) return [3 /*break*/, 4];
                    return [4 /*yield*/, note($, '先選一張卡再按 n')];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
                case 4: return [4 /*yield*/, $.session.cwd()];
                case 5:
                    cwd = _a.sent();
                    prompt = "\u8655\u7406 Notion \u5361 #".concat(card.taskId, "\u300C").concat(card.title, "\u300D\uFF1A").concat(card.url, "\n\u5148\u8B80\u5361\u7247\uFF0C\u6574\u7406\u8981\u505A\u4EC0\u9EBC\u3001\u518D\u8DDF\u6211\u78BA\u8A8D\u65B9\u5411\u3002");
                    cmd = "cd ".concat((0, model_1.shellQuote)(cwd), " && exec claude ").concat((0, model_1.shellQuote)(prompt));
                    return [4 /*yield*/, it2(['tab', 'new', '--command', "/bin/zsh -lc ".concat((0, model_1.shellQuote)(cmd))], $)];
                case 6:
                    err = _a.sent();
                    return [4 /*yield*/, note($, err ? "it2 tab new \u5931\u6557\uFF1A".concat(err) : "\u5DF2\u958B\u65B0\u5206\u9801\uFF1A#".concat(card.taskId))];
                case 7:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// ------------------------------------------------------------------ 註冊
var register = function (on, options) {
    pal = (0, themes_1.palette)(options.theme);
    autoOpen = options.autoOpen !== 'off';
    VIEW_URL = typeof options.viewUrl === 'string' && options.viewUrl.trim() ? options.viewUrl.trim() : DEFAULT_VIEW_URL;
    IT2 = typeof options.it2Path === 'string' && options.it2Path.trim() ? options.it2Path.trim() : DEFAULT_IT2;
    on('session.start', function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, next(e)];
                case 1:
                    result = _b.sent();
                    return [4 /*yield*/, $.env.get('HOME')];
                case 2:
                    home = (_a = (_b.sent())) !== null && _a !== void 0 ? _a : '';
                    return [4 /*yield*/, $.session.id()];
                case 3:
                    selfId = _b.sent();
                    return [4 /*yield*/, $.command.register({ name: 'desk', description: 'Session 總管：本機 session 與指派給我的 Notion 卡' })];
                case 4:
                    _b.sent();
                    return [4 /*yield*/, refreshSessions($)];
                case 5:
                    _b.sent();
                    $.clock.every(SESSIONS_MS, function () { return void refreshSessions($); });
                    void refreshCards($);
                    cardsTimer = $.clock.every(CARDS_MS, function () { return void refreshCards($); });
                    if (autoOpen)
                        void $.ui.open(paneArgs(false));
                    return [2 /*return*/, result];
            }
        });
    }); });
    on('command.run', { command: 'desk' }, function ($) { return __awaiter(void 0, void 0, void 0, function () {
        var opened;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $.ui.open(paneArgs(true))];
                case 1:
                    opened = _a.sent();
                    if (!opened.isPlaced)
                        return [2 /*return*/, { text: "Desk \u958B\u4E0D\u51FA\u4F86\uFF1A".concat(opened.reason) }];
                    void refreshSessions($);
                    return [2 /*return*/, { text: 'Desk 開了。Enter 跳 session／選卡、b 綁卡、m 命名、t 改狀態、Esc 回來。' }];
            }
        });
    }); });
    // 本 session 被取別名後，下一個 prompt 把名稱交給引擎（UserPromptSubmit 的 sessionTitle）。
    on('classic.UserPromptSubmit', function (_$, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var result, sessionTitle;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, next(e)];
                case 1:
                    result = _a.sent();
                    if (!pendingTitle)
                        return [2 /*return*/, result];
                    sessionTitle = pendingTitle;
                    pendingTitle = undefined;
                    return [2 /*return*/, __assign(__assign({}, result), { sessionTitle: sessionTitle })];
            }
        });
    }); });
    on('ui.render', { component: 'Pane', requestId: PANE }, function ($, e) { return __awaiter(void 0, void 0, void 0, function () {
        var table, Box, Text, Button, Select, Input, list, cardList, m, sp, b, a, s, now, width, inner, cardByUrl, alive, closed, ownerByCard, _i, list_2, ss, bound, _a, closed_1, _b, id, bound, sprintLabel, shown, scopeLabel, counts, _c, list_3, ss, nameW, selected, selectedClosed, dimProps, textProps, header, footer, row, empty, statusGlyph, statusTone, key;
        var _d, _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    table = $.ui.resolve(e);
                    Box = table.Box, Text = table.Text, Button = table.Button;
                    Select = 'Select' in table ? table.Select : undefined;
                    Input = 'Input' in table ? table.Input : undefined;
                    return [4 /*yield*/, (0, claude_code_1.read)($, sessions)];
                case 1:
                    list = _j.sent();
                    return [4 /*yield*/, (0, claude_code_1.read)($, cards)];
                case 2:
                    cardList = _j.sent();
                    return [4 /*yield*/, (0, claude_code_1.read)($, meta)];
                case 3:
                    m = _j.sent();
                    return [4 /*yield*/, (0, claude_code_1.read)($, sprints)];
                case 4:
                    sp = _j.sent();
                    return [4 /*yield*/, (0, claude_code_1.read)($, bindings)];
                case 5:
                    b = _j.sent();
                    return [4 /*yield*/, (0, claude_code_1.read)($, aliases)];
                case 6:
                    a = _j.sent();
                    return [4 /*yield*/, (0, claude_code_1.read)($, sel)];
                case 7:
                    s = _j.sent();
                    return [4 /*yield*/, (0, claude_code_1.read)($, tick)]; // 訂閱：每輪 refresh 重畫，idle 幾分鐘才會跟著走
                case 8:
                    _j.sent(); // 訂閱：每輪 refresh 重畫，idle 幾分鐘才會跟著走
                    return [4 /*yield*/, $.clock.now()];
                case 9:
                    now = _j.sent();
                    width = Math.max(44, e.props.bodyColumns);
                    inner = width - 4 // 「│ 」與「 │」
                    ;
                    cardByUrl = new Map(cardList.map(function (c) { return [c.url, c]; }));
                    alive = new Set(list.flatMap(function (x) { return (x.parked ? [x.sessionId, x.parked.sessionId] : [x.sessionId]); }));
                    closed = Object.entries(b).filter(function (_a) {
                        var id = _a[0];
                        return !alive.has(id);
                    });
                    ownerByCard = new Map();
                    for (_i = 0, list_2 = list; _i < list_2.length; _i++) {
                        ss = list_2[_i];
                        bound = b[ss.sessionId];
                        if (bound)
                            ownerByCard.set(bound.cardUrl, { name: displayName(ss, a), isClosed: false });
                    }
                    for (_a = 0, closed_1 = closed; _a < closed_1.length; _a++) {
                        _b = closed_1[_a], id = _b[0], bound = _b[1];
                        if (!ownerByCard.has(bound.cardUrl))
                            ownerByCard.set(bound.cardUrl, { name: (_e = (_d = a[id]) !== null && _d !== void 0 ? _d : bound.name) !== null && _e !== void 0 ? _e : id.slice(0, 6), isClosed: true });
                    }
                    sprintLabel = function (id) { var _a; return ((_a = sp[id]) === null || _a === void 0 ? void 0 : _a.name) || "Sprint ".concat(id.slice(0, 6)); };
                    shown = m.viewSprint
                        ? cardList.filter(function (c) { return c.sprintIds.includes(m.viewSprint); })
                        : m.onlyCurrent && m.sprint
                            ? cardList.filter(function (c) { return c.sprintIds.includes(m.sprint.id); })
                            : cardList;
                    scopeLabel = m.viewSprint ? sprintLabel(m.viewSprint) : m.onlyCurrent && m.sprint ? m.sprint.name : '全部';
                    counts = { waiting: 0, busy: 0, idle: 0 };
                    for (_c = 0, list_3 = list; _c < list_3.length; _c++) {
                        ss = list_3[_c];
                        if (ss.status in counts)
                            counts[ss.status] += 1;
                    }
                    nameW = Math.min(24, Math.max(10, Math.floor(inner * 0.36)));
                    selected = list.find(function (x) { return x.sessionId === s.sessionId; });
                    selectedClosed = closed.find(function (_a) {
                        var id = _a[0];
                        return id === s.sessionId;
                    });
                    dimProps = pal.muted ? { color: pal.muted } : { dimColor: true };
                    textProps = pal.text ? { color: pal.text } : {};
                    header = function (title, count, right) {
                        var left = "\u256D\u2500 ".concat(title, " \u00B7 ").concat(count, " ");
                        var rightText = right && right.length > 0 ? " ".concat(right.map(function (r) { return r.text; }).join(' '), " ") : '';
                        var fill = Math.max(1, width - (0, model_1.dw)(left) - (0, model_1.dw)(rightText) - 2);
                        return (<Box width={width} overflow="hidden">
          <Text color={pal.border}>╭─ </Text>
          <Text bold {...textProps}>{title}</Text>
          <Text {...dimProps}> · {count} </Text>
          <Text color={pal.border}>{'─'.repeat(fill)}</Text>
          {right && right.length > 0 && (<Text>
              {' '}
              {right.map(function (r, i) { return (<Text color={r.color} {...(r.color ? {} : dimProps)}>
                  {i > 0 ? ' ' : ''}
                  {r.text}
                </Text>); })}{' '}
            </Text>)}
          <Text color={pal.border}>─╮</Text>
        </Box>);
                    };
                    footer = function () { return <Text color={pal.border}>{'╰' + '─'.repeat(Math.max(1, width - 2)) + '╯'}</Text>; };
                    row = function (children, tail) { return (<Box width={width} overflow="hidden">
        <Text color={pal.border}>│ </Text>
        {children}
        <Box flexGrow={1}/>
        {tail}
        <Text color={pal.border}> │</Text>
      </Box>); };
                    empty = function (text) { return row(<Text {...dimProps}>{text}</Text>); };
                    statusGlyph = function (st) { return (st === 'busy' ? '●' : st === 'waiting' ? '◐' : st === 'idle' ? '○' : '·'); };
                    statusTone = function (st) { return (st === 'busy' ? pal.busy : st === 'waiting' ? pal.waiting : pal.closed); };
                    key = function (k, label, onPress) { return (<Button key={"k:".concat(k)} plain hotkey={k} onPress={onPress}>
        <Text {...dimProps}>{label}</Text>
      </Button>); };
                    return [2 /*return*/, (<Box flexDirection="column">
        {header('Sessions', String(list.length), [
                                { text: "\u25CF".concat(counts.busy), color: pal.busy },
                                { text: "\u25D0".concat(counts.waiting), color: pal.waiting },
                                { text: "\u25CB".concat(counts.idle) },
                            ])}
        {list.length === 0 && empty('沒有活著的 session。')}
        {list.map(function (ss) {
                                var bound = b[ss.sessionId] ? cardByUrl.get(b[ss.sessionId].cardUrl) : undefined;
                                var picked = s.sessionId === ss.sessionId;
                                var tone = statusTone(ss.status);
                                var detail = ss.status === 'waiting' && ss.waitingFor ? "".concat((0, model_1.fit)(ss.waitingFor, 14), " ") : '';
                                var line = row(<Button key={"s:".concat(ss.sessionId)} plain onPress={function () { return void focusSession($, ss, a); }}>
              <Text color={pal.accent}>{picked ? '▸ ' : '  '}</Text>
              <Text color={tone}>{statusGlyph(ss.status)} </Text>
              <Text bold={ss.isSelf} color={picked ? pal.accent : pal.text}>{(0, model_1.padTo)(displayName(ss, a), nameW)} </Text>
              <Text color={tone}>{ss.status.padEnd(8)}</Text>
              <Text {...dimProps}>
                {detail}
                {(0, model_1.age)(ss.statusAt, now).padStart(3)}
                {ss.kind === 'bg' ? (ss.parked ? ' ⇢bg' : ' bg') : ''}
                {ss.iterm ? '' : ' ⌀'}
              </Text>
            </Button>, bound ? <Text color={pal.ok}>⧉ #{bound.taskId}</Text> : undefined);
                                if (!picked)
                                    return line;
                                return (<Box flexDirection="column">
              {line}
              {row(<Text {...dimProps}>      {(0, model_1.fit)((0, model_1.shortPath)(ss.cwd, home), inner - 6)}</Text>)}
              {ss.parked &&
                                        row(<Text {...dimProps}>
                    {'      ↳ 互動層 '}
                    {(0, model_1.fit)(ss.parked.name, 18)} 在等（{ss.parked.status} {(0, model_1.age)(ss.parked.statusAt, now)}）
                  </Text>)}
            </Box>);
                            })}
        {footer()}

        {closed.length > 0 && header('已關閉・有綁卡', String(closed.length), [{ text: 'Enter resume' }])}
        {closed.map(function (_a) {
                                var _b, _c;
                                var id = _a[0], bound = _a[1];
                                var card = cardByUrl.get(bound.cardUrl);
                                var picked = s.sessionId === id;
                                var name = (_c = (_b = a[id]) !== null && _b !== void 0 ? _b : bound.name) !== null && _c !== void 0 ? _c : id.slice(0, 6);
                                return row(<Button key={"z:".concat(id)} plain onPress={function () { return void resumeSession($, id, bound); }}>
              <Text color={pal.accent}>{picked ? '▸ ' : '  '}</Text>
              <Text color={pal.closed}>⟲ </Text>
              <Text color={picked ? pal.accent : pal.closed}>{(0, model_1.padTo)(name || id.slice(0, 6), nameW)} </Text>
              <Text color={pal.closed}>{'closed'.padEnd(8)}</Text>
              <Text {...dimProps}>
                {bound.boundAt ? (0, model_1.age)(bound.boundAt, now).padStart(3) : '   '} {(0, model_1.fit)((0, model_1.shortPath)(bound.cwd, home), Math.max(6, inner - nameW - 24))}
              </Text>
            </Button>, card ? <Text color={pal.ok}>⧉ #{card.taskId}</Text> : undefined);
                            })}
        {closed.length > 0 && footer()}

        {header('Cards', "".concat(scopeLabel, " \u00B7 ").concat(shown.length), m.loading ? [{ text: '載入中…' }] : m.loadedAt ? [{ text: "".concat((0, model_1.age)(m.loadedAt, now), " \u524D") }] : undefined)}
        {m.error && row(<Text color={pal.waiting}>{(0, model_1.fit)(m.error, inner)}</Text>)}
        {shown.length === 0 && !m.loading && empty(m.error ? '載入失敗，按 r 重試。' : '沒有指派給你、還沒結案的卡。')}
        {shown.map(function (c) {
                                var picked = s.cardUrl === c.url;
                                var owner = ownerByCard.get(c.url);
                                var titleW = Math.max(12, inner - 2 - 6 - 6 - 4);
                                var line = row(<Button key={"c:".concat(c.id)} plain onPress={function () { return void (0, claude_code_1.update)($, sel, function (x) { return (__assign(__assign({}, x), { cardUrl: c.url, picking: false, naming: false })); }); }}>
              <Text color={pal.accent}>{picked ? '▸ ' : '  '}</Text>
              <Text {...dimProps}>{c.taskId.padStart(5)} </Text>
              <Text color={statusColor(c.status)}>{(0, model_1.shortStatus)(c.status).padEnd(5)} </Text>
              <Text color={/P0|P1/.test(c.priority) ? pal.waiting : pal.muted} dimColor={!pal.muted && !/P0|P1/.test(c.priority)}>
                {(0, model_1.shortPriority)(c.priority).padEnd(3)}
              </Text>
              <Text color={picked ? pal.accent : pal.text}>{(0, model_1.fit)(c.title, titleW - (c.unassigned ? 7 : 0))}</Text>
              {c.unassigned && <Text color={pal.busy}> ⚑待指派</Text>}
            </Button>);
                                if (!owner)
                                    return line;
                                return (<Box flexDirection="column">
              {line}
              {row(<Text color={owner.isClosed ? pal.closed : pal.ok}>
                  {'                    '}⌁ {(0, model_1.fit)(owner.name, 20)}
                  {owner.isClosed ? '（已關閉）' : ''}
                </Text>)}
            </Box>);
                            })}
        {footer()}

        {Select && s.pickingSprint && (<Box marginTop={1} flexDirection="column">
            <Text {...dimProps}>要看哪個 Sprint：</Text>
            <Select key="sprint" autoFocus options={__spreadArray(__spreadArray([
                                    { value: 'all', label: '全部' }
                                ], (m.sprint ? [{ value: 'current', label: "\u672C Sprint\uFF08".concat(m.sprint.name, "\uFF09") }] : []), true), Object.keys(sp)
                                    .sort(function (x, y) { return sprintLabel(y).localeCompare(sprintLabel(x)); })
                                    .map(function (id) { var _a; return ({ value: id, label: "".concat(sprintLabel(id)).concat(((_a = sp[id]) === null || _a === void 0 ? void 0 : _a.status) ? " \u00B7 ".concat(sp[id].status) : '') }); }), true)} value={(_f = m.viewSprint) !== null && _f !== void 0 ? _f : (m.onlyCurrent ? 'current' : 'all')} onSelect={function (value) {
                                    void (0, claude_code_1.update)($, sel, function (x) { return (__assign(__assign({}, x), { pickingSprint: false })); });
                                    void (0, claude_code_1.update)($, meta, function (x) {
                                        var next = __assign({}, x);
                                        if (value === 'all') {
                                            next.onlyCurrent = false;
                                            delete next.viewSprint;
                                        }
                                        else if (value === 'current') {
                                            next.onlyCurrent = true;
                                            delete next.viewSprint;
                                        }
                                        else {
                                            next.viewSprint = value;
                                        }
                                        return next;
                                    });
                                }}/>
          </Box>)}

        {Select && s.picking && s.cardUrl && cardByUrl.has(s.cardUrl) && (<Box marginTop={1} flexDirection="column">
            <Text {...dimProps}>#{cardByUrl.get(s.cardUrl).taskId} 新狀態：</Text>
            <Select key="status" autoFocus options={model_1.STATUSES.map(function (v) { return ({ value: v }); })} value={cardByUrl.get(s.cardUrl).status} onSelect={function (value) {
                                    var card = cardByUrl.get(s.cardUrl);
                                    void (0, claude_code_1.update)($, sel, function (x) { return (__assign(__assign({}, x), { picking: false })); });
                                    if (card && value !== card.status)
                                        void setStatus($, card, value);
                                }}/>
          </Box>)}

        {Input && s.sending && selected && !selected.isSelf && (<Box marginTop={1} flexDirection="column">
            <Input key="send" label={"\u50B3\u7D66 ".concat(displayName(selected, a))} placeholder="要給那個 session 的 context 或指示，Enter 送出" rows={3} autoFocus onSubmit={function (value) { return void sendTo($, value); }}/>
          </Box>)}

        {Input && s.naming && s.sessionId && (selected || selectedClosed) && (<Box marginTop={1} flexDirection="column">
            <Input key="alias" label={"\u547D\u540D ".concat(selected ? displayName(selected, a) : (_g = selectedClosed === null || selectedClosed === void 0 ? void 0 : selectedClosed[1].name) !== null && _g !== void 0 ? _g : '', "\uFF08\u7559\u7A7A\u6E05\u6389\u5225\u540D\uFF09")} value={(_h = a[s.sessionId]) !== null && _h !== void 0 ? _h : ''} placeholder="例如：9983 預約回覆發送" autoFocus onSubmit={function (value) { return void rename($, value); }}/>
          </Box>)}

        {(function () {
                                var _a, _b, _c;
                                // ---- 操作列：情境式。選到什麼就列什麼；a 切成全部。
                                var selCard = s.cardUrl ? cardByUrl.get(s.cardUrl) : undefined;
                                var selName = selected ? displayName(selected, a) : selectedClosed ? ((_a = a[selectedClosed[0]]) !== null && _a !== void 0 ? _a : selectedClosed[1].name) : undefined;
                                var boundHere = s.sessionId ? b[s.sessionId] : undefined;
                                var canBind = Boolean(selected && selCard);
                                var sep = <Text color={pal.border}> │ </Text>;
                                var group = function (items) {
                                    var kept = items.filter(function (x) { return Boolean(x); });
                                    return kept.length === 0 ? undefined : (<Box columnGap={2}>{kept}</Box>);
                                };
                                var sessionOps = group([
                                    selected && !selected.isSelf && key('s', '傳訊息', function () { return void (0, claude_code_1.update)($, sel, function (x) { return (__assign(__assign({}, x), { sending: !x.sending, naming: false, picking: false, pickingSprint: false })); }); }),
                                    selected && !selected.isSelf && key('p', '貼選取', function () { return void pasteSelection($); }),
                                    (selected || selectedClosed) && key('m', '命名', function () { return void (0, claude_code_1.update)($, sel, function (x) { return (__assign(__assign({}, x), { naming: !x.naming, picking: false, sending: false, pickingSprint: false })); }); }),
                                ]);
                                var cardOps = group([
                                    selCard && key('o', '開卡片', function () { return void openCard($); }),
                                    selCard && key('t', '改狀態', function () { return void (0, claude_code_1.update)($, sel, function (x) { return (__assign(__assign({}, x), { picking: !x.picking, naming: false, sending: false, pickingSprint: false })); }); }),
                                    selCard && key('n', '新 session', function () { return void newSession($); }),
                                ]);
                                var bindOps = group([
                                    canBind && !boundHere && key('b', "\u7D81\u5B9A ".concat((0, model_1.fit)(selName !== null && selName !== void 0 ? selName : '', 14), " \u21C4 #").concat(selCard.taskId), function () { return void bind($); }),
                                    canBind && boundHere && boundHere.cardUrl !== selCard.url && key('b', "\u6539\u7D81 #".concat(selCard.taskId), function () { return void bind($); }),
                                    boundHere && key('u', "\u89E3\u9664 #".concat((_c = (_b = cardByUrl.get(boundHere.cardUrl)) === null || _b === void 0 ? void 0 : _b.taskId) !== null && _c !== void 0 ? _c : ''), function () { return void unbind($); }),
                                ]);
                                var viewOps = group([
                                    key('c', m.viewSprint || !m.onlyCurrent ? '本 Sprint' : '看全部卡', function () {
                                        return void (0, claude_code_1.update)($, meta, function (x) {
                                            var next = __assign(__assign({}, x), { onlyCurrent: x.viewSprint ? true : !x.onlyCurrent });
                                            delete next.viewSprint;
                                            return next;
                                        });
                                    }),
                                    key('v', '選 Sprint', function () { return void (0, claude_code_1.update)($, sel, function (x) { return (__assign(__assign({}, x), { pickingSprint: !x.pickingSprint, picking: false, naming: false, sending: false })); }); }),
                                    key('r', '重整', function () {
                                        void refreshSessions($);
                                        void refreshCards($, true);
                                    }),
                                    key('a', s.showAll ? '精簡' : '全部操作', function () { return void (0, claude_code_1.update)($, sel, function (x) { return (__assign(__assign({}, x), { showAll: !x.showAll })); }); }),
                                ]);
                                var title = s.showAll
                                    ? '全部操作'
                                    : selName || selCard
                                        ? "\u5DF2\u9078".concat(selName ? " ".concat((0, model_1.fit)(selName, 18)) : '').concat(selCard ? " \u00B7 #".concat(selCard.taskId) : '')
                                        : '選一列 session 或卡片開始';
                                var rule = (<Box width={width} overflow="hidden">
              <Text color={pal.border}>── </Text>
              <Text {...dimProps}>{title}</Text>
              <Text color={pal.border}> {'─'.repeat(Math.max(1, width - (0, model_1.dw)(title) - 5))}</Text>
            </Box>);
                                if (s.showAll) {
                                    var all = function (keys) { return (<Box columnGap={2}>{keys.map(function (_a) {
                                        var k = _a[0], label = _a[1], fn = _a[2];
                                        return key(k, label, fn);
                                    })}</Box>); };
                                    var noop = function (text) { return function () { return void note($, text); }; };
                                    return (<Box marginTop={1} flexDirection="column">
                {rule}
                <Box>
                  <Text {...dimProps}>{(0, model_1.padTo)('Session', 8)}</Text>
                  {all([
                                            ['s', '傳訊息', selected && !selected.isSelf ? function () { return void (0, claude_code_1.update)($, sel, function (x) { return (__assign(__assign({}, x), { sending: !x.sending, naming: false, picking: false, pickingSprint: false })); }); } : noop('先選一個活著的 session')],
                                            ['p', '貼選取', function () { return void pasteSelection($); }],
                                            ['m', '命名', selected || selectedClosed ? function () { return void (0, claude_code_1.update)($, sel, function (x) { return (__assign(__assign({}, x), { naming: !x.naming, picking: false, sending: false, pickingSprint: false })); }); } : noop('先選一個 session')],
                                        ])}
                </Box>
                <Box>
                  <Text {...dimProps}>{(0, model_1.padTo)('卡片', 8)}</Text>
                  {all([
                                            ['o', '開卡片', function () { return void openCard($); }],
                                            ['t', '改狀態', selCard ? function () { return void (0, claude_code_1.update)($, sel, function (x) { return (__assign(__assign({}, x), { picking: !x.picking, naming: false, sending: false, pickingSprint: false })); }); } : noop('先選一張卡')],
                                            ['n', '新 session', function () { return void newSession($); }],
                                        ])}
                </Box>
                <Box>
                  <Text {...dimProps}>{(0, model_1.padTo)('綁定', 8)}</Text>
                  {all([
                                            ['b', '綁定', function () { return void bind($); }],
                                            ['u', '解除', function () { return void unbind($); }],
                                        ])}
                </Box>
                <Box>
                  <Text {...dimProps}>{(0, model_1.padTo)('檢視', 8)}</Text>
                  {viewOps}
                </Box>
              </Box>);
                                }
                                var groups = [sessionOps, cardOps, bindOps, viewOps].filter(function (g) { return Boolean(g); });
                                return (<Box marginTop={1} flexDirection="column">
              {rule}
              <Box width={width} flexWrap="wrap">
                {groups.map(function (g, i) { return (<Box>
                    {i > 0 && sep}
                    {g}
                  </Box>); })}
              </Box>
            </Box>);
                            })()}
        <Text {...dimProps}>{s.note && now - s.noteAt < 20000 ? s.note : e.props.isFocused ? 'Enter 跳過去／resume／選卡 · Esc 回到輸入框' : 'ctrl+x tab 或點一下進來操作'}</Text>
      </Box>)];
            }
        });
    }); });
    on('ui.close', { id: PANE }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (e.origin.kind === 'unload' && cardsTimer)
                cardsTimer.cancel();
            return [2 /*return*/, next(e)];
        });
    }); });
};
exports.register = register;
function statusColor(status) {
    if (status === 'PR Reviewing')
        return pal.busy;
    if (status === 'In Development' || status === 'In Progress')
        return pal.accent;
    if (status.startsWith('Wait'))
        return pal.ok;
    if (status === 'Not started')
        return pal.closed;
    return pal.text;
}
function paneArgs(focus) {
    return __assign(__assign({ id: PANE, title: TITLE, columns: 72 }, (focus ? { focus: true } : {})), (pal.bg ? { backgroundColor: pal.bg } : {}));
}
