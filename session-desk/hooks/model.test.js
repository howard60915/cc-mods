"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
var testing_1 = require("claude-code/testing");
var model_1 = require("./model");
(0, testing_1.test)('it2 session list：tty 對到 iTerm2 session id', function () { return __awaiter(void 0, void 0, void 0, function () {
    var out, map;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        out = [
            '2D77C218-996D-42AA-81D8-1CA187F2E12F\t✳ sales (claude)\t✳ sales (claude)\t237x66\t\\/dev\\/ttys001',
            '8486818A-5F8A-4840-8F3A-84FA7082C45D\t..acoon\\/neptune (-zsh)\t..acoon/neptune (-zsh)\t237x69\t\\/dev\\/ttys007',
            '',
        ].join('\n');
        map = (0, model_1.parseIt2List)(out);
        (0, testing_1.expect)((_a = map.get('ttys001')) === null || _a === void 0 ? void 0 : _a.id).toBe('2D77C218-996D-42AA-81D8-1CA187F2E12F');
        (0, testing_1.expect)((_b = map.get('ttys001')) === null || _b === void 0 ? void 0 : _b.title).toBe('sales');
        (0, testing_1.expect)((_c = map.get('ttys007')) === null || _c === void 0 ? void 0 : _c.id).toBe('8486818A-5F8A-4840-8F3A-84FA7082C45D');
        (0, testing_1.expect)((0, model_1.cleanTabTitle)('◐ Session 總管與 Notion 卡管理 (claude)')).toBe('Session 總管與 Notion 卡管理');
        (0, testing_1.expect)((0, model_1.cleanTabTitle)('✳ search-tuning-phase-0 (claude)')).toBe('search-tuning-phase-0');
        (0, testing_1.expect)((0, model_1.preferredName)({ name: 'pluto-ff', nameSource: 'derived', tabTitle: 'Session 總管' })).toBe('Session 總管');
        (0, testing_1.expect)((0, model_1.preferredName)({ name: '我取的', nameSource: 'user', tabTitle: '自動標題' })).toBe('我取的');
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('ps：pid 對 tty，死掉的不在裡面', function () { return __awaiter(void 0, void 0, void 0, function () {
    var map;
    return __generator(this, function (_a) {
        map = (0, model_1.parsePs)('12425 ttys008\n74290 ttys009\n');
        (0, testing_1.expect)(map.get(12425)).toBe('ttys008');
        (0, testing_1.expect)(map.has(99999)).toBe(false);
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('session json：waiting 帶 waitingFor', function () { return __awaiter(void 0, void 0, void 0, function () {
    var raw;
    return __generator(this, function (_a) {
        raw = (0, model_1.parseSessionJson)(JSON.stringify({ pid: 1, sessionId: 'abc', cwd: '/x', startedAt: 10, kind: 'interactive', name: 'n', status: 'waiting', waitingFor: 'dialog open', statusUpdatedAt: 20 }));
        (0, testing_1.expect)(raw === null || raw === void 0 ? void 0 : raw.status).toBe('waiting');
        (0, testing_1.expect)(raw === null || raw === void 0 ? void 0 : raw.waitingFor).toBe('dialog open');
        (0, testing_1.expect)((0, model_1.parseSessionJson)('not json')).toBeUndefined();
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('Notion row → Card', function () { return __awaiter(void 0, void 0, void 0, function () {
    var card;
    var _a;
    return __generator(this, function (_b) {
        card = (0, model_1.toCard)({
            url: 'https://app.notion.com/p/40297d91ff3781ff981dd2bb99b62817',
            Items: '\\[FE\\] 結帳頁優惠碼輸入框驗證 (US-3)',
            Status: 'Not started',
            Priority: 'P2🟡 - 5wd',
            類型: '功能',
            'Task ID': '9985',
            Sprint: '["https://app.notion.com/p/3e397d91ff378062a86fe17fe23994ed"]',
        });
        (0, testing_1.expect)(card === null || card === void 0 ? void 0 : card.id).toBe('40297d91ff3781ff981dd2bb99b62817');
        (0, testing_1.expect)(card === null || card === void 0 ? void 0 : card.title).toBe('[FE] 結帳頁優惠碼輸入框驗證 (US-3)');
        (0, testing_1.expect)(card === null || card === void 0 ? void 0 : card.sprintIds[0]).toBe('3e397d91ff378062a86fe17fe23994ed');
        (0, testing_1.expect)(card === null || card === void 0 ? void 0 : card.unassigned).toBe(true);
        (0, testing_1.expect)((_a = (0, model_1.toCard)({ url: 'https://app.notion.com/p/40297d91ff3781ff981dd2bb99b62817', Items: 'x', Assign: '["user://3c9d"]' })) === null || _a === void 0 ? void 0 : _a.unassigned).toBe(false);
        (0, testing_1.expect)((0, model_1.notionId)('https://www.notion.so/jtcg/Foo-3e397d91ff378062a86fe17fe23994ed?pvs=4')).toBe('3e397d91ff378062a86fe17fe23994ed');
        (0, testing_1.expect)((0, model_1.unescapeTitle)('a \\[b\\]')).toBe('a [b]');
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('小工具', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        (0, testing_1.expect)((0, model_1.age)(0, 45000)).toBe('45s');
        (0, testing_1.expect)((0, model_1.age)(0, 7 * 60000)).toBe('7m');
        (0, testing_1.expect)((0, model_1.age)(0, 3 * 3600000)).toBe('3h');
        (0, testing_1.expect)((0, model_1.fit)('中文字串很長', 6)).toBe('中文…');
        (0, testing_1.expect)((0, model_1.shellQuote)("it's")).toBe("'it'\\''s'");
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('transcript 路徑與舊版綁定相容', function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        (0, testing_1.expect)((0, model_1.transcriptPath)('/Users/h', '/Users/h/work/acme-shop/.claude/worktrees/x', 'abc')).toBe('/Users/h/.claude/projects/-Users-h-work-acme-shop--claude-worktrees-x/abc.jsonl');
        (0, testing_1.expect)((_a = (0, model_1.normalizeBinding)('https://x/y')) === null || _a === void 0 ? void 0 : _a.cardUrl).toBe('https://x/y');
        (0, testing_1.expect)((_b = (0, model_1.normalizeBinding)({ cardUrl: 'u', name: 'n', cwd: '/c', boundAt: 1 })) === null || _b === void 0 ? void 0 : _b.name).toBe('n');
        (0, testing_1.expect)((0, model_1.normalizeBinding)('')).toBeUndefined();
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('park 出去的工作與它的背景行程合成一列', function () { return __awaiter(void 0, void 0, void 0, function () {
    var raws, base, list, merged;
    var _a, _b;
    return __generator(this, function (_c) {
        raws = new Map([
            ['shell', { pid: 1, sessionId: 'shell', cwd: '/x', startedAt: 0, kind: 'interactive', name: 'pluto-5e', nameSource: 'derived', parkedJobId: 'job1' }],
            ['job1', { pid: 2, sessionId: 'job1', cwd: '/x', startedAt: 0, kind: 'bg', name: '會員摘要', nameSource: 'auto', jobId: 'job1' }],
            ['other', { pid: 3, sessionId: 'other', cwd: '/x', startedAt: 0, kind: 'interactive', name: 'pluto-ff', nameSource: 'derived' }],
        ]);
        base = function (id, kind, name, status) { return ({
            sessionId: id, pid: 0,
            name: name,
            nameSource: 'derived',
            kind: kind,
            cwd: '/x',
            status: status,
            statusAt: 5, startedAt: 0, isSelf: false,
        }); };
        list = (0, model_1.mergeParked)([
            __assign(__assign({}, base('shell', 'interactive', 'pluto-5e', 'idle')), { tty: 'ttys003', iterm: 'ITERM-3', tabTitle: '會員摘要' }),
            __assign(__assign({}, base('job1', 'bg', '會員摘要', 'busy')), { tty: 'ttys009' }),
            __assign(__assign({}, base('other', 'interactive', 'pluto-ff', 'busy')), { tty: 'ttys008', iterm: 'ITERM-8' }),
        ], raws);
        (0, testing_1.expect)(list.map(function (s) { return s.sessionId; })).toEqual(['job1', 'other']);
        merged = list[0];
        (0, testing_1.expect)(merged.status).toBe('busy');
        (0, testing_1.expect)(merged.iterm).toBe('ITERM-3');
        (0, testing_1.expect)((_a = merged.parked) === null || _a === void 0 ? void 0 : _a.sessionId).toBe('shell');
        (0, testing_1.expect)((_b = merged.parked) === null || _b === void 0 ? void 0 : _b.status).toBe('idle');
        return [2 /*return*/];
    });
}); });
