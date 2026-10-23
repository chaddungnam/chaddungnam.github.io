#!/usr/bin/env python3
"""Builds the pixel-art layers of the House Duck home hero ("the desk at night").

Input: two generated base images of the same scene with a flat #00FF00 monitor screen
(landscape 1536x1024 and portrait 1024x1536). Output, per orientation, in assets/media/home/:

  desk-<o>.png        the room at its native pixel grid, cleaned palette, screen area transparent
  desk-<o>-pad.png    the same room continued outward (edge pixels softened and dither-faded into the night
                      colour) for viewports that show more room than the base; draw at (-pad.x, -pad.y)
  duck-<o>.png        the duck alone (same native grid), for the breathing lift
  duck-blink-<o>.png  a small patch with the eye closed
  desk-<o>.json       native size, screen quad corners (TL, TR, BR, BL), eye, LEDs, patch offsets,
                      focal point for crops -- enough to rebuild the intro elsewhere (game clients).

Usage:
  python3 scripts/paint_home_desk.py --landscape <gen3.png> --portrait <genp1.png> [--out assets/media/home]
                                     [--preview <dir>]

The pixel grid of each base is measured (period + phase of its block edges); every native pixel is the
median of the centre of its block, so edges stay crisp. Colours are reduced to a fixed-size palette
without dithering.
"""
import argparse
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage

SCREEN_FILL = (10, 16, 48)      # what the page paints under the live screen; also the colour of keyed pixels


# ----------------------------------------------------------------------------- grid measurement
def edge_profile(a, axis):
    """Strength of colour change between neighbouring columns (axis=1) or rows (axis=0)."""
    d = np.abs(np.diff(a, axis=axis)).sum(axis=2)
    return d.sum(axis=0) if axis == 1 else d.sum(axis=1)


def best_period(e, lo=3.5, hi=9.0):
    e = e - e.mean()
    n = len(e)
    best = (-1e18, 6.0, 0.0)
    for p in np.arange(lo, hi, 0.01):
        for ph in np.arange(0, p, 0.25):
            idx = np.round(np.arange(ph, n, p)).astype(int)
            idx = idx[idx < n]
            s = e[idx].mean()
            if s > best[0]:
                best = (s, float(p), float(ph))
    return best[1], best[2]


def downsample(a, px, py, phx, phy):
    """Median of the central 3x3 of every block. Returns the native image and the block centres."""
    h, w, _ = a.shape
    cx = np.arange(phx + px / 2, w - px / 4, px)
    cy = np.arange(phy + py / 2, h - py / 4, py)
    out = np.zeros((len(cy), len(cx), 3), np.uint8)
    for j, y in enumerate(cy):
        yi = np.clip(np.round(y).astype(int) + np.array([-1, 0, 1]), 0, h - 1)
        for i, x in enumerate(cx):
            xi = np.clip(np.round(x).astype(int) + np.array([-1, 0, 1]), 0, w - 1)
            block = a[np.ix_(yi, xi)].reshape(-1, 3)
            out[j, i] = np.median(block, axis=0)
    return out, cx, cy


# ----------------------------------------------------------------------------- masks
def green_mask(a):
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    return (g > 150) & (r < 120) & (b < 120) & (g - np.maximum(r, b) > 70)


def largest_component(mask):
    lab, n = ndimage.label(mask)
    if n == 0:
        return mask
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    return lab == (1 + int(np.argmax(sizes)))


def fit_quad(mask):
    """Fits four straight edges to a (rounded) screen blob; returns TL, TR, BR, BL in pixel coords."""
    ys, xs = np.where(mask)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    rows = np.arange(y0 + int((y1 - y0) * 0.15), y0 + int((y1 - y0) * 0.85))
    left, right = [], []
    for y in rows:
        xr = np.where(mask[y])[0]
        left.append(xr.min()); right.append(xr.max() + 1)
    cols = np.arange(x0 + int((x1 - x0) * 0.15), x0 + int((x1 - x0) * 0.85))
    top, bot = [], []
    for x in cols:
        yr = np.where(mask[:, x])[0]
        top.append(yr.min()); bot.append(yr.max() + 1)
    # x = a*y + b for the sides, y = c*x + d for top/bottom
    la = np.polyfit(rows, left, 1); ra = np.polyfit(rows, right, 1)
    ta = np.polyfit(cols, top, 1); ba = np.polyfit(cols, bot, 1)

    def meet(side, horiz):
        a, b = side; c, d = horiz          # x = a y + b ; y = c x + d
        y = (c * b + d) / (1 - a * c)
        x = a * y + b
        return [float(x), float(y)]

    return [meet(la, ta), meet(ra, ta), meet(ra, ba), meet(la, ba)]


