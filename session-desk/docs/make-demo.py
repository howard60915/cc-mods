#!/usr/bin/env python3
"""重做 README 的 demo 圖：
1. 用 it2 抓「目前 active 的 iTerm2 session」畫面文字（pane 要開著、最好選一列 session 和一張卡）
2. 依顯示欄寬切出 pane 區塊 → docs/pane-sample.txt
3. render.py 畫成 SVG，Chrome headless 以 2x 截成 PNG

用法：cd session-desk/docs && python3 make-demo.py [--from pane-sample.txt]
"""
import os, re, subprocess, sys, unicodedata, struct
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render

HERE = os.path.dirname(os.path.abspath(__file__))
IT2 = '/Applications/iTerm.app/Contents/Resources/utilities/it2'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
SHOTS = [('overview', 'sessions', 'actions'), ]  # 名稱由下方 cut() 決定

def w(ch): return 2 if unicodedata.east_asian_width(ch) in ('W', 'F') else 1

def capture():
    raw = os.path.join(HERE, 'capture.txt')
    subprocess.run([IT2, 'session', 'capture', '-o', raw], check=True)
    lines = open(raw, encoding='utf-8').read().split('\n')
    os.remove(raw)
    top = next(i for i, l in enumerate(lines) if '╭─ Sessions' in l)
    def cols(s):
        out, c = [], 0
        for ch in s: out.append((c, ch)); c += w(ch)
        return out
    first = cols(lines[top]); left = next(c for c, ch in first if ch == '╭'); right = next(c for c, ch in first if ch == '╮')
    out = []
    for l in lines[top:]:
        seg = ''.join(ch for c, ch in cols(l) if left <= c <= right).rstrip()
        out.append(seg)
    # 到操作列提示（ctrl+x tab…／Enter 跳過去…）為止
    end = next((i for i, l in enumerate(out) if l.startswith('ctrl+x tab') or l.startswith('Enter 跳過去')), len(out) - 1)
    return out[:end + 1]

def cut(lines):
    """依框線切出各段：overview＝全部；sessions＝到 notions 框之前；notions＝那一框；actions＝最後的操作列。"""
    # 只留到操作列的提示行為止（抓下來的檔案可能還有空行與分頁標題）
    end = next((i for i, l in enumerate(lines) if l.startswith('ctrl+x tab') or l.startswith('Enter 跳過去')), len(lines) - 1)
    lines = lines[:end + 1]
    notions = next(i for i, l in enumerate(lines) if '╭─ notions' in l)
    notions_end = next(i for i in range(notions, len(lines)) if lines[i].startswith('╰')) + 1
    return {'overview': lines, 'sessions': lines[:notions], 'notions': lines[notions:notions_end], 'actions': lines[notions_end + 1:]}

def main():
    if '--from' in sys.argv:
        lines = open(sys.argv[sys.argv.index('--from') + 1], encoding='utf-8').read().split('\n')
    else:
        lines = capture()
        open(os.path.join(HERE, 'pane-sample.txt'), 'w', encoding='utf-8').write('\n'.join(lines))
    for name, seg in cut(lines).items():
        svg = os.path.join(HERE, f'{name}.svg'); png = os.path.join(HERE, f'{name}.png')
        W, H = render.render(seg, svg)
        subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
                        f'--window-size={W},{H}', '--default-background-color=00000000', f'--screenshot={png}', f'file://{svg}'],
                       check=True, capture_output=True, timeout=120)
        os.remove(svg)
        with open(png, 'rb') as fh:
            fh.read(16); pw, ph = struct.unpack('>II', fh.read(8))
        print(f'{name}.png {pw}x{ph}')

if __name__ == '__main__':
    main()
