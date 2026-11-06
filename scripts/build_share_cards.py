#!/usr/bin/env python3
"""Build the 1200x630 share cards (assets/media/share/tenkey-share-<lang>.png): the 10key art, a dark bar with the tagline and the page address.

Fonts: Galmuri11-Bold / PixelMplus12-Bold from the game repo (assets/fonts). Run: python3 scripts/build_share_cards.py [fonts_dir]
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/Users/junheechoi/projects/houseduck/10key/assets/fonts")
OUT = ROOT / "assets/media/share"
GOLD, DARK, INK = (255, 210, 63), (20, 19, 24), (236, 230, 214)
CARDS = {
    "ko": ("화려한 모험, 그리고 ASMR", "houseduck.in/10key", "Galmuri11-Bold.ttf"),
    "en": ("A dazzling adventure, and ASMR", "houseduck.in/10key", "Galmuri11-Bold.ttf"),
    "de": ("Ein funkelndes Abenteuer - und ASMR", "houseduck.in/10key", "Galmuri11-Bold.ttf"),
    "ja": ("華やかな冒険、そしてASMR", "houseduck.in/10key", "PixelMplus12-Bold.ttf"),
    # the pixel fonts have no Traditional Chinese glyphs: the zh card keeps the English tagline
    "zh": ("A dazzling adventure, and ASMR", "houseduck.in/10key", "Galmuri11-Bold.ttf"),
}
W, H, BAR = 1200, 630, 118


def pixel_text(text, font_file, color, scale):
    """Draw without anti-aliasing at the font's native size, then scale up with nearest-neighbour: crisp pixel text."""
    font = ImageFont.truetype(str(FONTS / font_file), 11 if "Galmuri" in font_file else 12)
    probe = ImageDraw.Draw(Image.new("1", (1, 1)))
    l, t, r, b = probe.textbbox((0, 0), text, font=font)
    img = Image.new("RGBA", (r - l + 2, b - t + 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.fontmode = "1"
    d.text((1 - l, 1 - t), text, font=font, fill=color + (255,))
    return img.resize((img.width * scale, img.height * scale), Image.NEAREST)


def main():
    art = Image.open(ROOT / "assets/media/tenkey-og.jpg").convert("RGB")
    OUT.mkdir(parents=True, exist_ok=True)
    for lang, (tag, url, font) in CARDS.items():
        card = Image.new("RGB", (W, H), DARK)
        card.paste(art.crop((0, 40, W, 40 + H - BAR)), (0, 0))
        d = ImageDraw.Draw(card)
        d.rectangle((0, H - BAR, W, H - BAR + 5), fill=GOLD)          # gold rule between art and bar
        t = pixel_text(tag, font, GOLD, 3)
        u = pixel_text(url, font, INK, 3)
        pad = 40
        if t.width + u.width + pad * 3 > W:                           # long lines: stack the two
            card.paste(t, (pad, H - BAR + 20), t)
            card.paste(u, (pad, H - BAR + 20 + t.height + 8), u)
        else:
            card.paste(t, (pad, H - BAR // 2 - t.height // 2 + 3), t)
            card.paste(u, (W - pad - u.width, H - BAR // 2 - u.height // 2 + 3), u)
        q = card.quantize(colors=192, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
        q.save(OUT / f"tenkey-share-{lang}.png", optimize=True)
        print(lang, (OUT / f"tenkey-share-{lang}.png").stat().st_size)


def studio_card():
    """House Duck home / about: the night desk with the yellow duck's back (the home hero art), wordmark and address."""
    base = Image.open(ROOT / "assets/media/home/desk-landscape.png").convert("RGBA")
    base.alpha_composite(Image.open(ROOT / "assets/media/home/duck-landscape.png").convert("RGBA"), (133, 64))
    big = base.resize((base.width * 5, base.height * 5), Image.NEAREST)           # 1155 x 820, pixel art kept crisp
    card = Image.new("RGBA", (W, H), base.getpixel((0, 0)))
    card.alpha_composite(big.crop((0, 190, big.width, 190 + H)), ((W - big.width) // 2, 0))
    t = pixel_text("HOUSE DUCK", "Galmuri11-Bold.ttf", GOLD, 6)
    card.alpha_composite(t, (60, 190))
    u = pixel_text("houseduck.in", "Galmuri11-Bold.ttf", INK, 3)
    card.alpha_composite(u, (60, H - 60 - u.height))
    card.convert("RGB").quantize(colors=128, dither=Image.Dither.FLOYDSTEINBERG).save(OUT / "house-duck-share.png", optimize=True)


def comrade_card():
    """Comrade and the Brave New World: the title screenshot beside the name, in the same dark / gold look."""
    card = Image.new("RGB", (W, H), (17, 17, 17))
    shot = Image.open(ROOT / "assets/hexaworld1984/hexaworld1984-title.webp").convert("RGB")
    x = W - 90 - shot.width
    card.paste(shot, (x, (H - shot.height) // 2))
    d = ImageDraw.Draw(card)
    d.rectangle((x - 3, (H - shot.height) // 2 - 3, x + shot.width + 2, (H - shot.height) // 2 + shot.height + 2), outline=GOLD, width=3)
    for i, (txt, f, col, sc) in enumerate([("HOUSE DUCK", "Galmuri11-Bold.ttf", GOLD, 3), ("동무와", "Galmuri11-Bold.ttf", INK, 6), ("멋진신세계", "Galmuri11-Bold.ttf", INK, 6),
                                          ("Comrade and the", "Galmuri11-Bold.ttf", GOLD, 3), ("Brave New World", "Galmuri11-Bold.ttf", GOLD, 3), ("houseduck.in/hexaworld1984", "Galmuri11-Bold.ttf", INK, 2)]):
        t = pixel_text(txt, f, col, sc)
        y = [70, 160, 250, 360, 408, H - 80][i]
        card.paste(t, (60, y), t)
    card.quantize(colors=128, dither=Image.Dither.FLOYDSTEINBERG).save(OUT / "hexaworld1984-share.png", optimize=True)


main()
studio_card()
comrade_card()