def quad_mask(quad, w, h, grow=0.0):
    """Rasterises a convex quad (TL,TR,BR,BL) at pixel centres, optionally grown outward by `grow` px."""
    yy, xx = np.mgrid[0:h, 0:w]
    px, py = xx + 0.5, yy + 0.5
    cx = sum(p[0] for p in quad) / 4; cy = sum(p[1] for p in quad) / 4
    inside = np.ones((h, w), bool)
    for i in range(4):
        (x1, y1), (x2, y2) = quad[i], quad[(i + 1) % 4]
        nx, ny = y2 - y1, -(x2 - x1)                 # edge normal
        ln = (nx * nx + ny * ny) ** 0.5; nx, ny = nx / ln, ny / ln
        if nx * (cx - x1) + ny * (cy - y1) < 0:      # make the normal point inward
            nx, ny = -nx, -ny
        inside &= (nx * (px - x1) + ny * (py - y1)) >= -grow
    return inside


def yellow_mask(a):
    """The duck: warm yellow / orange, including its brown shadow side (hue 18..58 deg, saturated, not too dark)."""
    r, g, b = a[..., 0].astype(float), a[..., 1].astype(float), a[..., 2].astype(float)
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
    d = np.maximum(mx - mn, 1e-6)
    sat = (mx - mn) / np.maximum(mx, 1)
    hue = np.where(mx == r, (g - b) / d, np.where(mx == g, 2 + (b - r) / d, 4 + (r - g) / d)) * 60
    hue = np.where(hue < 0, hue + 360, hue)
    return (hue >= 18) & (hue <= 58) & (sat > 0.42) & (mx > 70) & (r > b + 30)


