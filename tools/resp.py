#!/usr/bin/env python3
"""Small WebP copies of the card images, so the home page downloads pictures at the size they are shown.

The originals (JPG/PNG in assets/ and prototypes/) stay as they are and remain each <img>'s src;
the WebP copies live in assets/r/ and are offered through srcset + sizes (lazy images only).

  python3 tools/resp.py             make or refresh the WebP copies listed in index.html's srcsets
                                    (only those whose original is newer; fast, safe to run often)
  python3 tools/resp.py --rewrite [file.html ...]
                                    also add/refresh srcset + sizes on every local lazy <img> in the
                                    given pages (default index.html), then make the copies

  python3 tools/resp.py --stage     the first form, then git-add the copies the staged index.html uses
                                    (the pre-commit hook: .git/hooks/pre-commit runs this)

Run it after replacing a card image (tools/sync.mjs runs the first form). A card added without
--rewrite simply keeps its JPG.
"""
import os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = 'assets/r'
WIDTHS = (160, 320, 640, 960)
QUALITY = 78
IMG = re.compile(r'<img\b[^>]*>', re.I)
ATTR = lambda n: re.compile(r'\s' + n + r'="([^"]*)"', re.I)


def out_name(src, w):
    base = os.path.splitext(src)[0].replace('/', '_')
    return f'{OUT}/{base}-{w}.webp'


def widths_for(nat):
    ws = [w for w in WIDTHS if w < nat * 0.9]
    return ws + [nat]


def make(src, w, nat):
    dst = os.path.join(ROOT, out_name(src, w))
    s = os.path.join(ROOT, src)
    # each copy carries its original's modification time, so any change to the original (even a copy
    # that keeps an older time, as tools/sync.mjs does) makes it stale
    if os.path.exists(dst) and abs(os.path.getmtime(dst) - os.path.getmtime(s)) < 1:
        return False
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im = Image.open(s)
    im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
    if w < nat:
        im = im.resize((w, round(im.height * w / nat)), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=QUALITY, method=6)
    st = os.stat(s)
    os.utime(dst, (st.st_atime, st.st_mtime))
    return True


def local(src):
    return src and not re.match(r'^(https?:|data:|//)', src) and re.search(r'\.(jpe?g|png)$', src, re.I) \
        and os.path.exists(os.path.join(ROOT, src))


def rewrite(page):
    path = os.path.join(ROOT, page)
    html = open(path, encoding='utf-8').read()
    n = 0

    def fix(m):
        nonlocal n
        tag = m.group(0)
        src = (ATTR('src').search(tag) or [None, None])[1]
        if not local(src) or 'loading="lazy"' not in tag:
            return tag
        nat = Image.open(os.path.join(ROOT, src)).width
        tall = ATTR('height').search(tag) and ATTR('width').search(tag) and \
            int(ATTR('height').search(tag)[1]) > int(ATTR('width').search(tag)[1])
        srcset = ', '.join(f'{out_name(src, w)} {w}w' for w in widths_for(nat))
        # shown sizes on the home page (project.html widens them for its larger art)
        if tall or nat <= 700:
            sizes = '130px'                                   # phone screenshots
        elif '/web-' in src:
            sizes = '(max-width: 860px) 230px, 300px'         # desktop window in a side-project tile
        else:
            sizes = '(max-width: 860px) 90vw, 340px'          # Zoho work cards
        tag = ATTR('srcset').sub('', tag)
        tag = ATTR('sizes').sub('', tag)
        tag = re.sub(r'\s*/?>$', f' srcset="{srcset}" sizes="{sizes}">', tag)
        n += 1
        return tag

    new = IMG.sub(fix, html)
    if new != html:
        open(path, 'w', encoding='utf-8').write(new)
    return n


def generate(pages):
    made = 0
    for page in pages:
        html = open(os.path.join(ROOT, page), encoding='utf-8').read()
        for tag in IMG.findall(html):
            src = (ATTR('src').search(tag) or [None, None])[1]
            ss = (ATTR('srcset').search(tag) or [None, None])[1]
            if not ss or not local(src) or OUT not in ss:
                continue
            nat = Image.open(os.path.join(ROOT, src)).width
            for w in re.findall(r'-(\d+)\.webp \d+w', ss):
                made += make(src, int(w), nat)
    return made


def stage():
    """pre-commit: add the WebP copies that the index.html being committed points at"""
    import subprocess
    try:
        html = subprocess.run(['git', 'show', ':index.html'], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    except subprocess.CalledProcessError:
        return 0
    refs = sorted({r for r in re.findall(OUT + r'/[^\s",]+\.webp', html) if os.path.exists(os.path.join(ROOT, r))})
    if refs:
        subprocess.run(['git', 'add', '--'] + refs, cwd=ROOT, check=True)
    return len(refs)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    pages = args or ['index.html']
    if '--rewrite' in sys.argv:
        for p in pages:
            print(f'{p}: srcset on {rewrite(p)} images')
    print(f'{generate(pages)} WebP file(s) written to {OUT}/')
    if '--stage' in sys.argv:
        stage()
