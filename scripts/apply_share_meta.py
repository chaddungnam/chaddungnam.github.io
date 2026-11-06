#!/usr/bin/env python3
"""Give every public page its own share preview tags (owner 2026-11-06): og:title / description / url / image (+ size, alt) / locale / site_name,
twitter:card, matching the page's own <title>, description and canonical. Idempotent: old og:* / twitter:* tags are replaced.

    python3 scripts/apply_share_meta.py
"""
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://houseduck.in"
LOCALE = {"ko": "ko_KR", "en": "en_US", "de": "de_DE", "ja": "ja_JP", "zh": "zh_TW"}
STUDIO_ALT = {"ko": "House Duck: 밤의 PC 책상과 노란 오리의 뒷모습", "en": "House Duck: a night desk with a PC and the back of a yellow duck",
              "de": "House Duck: ein nächtlicher PC-Schreibtisch und ein gelber Entenrücken", "ja": "House Duck：夜のPCデスクと黄色いアヒルの後ろ姿"}
TENKEY_ALT = {"ko": "딸깍 서바이벌 공유 그림: 3D 키보드 위의 텐키와 마우스", "en": "10key Survival share picture: the numpad and the mouse on a 3D keyboard",
              "de": "10key-Survival-Teilen-Bild: der Ziffernblock und die Maus auf einer 3D-Tastatur", "ja": "10key Survivalのシェア画像：3Dキーボードの上のテンキとマウス",
              "zh": "《咔噠求生》分享圖片：3D 鍵盤上的數字鍵與滑鼠"}
QB_ALT = {"ko": "Quirky Ball 2.0 게임 화면", "en": "Quirky Ball 2.0 game screen", "de": "Quirky Ball 2.0 Spielbildschirm", "ja": "Quirky Ball 2.0のゲーム画面"}
CRD_ALT = {"ko": "동무와 멋진신세계 타이틀 화면", "en": "Comrade and the Brave New World title screen", "de": "Titelbild von Comrade and the Brave New World", "ja": "Comrade and the Brave New Worldのタイトル画面"}

PAGES = []  # (file, lang, image path, (w, h), alt)
for f, l in [("index.html", "ko"), ("index_en.html", "en"), ("index_de.html", "de"), ("index_ja.html", "ja")]:
    PAGES.append((f, l, "/assets/media/share/house-duck-share.png", (1200, 630), STUDIO_ALT[l]))
for f, l in [("10key/index.html", "ko"), ("10key/index_en.html", "en"), ("10key/index_de.html", "de"), ("10key/index_ja.html", "ja"), ("10key/index_zh.html", "zh")]:
    PAGES.append((f, l, f"/assets/media/share/tenkey-share-{l}.png", (1200, 630), TENKEY_ALT[l]))
for f, l in [("quirky-ball/index.html", "ko"), ("quirky-ball/index_en.html", "en"), ("quirky-ball/index_de.html", "de"), ("quirky-ball/index_ja.html", "ja")]:
    PAGES.append((f, l, "/quirky-ball/v2/og.jpg", (1024, 500), QB_ALT[l]))
for f, l in [("hexaworld1984/index.html", "ko"), ("hexaworld1984/index_ko.html", "ko"), ("hexaworld1984/index_en.html", "en"), ("hexaworld1984/index_de.html", "de"), ("hexaworld1984/index_ja.html", "ja")]:
    PAGES.append((f, l, "/assets/media/share/hexaworld1984-share.png", (1200, 630), CRD_ALT[l]))
for f, l in [("about/index.html", "ko"), ("about/index_en.html", "en"), ("about/index_de.html", "de"), ("about/index_ja.html", "ja")]:
    PAGES.append((f, l, "/assets/media/share/house-duck-share.png", (1200, 630), STUDIO_ALT[l]))


def attr(v):
    return html.escape(v, quote=True)


def first(pat, s):
    m = re.search(pat, s, re.S)
    return html.unescape(m.group(1)) if m else None


def main():
    for f, lang, img, (w, h), alt in PAGES:
        path = ROOT / f
        s = path.read_text(encoding="utf-8")
        head, rest = s.split("</head>", 1)
        title = first(r"<title>(.*?)</title>", head)
        desc = first(r'<meta name="description" content="([^"]*)"', head)
        og_desc = first(r'<meta property="og:description" content="([^"]*)"', head) or desc
        og_title = first(r'<meta property="og:title" content="([^"]*)"', head) or title
        canon = first(r'<link rel="canonical" href="([^"]*)"', head)
        assert title and desc and canon, f
        head = re.sub(r'\s*<meta (?:property="og:[^"]*"|name="twitter:[^"]*")[^>]*>', "", head)
        block = (
            f'<meta property="og:title" content="{attr(og_title)}">'
            f'<meta property="og:description" content="{attr(og_desc)}">'
            f'<meta property="og:type" content="website">'
            f'<meta property="og:site_name" content="House Duck">'
            f'<meta property="og:locale" content="{LOCALE[lang]}">'
            f'<meta property="og:url" content="{attr(canon)}">'
            f'<meta property="og:image" content="{SITE}{img}">'
            f'<meta property="og:image:width" content="{w}"><meta property="og:image:height" content="{h}">'
            f'<meta property="og:image:alt" content="{attr(alt)}">'
            f'<meta name="twitter:card" content="summary_large_image">'
            f'<meta name="twitter:image:alt" content="{attr(alt)}">'
        )
        m = re.search(r'<meta name="description" content="[^"]*">', head)
        assert m, f
        head = head[: m.end()] + "\n  " + block + head[m.end():]
        path.write_text(head + "</head>" + rest, encoding="utf-8")
        print("ok", f)


main()
