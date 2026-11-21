# Sale banner for the 10key launch mail (owner 2026-11-21): the get page's price block as one image, in the game's pixel
# Run: python3 scripts/build_mail_sale_images.py ../10key/assets/fonts/src assets/media/mail
# fonts (Galmuri11 Bold for ko/en/de and every number, PixelMplus12 Bold for ja, Fusion Pixel 12px zh_hant for zh).
# Drawn at 2x (1176 px wide, shown at 588), anti-aliasing off so the pixels stay sharp.
import sys
from PIL import Image, ImageDraw, ImageFont
S = sys.argv[1]; OUT = sys.argv[2]
GAL = S + "/Galmuri11-Bold.ttf"; PM = S + "/PixelMplus12-Bold.ttf"; FZ = S + "/fusion-pixel-12px-proportional-zh_hant.ttf"
COPY = {
  "ko": ("출시 기념 할인 · 11월 27일까지 (독일 시간)", "정가", GAL),
  "en": ("LAUNCH SALE · UNTIL NOV 27 (GERMAN TIME)", "Regular price", GAL),
  "de": ("LAUNCH-ANGEBOT · BIS 27. NOV. (DEUTSCHE ZEIT)", "Regulär", GAL),
  "ja": ("リリース記念セール・11月27日まで（ドイツ時間）", "通常価格", PM),
  "zh": ("上市優惠・至 11 月 27 日（德國時間）", "定價", FZ),
}
W = 1176; H = 330
GOLD = (255, 210, 63); GOLD_SIDE = (169, 130, 15); INK = (20, 20, 20); GREY = (150, 144, 132); LABEL = (189, 183, 168)
def font(path, px): return ImageFont.truetype(path, px)
def width(d, t, f): b = d.textbbox((0, 0), t, font=f); return b[2] - b[0]
for loc, (tag, label, tf) in COPY.items():
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); d.fontmode = "1"
    d.rounded_rectangle([0, 0, W - 1, H - 1], radius=28, fill=(16, 16, 16, 255), outline=(92, 78, 30, 255), width=3)
    # tag pill
    ft = font(tf, 48)  # as big as fits (readable when a phone shows the picture at ~350 px)
    tw = width(d, tag, ft)
    if tw > W - 120: ft = font(tf, 36); tw = width(d, tag, ft)
    tb = d.textbbox((0, 0), tag, font=ft); th = tb[3] - tb[1]
    px, py = 28, 16; x0 = (W - tw) // 2 - px; y0 = 34
    d.rounded_rectangle([x0, y0, x0 + tw + 2 * px, y0 + th + 2 * py], radius=(th + 2 * py) // 2, fill=GOLD)
    d.text((x0 + px - tb[0], y0 + py - tb[1]), tag, font=ft, fill=INK)
    # price row: label, $4.99 struck, arrow, $2.99 big (Galmuri numbers for every language)
    fl = font(tf, 36); fo = font(GAL, 72); fa = font(GAL, 48); fs = font(GAL, 144)
    parts = [(label, fl, LABEL), ("$4.99", fo, GREY), ("→", fa, GREY), ("$2.99", fs, GOLD)]
    gap = 30
    ws = [width(d, t, f) for t, f, _ in parts]
    total = sum(ws) + gap * (len(parts) - 1)
    x = (W - total) // 2; base = 282  # common baseline
    for (t, f, c), w in zip(parts, ws):
        asc = f.getmetrics()[0]
        y = base - asc
        if t == "→":  # arrow centred on the struck-through regular price
            ob = d.textbbox((0, base - fo.getmetrics()[0]), "$4.99", font=fo); ab = d.textbbox((0, 0), t, font=f)
            y = (ob[1] + ob[3]) // 2 - (ab[1] + ab[3]) // 2
        if t == "$2.99": d.text((x, y + 8), t, font=f, fill=GOLD_SIDE)  # keycap-side shadow
        d.text((x, y), t, font=f, fill=c)
        if t == "$4.99":
            bb = d.textbbox((x, y), t, font=f); my = (bb[1] + bb[3]) // 2
            d.rectangle([bb[0] - 4, my - 3, bb[2] + 4, my + 3], fill=(205, 198, 182))
        x += w + gap
    assert total < W - 60, (loc, total)
    im.save(f"{OUT}/sale-{loc}.png", optimize=True)
    print(loc, "row", total, "tag", tw)
