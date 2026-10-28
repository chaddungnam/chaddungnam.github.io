#!/usr/bin/env python3
"""Subset the 10key Survival game fonts for the site's 10key sections (owner 2026-10-28: match the itch.io page).

Galmuri11 Bold (Latin, Hangul) and PixelMplus12 Bold (Japanese) are the game's own pixel fonts. The full files live in
the game repo (10key/assets/fonts/src); this keeps only the characters the 10key section of the home pages and the
/10key/ pages use. Run it after changing text there:

    python3 scripts/build_tenkey_fonts.py [path to the 10key repo]
"""
import html
import re
import sys
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "10key"
FONTS = {
    "Galmuri11-Bold-10key.woff2": GAME / "assets/fonts/src/Galmuri11-Bold.ttf",
    "PixelMplus12-Bold-10key.woff2": GAME / "assets/fonts/src/PixelMplus12-Bold.ttf",
}


def page_text():
    chars = set(" !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~·–—’…→↗")
    for name in ("index.html", "index_en.html", "index_de.html", "index_ja.html"):
        page = (ROOT / name).read_text(encoding="utf-8")
        m = re.search(r'<section class="hd-tenkey"[\s\S]*?</section>', page)
        chars |= set(html.unescape(re.sub(r"<[^>]+>", " ", m.group(0))))
    for path in sorted((ROOT / "10key").glob("index*.html")):
        page = path.read_text(encoding="utf-8")
        main = page[page.index("<main"):page.index("</main>")]
        chars |= set(html.unescape(re.sub(r"<[^>]+>", " ", main)))
    return "".join(sorted(c for c in chars if c.strip()))


def main():
    text = page_text()
    for out, source in FONTS.items():
        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]
        options.name_IDs = ["*"]
        options.notdef_outline = True
        font = subset.load_font(str(source), options)
        subsetter = subset.Subsetter(options)
        subsetter.populate(text=text)
        subsetter.subset(font)
        subset.save_font(font, str(ROOT / "assets/fonts" / out), options)
        print(out, (ROOT / "assets/fonts" / out).stat().st_size, "bytes")


if __name__ == "__main__":
    main()
