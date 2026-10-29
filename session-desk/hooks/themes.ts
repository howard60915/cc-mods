// 配色。預設「Claude Code」用引擎的語意色（跟著亮／暗主題）；「終端機」用 ANSI 色名；
// 其餘是內建色碼（名單與色碼沿用 enil／slk 的主題表）。在 /plugin 的 session-desk 設定裡切。

export type Palette = {
  /** 選取、熱鍵字母。 */
  accent: string
  /** 一般文字；沒有就用終端機預設。 */
  text?: string
  /** 次要文字；沒有就用 dimColor。 */
  muted?: string
  border: string
  /** pane 底色；沒有就不塗。 */
  bg?: string
  busy: string
  waiting: string
  ok: string
  closed: string
}

export const CLAUDE = 'Claude Code'
export const TERMINAL = '終端機'

const claudeCode: Palette = {
  accent: 'claude',
  border: 'subtle',
  busy: 'warning',
  waiting: 'error',
  ok: 'success',
  closed: 'inactive',
}

const terminal: Palette = {
  accent: 'cyan',
  border: 'gray',
  busy: 'yellow',
  waiting: 'red',
  ok: 'green',
  closed: 'gray',
}

// （名稱, primary, accent, warning, error, background, surface, sidebar, text, muted, border）
const BUILTIN: [string, string[]][] = [
  ['Catppuccin Mocha', ['#89B4FA', '#A6E3A1', '#F9E2AF', '#F38BA8', '#1E1E2E', '#313244', '#0E0E16', '#CDD6F4', '#6C7086', '#45475A']],
  ['Catppuccin Latte', ['#1E66F5', '#40A02B', '#DF8E1D', '#D20F39', '#EFF1F5', '#E6E9EF', '#DCE0E8', '#4C4F69', '#6C6F85', '#BCC0CC']],
  ['Tokyo Night', ['#7AA2F7', '#9ECE6A', '#E0AF68', '#F7768E', '#1A1B26', '#24283B', '#262838', '#C0CAF5', '#565F89', '#3B4261']],
  ['Dracula', ['#BD93F9', '#50FA7B', '#FFB86C', '#FF5555', '#282A36', '#343746', '#14151C', '#F8F8F2', '#6272A4', '#44475A']],
  ['Gruvbox Dark', ['#83A598', '#B8BB26', '#FABD2F', '#FB4934', '#282828', '#3C3836', '#181818', '#EBDBB2', '#928374', '#504945']],
  ['Nord', ['#88C0D0', '#A3BE8C', '#EBCB8B', '#BF616A', '#2E3440', '#3B4252', '#1B2028', '#ECEFF4', '#7B88A1', '#4C566A']],
  ['One Dark', ['#61AFEF', '#98C379', '#E5C07B', '#E06C75', '#282C34', '#2C313C', '#1A1D23', '#ABB2BF', '#636D83', '#3E4452']],
  ['Rosé Pine', ['#C4A7E7', '#9CCFD8', '#F6C177', '#EB6F92', '#191724', '#1F1D2E', '#262433', '#E0DEF4', '#6E6A86', '#26233A']],
  ['Solarized Dark', ['#268BD2', '#859900', '#B58900', '#DC322F', '#002B36', '#073642', '#001820', '#839496', '#586E75', '#073642']],
  ['Solarized Light', ['#268BD2', '#859900', '#B58900', '#DC322F', '#FDF6E3', '#EEE8D5', '#EEE8D5', '#657B83', '#93A1A1', '#EEE8D5']],
  ['Everforest Dark', ['#7FBBB3', '#A7C080', '#DBBC7F', '#E67E80', '#2D353B', '#343F44', '#1E2429', '#D3C6AA', '#859289', '#3D484D']],
  ['Kanagawa', ['#7FB4CA', '#98BB6C', '#E6C384', '#E46876', '#1F1F28', '#2A2A37', '#0C0C10', '#DCD7BA', '#727169', '#363646']],
  ['GitHub Dark', ['#58A6FF', '#3FB950', '#D29922', '#F85149', '#0D1117', '#161B22', '#1C2128', '#C9D1D9', '#8B949E', '#30363D']],
  ['Monokai', ['#66D9EF', '#A6E22E', '#E6DB74', '#F92672', '#272822', '#3E3D32', '#181811', '#F8F8F2', '#75715E', '#49483E']],
  ['Cyberpunk Neon', ['#0ABDC6', '#00FF9C', '#FCEE0C', '#EA00D9', '#000B1E', '#0D1B2A', '#0D1B2A', '#D7D7D7', '#7E7E8E', '#133E7C']],
]

export const THEME_NAMES: readonly string[] = [CLAUDE, TERMINAL, ...BUILTIN.map(([n]) => n)]

/** 名稱 → 配色；不認得的名稱退回 Claude Code。 */
export function palette(name: unknown): Palette {
  if (name === TERMINAL) return terminal
  const hit = BUILTIN.find(([n]) => n === name)
  if (!hit) return claudeCode
  const c = hit[1]
  return {
    accent: c[0]!,
    ok: c[1]!,
    busy: c[2]!,
    waiting: c[3]!,
    bg: c[4],
    text: c[7],
    muted: c[8],
    border: c[9]!,
    closed: c[8]!,
  }
}
