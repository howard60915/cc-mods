"""把 it2 擷取的 pane 文字畫成 SVG：每格依終端欄位定位（CJK 2 格），依內容上色。"""
import re, sys, unicodedata, html

CW, CH, PAD = 9.6, 22, 18  # 每格寬、列高、邊距（px）
FONT = "'SF Mono', Menlo, 'JetBrains Mono', 'Fira Code', Consolas, 'PingFang TC', 'Hiragino Sans', 'Noto Sans CJK TC', monospace"
C = dict(bg='#1e1e2e', text='#cdd6f4', muted='#6c7086', border='#45475a', accent='#89b4fa',
         busy='#f9e2af', waiting='#f38ba8', ok='#a6e3a1', warn='#fab387', closed='#7f849c', title='#cdd6f4')

def w(ch): return 2 if unicodedata.east_asian_width(ch) in ('W', 'F') else 1

STATUS = {'busy': 'busy', 'waiting': 'waiting', 'idle': 'closed', 'closed': 'closed', 'shell': 'closed'}
SHORT = {'pr': 'busy', 'dev': 'accent', 'prog': 'accent', 'beta': 'ok', 'prod': 'ok', 'todo': 'closed', 'pend': 'text', 'p-asg': 'text', 'retst': 'text', 'mon': 'text'}

def style_line(line):
    """回傳每格 (char, color, bold) 的清單。"""
    cells = [[ch, 'text', False] for ch in line]
    def paint(start, end, color, bold=False):
        for k in range(start, min(end, len(cells))):
            cells[k][1] = color; cells[k][2] = bold
    for m in re.finditer(r'[╭╮╰╯│─]+', line): paint(m.start(), m.end(), 'border')
    # 框標題
    m = re.match(r'╭─ (\S[^·]*?) · ([^ ─]+) ', line)
    if m:
        paint(m.start(1), m.end(1), 'title', True); paint(m.start(2) - 3, m.end(2) + 1, 'muted')
        for mm in re.finditer(r'●\d+|◐\d+|○\d+|Enter resume|\d+m 前|載入中…', line):
            col = 'busy' if mm.group().startswith('●') else 'waiting' if mm.group().startswith('◐') else 'muted'
            paint(mm.start(), mm.end(), col)
        return cells
    if line.startswith('── '):
        paint(0, len(line), 'border'); m = re.search(r'── (.+?) ─', line)
        if m: paint(m.start(1), m.end(1), 'muted')
        return cells
    # 操作列：x: 標籤
    if re.search(r'\b[a-z]: ', line) and not line.startswith('│'):
        paint(0, len(line), 'muted')
        for mm in re.finditer(r'\b([a-z]): ', line): paint(mm.start(1), mm.end(1), 'accent', True)
        for mm in re.finditer(r'│', line): paint(mm.start(), mm.end(), 'border')
        return cells
    if line.startswith('ctrl+x'): paint(0, len(line), 'muted'); return cells
    # 內容列
    body = line[2:-2] if line.startswith('│') else line
    off = 2 if line.startswith('│') else 0
    for mm in re.finditer(r'▸', line): paint(mm.start(), mm.end(), 'accent', True)
    picked = '▸' in line
    m = re.search(r'([●◐○⟲·]) (\S.*?)\s{2,}(busy|idle|waiting|closed|shell)\b', line)
    if m:
        st = STATUS[m.group(3)]
        paint(m.start(1), m.end(1), st); paint(m.start(3), m.end(3), st)
        paint(m.start(2), m.end(2), 'accent' if picked else 'text', False)
        paint(m.end(3), len(line) - 2, 'muted')
        for mm in re.finditer(r'⧉ #\d+', line): paint(mm.start(), mm.end(), 'ok')
        for mm in re.finditer(r'⇢bg', line): paint(mm.start(), mm.end(), 'muted')
        return cells
    m = re.match(r'│ ▍(.+?) · (\d+)', line)
    if m:
        paint(2, 3, 'accent'); paint(m.start(1), m.end(1), 'title', True); paint(m.end(1), m.end(2), 'muted'); return cells
    m = re.match(r'│ [▸ ] ?(\d{4,5}) (\S+)\s+(P\d|Hi|Md|Lo)?\s*(.*?)\s*│?$', line)
    if m:
        paint(m.start(1), m.end(1), 'muted')
        paint(m.start(2), m.end(2), SHORT.get(m.group(2), 'text'))
        if m.group(3): paint(m.start(3), m.end(3), 'waiting' if m.group(3) in ('P0', 'P1') else 'muted')
        paint(m.start(4), m.end(4), 'accent' if picked else 'text')
        mm = re.search(r'⚑待指派', line)
        if mm: paint(mm.start(), mm.end(), 'warn')
        return cells
    if '⌁' in line:
        mm = re.search(r'⌁.*?(?=\s*│$)', line); paint(mm.start(), mm.end(), 'closed' if '已關閉' in line else 'ok'); return cells
    if re.match(r'│\s+~/', line): paint(2, len(line) - 2, 'muted'); return cells
    if '⧉ #' in line:
        for mm in re.finditer(r'⧉ #\d+', line): paint(mm.start(), mm.end(), 'ok')
    return cells

def render(lines, out, width_cells=None):
    rows = []
    maxc = 0
    for line in lines:
        cells = style_line(line)
        runs, col = [], 0
        for ch, color, bold in cells:
            cw = w(ch)
            if runs and runs[-1][1] == color and runs[-1][2] == bold and w(runs[-1][0][-1]) == cw:
                runs[-1][0] += ch; runs[-1][3] += cw
            else:
                runs.append([ch, color, bold, cw, col])
            col += cw
        maxc = max(maxc, col); rows.append(runs)
    width_cells = width_cells or maxc
    W, H = int(PAD * 2 + width_cells * CW), int(PAD * 2 + len(lines) * CH)
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
         f'<rect width="100%" height="100%" rx="12" fill="{C["bg"]}"/>',
         f'<style>text{{font-family:{FONT};font-size:15px;white-space:pre}}</style>']
    for r, runs in enumerate(rows):
        y = PAD + r * CH + 16
        for text, color, bold, cw_total, col in runs:
            if text.strip() == '': continue
            x = PAD + col * CW
            weight = ' font-weight="bold"' if bold else ''
            o.append(f'<text x="{x:.1f}" y="{y}" fill="{C[color]}"{weight} textLength="{cw_total * CW:.1f}" lengthAdjust="spacingAndGlyphs">{html.escape(text)}</text>')
    o.append('</svg>')
    open(out, 'w', encoding='utf-8').write('\n'.join(o))
    return W, H

if __name__ == '__main__':
    src, out, a, b = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    lines = open(src, encoding='utf-8').read().split('\n')[a:b]
    print(render(lines, out))