def small_blobs(mask, max_area):
    lab, n = ndimage.label(mask)
    out = []
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        if len(xs) <= max_area:
            out.append((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    return out


# ----------------------------------------------------------------------------- palette
def quantize(rgb, alpha, colours):
    im = Image.fromarray(rgb, "RGB")
    q = im.quantize(colors=colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = np.array(q.convert("RGB"))
    return out


def despeckle(rgb, keep):
    """Removes single stray pixels: a pixel whose 4 neighbours all share one colour takes that colour."""
    h, w, _ = rgb.shape
    out = rgb.copy()
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if not keep[y, x]:
                continue
            n = [rgb[y - 1, x], rgb[y + 1, x], rgb[y, x - 1], rgb[y, x + 1]]
            if all((m == n[0]).all() for m in n) and not (rgb[y, x] == n[0]).all():
                out[y, x] = n[0]
    return out


# ----------------------------------------------------------------------------- room extension
BAYER = (np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) + 0.5) / 16
NIGHT = (11, 15, 42)


def _soft(line):
    """5-tap softening along a row/column so the continued edge does not streak."""
    k = np.array([1, 2, 3, 2, 1], float); k /= k.sum()
    c = line.astype(float)
    return np.stack([np.convolve(np.pad(c[:, i], 2, mode="edge"), k, mode="valid") for i in range(3)], axis=1)


def _blend_dither(colour, f, thresholds, levels=6):
    """colour (n,3) -> night by factor f, quantised to `levels` steps with an ordered-dither threshold per pixel."""
    lvl = np.clip(np.floor(f * levels + thresholds) / levels, 0, 1)[:, None]
    return np.clip(colour * (1 - lvl) + np.array(NIGHT, float) * lvl, 0, 255)


def pad_room(pal, alpha, pad_x, pad_y, fade_x=44, fade_y=30):
    """Continues the edge pixels outward and fades them into the night colour (pixel-art dither, no seam).
    Used by wide or tall viewports that show more room than the base image has."""
    h, w, _ = pal.shape
    out = np.zeros((h + 2 * pad_y, w + 2 * pad_x, 3), np.uint8); out[:] = NIGHT
    out[pad_y:pad_y + h, pad_x:pad_x + w] = pal
    oa = np.full((h + 2 * pad_y, w + 2 * pad_x), 255, np.uint8)
    oa[pad_y:pad_y + h, pad_x:pad_x + w] = alpha
    left, right = _soft(pal[:, 0]), _soft(pal[:, -1])
    rows = np.arange(h)
    for d in range(1, pad_x + 1):
        f = min(1.0, d / fade_x); f = f * f * (3 - 2 * f)
        for col, x in ((left, pad_x - d), (right, pad_x + w - 1 + d)):
            out[pad_y:pad_y + h, x] = _blend_dither(col * (1 - 0.12 * f), f, BAYER[rows % 4, x % 4])
    top, bot = _soft(out[pad_y]), _soft(out[pad_y + h - 1])
    cols = np.arange(out.shape[1])
    for d in range(1, pad_y + 1):
        f = min(1.0, d / fade_y); f = f * f * (3 - 2 * f)
        for row, y in ((top, pad_y - d), (bot, pad_y + h - 1 + d)):
            out[y] = _blend_dither(row * (1 - 0.12 * f), f, BAYER[y % 4, cols % 4])
    return out, oa


# ----------------------------------------------------------------------------- one orientation
def build(src, name, out_dir, colours, preview_dir, focal, frame, pad):
    base = np.array(Image.open(src).convert("RGB"))
    H, W, _ = base.shape
    gm = largest_component(green_mask(base))
    quad_src = fit_quad(gm)

    ex = edge_profile(base.astype(float), 1); ey = edge_profile(base.astype(float), 0)
    px, phx = best_period(ex); py, phy = best_period(ey)
    nat, cxs, cys = downsample(base, px, py, phx, phy)
    h, w, _ = nat.shape
    print(f"{name}: source {W}x{H}, block {px:.2f}x{py:.2f} (phase {phx},{phy}) -> native {w}x{h}")

    def to_native(p):   # source px -> native px (continuous)
        return [(p[0] - phx) / px, (p[1] - phy) / py]

    quad = [to_native(p) for p in quad_src]
    # key the screen: everything inside the quad (grown by half a pixel) plus any green left at the rim
    inside = quad_mask(quad, w, h, grow=0.5)
    greenish = green_mask(nat)
    r, g, b = nat[..., 0].astype(int), nat[..., 1].astype(int), nat[..., 2].astype(int)
    tinted = (g > r + 40) & (g > b + 40) & (g > 90)       # softer green blends on the bezel edge
    rim = (greenish | tinted) & ~inside
    rim_d = ndimage.binary_dilation(inside, iterations=2) & rim
    inside |= rim_d
    # tinted pixels that remain next to the screen take the nearest clean colour; green LEDs further
    # away (tower, keypad, monitor power light) are kept
    clean = nat.copy()
    near = ndimage.binary_dilation(inside, iterations=3)
    leftovers = (greenish | tinted) & ~inside & near
    if leftovers.any():
        idx = ndimage.distance_transform_edt(leftovers, return_distances=False, return_indices=True)
        clean = clean[idx[0], idx[1]]
    clean[inside] = SCREEN_FILL

    # LEDs: tiny saturated green / red blobs outside the screen, measured before the palette reduction
    rr, gg, bb = clean[..., 0].astype(int), clean[..., 1].astype(int), clean[..., 2].astype(int)
    led_g = (gg > 110) & (gg > rr + 50) & (gg > bb + 50) & ~inside
    led_r = (rr > 220) & (gg < 110) & (bb < 130) & ~yellow_mask(clean)
    leds = []
    for kind, m in (("green", led_g), ("red", led_r)):
        for box in small_blobs(m, 16):
            c = np.median(clean[box[1]:box[3], box[0]:box[2]].reshape(-1, 3), axis=0)
            leds.append({"x": box[0], "y": box[1], "w": box[2] - box[0], "h": box[3] - box[1],
                         "color": "#%02x%02x%02x" % tuple(int(v) for v in c), "kind": kind})
    led_px = led_g | led_r

    pal = quantize(clean, None, colours)
    pal[inside] = SCREEN_FILL
    pal[led_px] = clean[led_px]
    keep = ~inside & ~led_px
    pal = despeckle(pal, keep)

    # duck: the biggest warm-yellow blob, holes (eye, beak) filled
    ym = yellow_mask(pal)
    duck = largest_component(ym)
    duck = ndimage.binary_fill_holes(ndimage.binary_closing(duck, iterations=2))
    dys, dxs = np.where(duck)
    dbox = [int(dxs.min()), int(dys.min()), int(dxs.max()) + 1, int(dys.max()) + 1]
    # eye: dark, bluish pixels inside the duck's upper half
    dark = (pal[..., 0].astype(int) + pal[..., 1] + pal[..., 2] < 220) & duck
    dark[dbox[1] + (dbox[3] - dbox[1]) // 2:, :] = False
    eye_lab, n = ndimage.label(dark)
    eye = None
    if n:
        sizes = ndimage.sum(dark, eye_lab, range(1, n + 1))
        k = 1 + int(np.argmax(sizes))
        ys, xs = np.where(eye_lab == k)
        eye = [int(xs.min()), int(ys.min()), int(xs.max()) + 1 - int(xs.min()), int(ys.max()) + 1 - int(ys.min())]

    # the red LED on the tower is the disk light that blinks; green ones stay lit
    for led in leds:
        led["blink"] = led["kind"] == "red"

    # ---- write layers
    os.makedirs(out_dir, exist_ok=True)
    alpha = np.where(inside, 0, 255).astype(np.uint8)
    rgba = np.dstack([pal, alpha])
    Image.fromarray(rgba, "RGBA").save(os.path.join(out_dir, f"desk-{name}.png"), optimize=True)
    padded, pad_alpha = pad_room(pal, alpha, pad[0], pad[1])
    Image.fromarray(np.dstack([padded, pad_alpha]), "RGBA").save(os.path.join(out_dir, f"desk-{name}-pad.png"), optimize=True)

    duck_rgba = np.dstack([pal, np.where(duck, 255, 0).astype(np.uint8)])
    duck_crop = duck_rgba[dbox[1]:dbox[3], dbox[0]:dbox[2]]
    Image.fromarray(duck_crop, "RGBA").save(os.path.join(out_dir, f"duck-{name}.png"), optimize=True)

    blink = None
    if eye:
        ex0, ey0, ew, eh = eye
        bx0, by0, bx1, by1 = ex0 - 1, ey0 - 1, ex0 + ew + 1, ey0 + eh + 1
        patch = pal[by0:by1, bx0:bx1].copy()
        # eyelid: the duck colour right of the eye on each row, then a one pixel dark lid line
        for j in range(by0, by1):
            fillc = pal[j, bx1 + 1]
            for i in range(bx0, bx1):
                if dark[j, i] or (pal[j, i].astype(int).sum() < 300):
                    patch[j - by0, i - bx0] = fillc
        lid_y = ey0 + eh // 2 - by0
        lid_c = pal[ey0 + eh // 2, ex0 + ew // 2]
        patch[lid_y, 1:-1] = lid_c
        patch[lid_y + 1, 1:-1] = np.clip(fillc.astype(int) * 0.82, 0, 255).astype(np.uint8)
        Image.fromarray(patch, "RGB").save(os.path.join(out_dir, f"duck-blink-{name}.png"), optimize=True)
        blink = {"file": f"duck-blink-{name}.png", "x": bx0, "y": by0, "w": bx1 - bx0, "h": by1 - by0}

    meta = {
        "name": name,
        "size": [w, h],
        "sourceBlock": [round(px, 3), round(py, 3)],
        "screen": {"quad": [[round(p[0], 2), round(p[1], 2)] for p in quad], "fill": "#%02x%02x%02x" % SCREEN_FILL},
        "duck": {"file": f"duck-{name}.png", "x": dbox[0], "y": dbox[1], "w": dbox[2] - dbox[0], "h": dbox[3] - dbox[1], "eye": eye},
        "blink": blink,
        "leds": leds,
        "focal": focal,
        "frame": frame,
        "pad": {"file": f"desk-{name}-pad.png", "x": pad[0], "y": pad[1], "note": "same scene continued outward and faded into night; draw at (-x, -y)"},
        "night": "#0b0f2a",
    }
    with open(os.path.join(out_dir, f"desk-{name}.json"), "w") as f:
        json.dump(meta, f, indent=1)
    print(json.dumps({k: meta[k] for k in ("size", "screen", "duck", "blink", "leds")}))

    if preview_dir:
        os.makedirs(preview_dir, exist_ok=True)
        comp = pal.copy()
        comp[inside] = (42, 79, 196)
        s = 4
        Image.fromarray(comp, "RGB").resize((w * s, h * s), Image.NEAREST).save(os.path.join(preview_dir, f"preview-{name}.png"))
        # mark the quad, the eye and the LEDs
        from PIL import ImageDraw
        im = Image.fromarray(comp, "RGB").resize((w * s, h * s), Image.NEAREST)
        d = ImageDraw.Draw(im)
        d.polygon([(p[0] * s, p[1] * s) for p in quad], outline=(255, 0, 255))
        if eye:
            d.rectangle([eye[0] * s, eye[1] * s, (eye[0] + eye[2]) * s, (eye[1] + eye[3]) * s], outline=(255, 0, 255))
        for led in leds:
            d.rectangle([led["x"] * s, led["y"] * s, (led["x"] + led["w"]) * s, (led["y"] + led["h"]) * s], outline=(255, 255, 0))
        d.rectangle([dbox[0] * s, dbox[1] * s, dbox[2] * s, dbox[3] * s], outline=(0, 255, 255))
        im.save(os.path.join(preview_dir, f"marks-{name}.png"))
    return meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--landscape", required=True)
    ap.add_argument("--portrait", required=True)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "media", "home"))
    ap.add_argument("--colours", type=int, default=64)
    ap.add_argument("--preview", default=None)
    a = ap.parse_args()
    # landscape: the whole scene fits inside the viewport ("fit"), the padded room fills the rest;
    # portrait: cover crop around the focal point (phones), unchanged
    build(a.landscape, "landscape", a.out, a.colours, a.preview, {"x": 0.5, "y": 0.5}, "fit", (110, 60))
    build(a.portrait, "portrait", a.out, a.colours, a.preview, {"x": 0.5, "y": 0.42}, "cover", (60, 60))


if __name__ == "__main__":
    main()
