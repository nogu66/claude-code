import math, json, os
from PIL import Image, ImageDraw, ImageFilter, ImageChops

SS = 4  # supersample
OUT = "/home/claude/aq/out"
os.makedirs(OUT, exist_ok=True)

STATES = [("swim", 6), ("eat", 4), ("dash", 4), ("error", 4), ("spawn", 4), ("exit", 4)]
COLS = 6

PALETTES = {
    # name: (back, belly, fin, accent(spots) or None)
    "parent": ((222, 120, 40), (255, 244, 228), (255, 190, 120), (255, 255, 255)),
    "blue":   ((40, 110, 210), (210, 235, 255), (120, 190, 255), None),
    "orange": ((235, 110, 40), (255, 228, 190), (255, 170, 90), None),
    "green":  ((40, 160, 110), (215, 250, 225), (120, 220, 170), None),
    "purple": ((140, 80, 210), (235, 220, 255), (190, 150, 255), None),
}

def lerp(a, b, t): return a + (b - a) * t
def lerpc(c1, c2, t): return tuple(int(lerp(a, b, t)) for a, b in zip(c1, c2))

def body_pts(W, H, phase, amp, stretch=1.0, mouth=0.0):
    """Returns (top, bottom) polylines of the body, nose at right."""
    cx0 = W * 0.30              # tail base x
    cx1 = W * (0.30 + 0.62 * stretch if stretch <= 1 else 0.92)
    L = cx1 - cx0
    cy = H * 0.5
    hh = H * 0.30
    top, bot, mid = [], [], []
    n = 40
    for i in range(n + 1):
        u = i / n                       # 0 tail base -> 1 nose
        x = cx0 + L * u
        w = (1 - u)                      # tail side wiggles more
        yoff = amp * H * math.sin(phase + u * 2.2) * w * w
        h = hh * (math.sin(math.pi * (0.12 + 0.88 * u)) ** 0.75) * (0.55 + 0.45 * u ** 0.4)
        if u > 0.93 and mouth > 0:
            h *= 1.0
        top.append((x, cy + yoff - h * 1.05))
        bot.append((x, cy + yoff + h * 0.95))
        mid.append((x, cy + yoff))
    return top, bot, mid, cx0, cx1

def draw_fish(W, H, pal, phase=0.0, amp=0.06, stretch=1.0, mouth=0.0,
              tint=None, tint_amt=0.0, x_eyes=False, speed_lines=False):
    W2, H2 = W * SS, H * SS
    back, belly, fin, spots = pal
    img = Image.new("RGBA", (W2, H2), (0, 0, 0, 0))
    top, bot, mid, cx0, cx1 = body_pts(W2, H2, phase, amp, stretch, mouth)

    # --- tail fin (behind body)
    tail_y = mid[0][1]
    swing = math.sin(phase - 0.6) * H2 * 0.12
    tip_x = cx0 - W2 * 0.24
    tail = [(cx0 + W2 * 0.03, tail_y - H2 * 0.06),
            (tip_x, tail_y - H2 * 0.24 + swing),
            (tip_x + W2 * 0.07, tail_y + swing * 0.5),
            (tip_x, tail_y + H2 * 0.24 + swing),
            (cx0 + W2 * 0.03, tail_y + H2 * 0.06)]
    fin_layer = Image.new("RGBA", (W2, H2), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fin_layer)
    fd.polygon(tail, fill=fin + (205,))
    # tail rays
    for k in range(-3, 4):
        t = k / 3.5
        fd.line([(cx0, tail_y), (tip_x + W2 * 0.02, tail_y + H2 * 0.28 * t + swing * (1 - abs(t) * 0.3))],
                fill=lerpc(fin, back, 0.35) + (150,), width=SS)
    # dorsal fin
    di = 20
    dx, dy = top[di]
    dorsal = [top[12], (dx - W2 * 0.02, dy - H2 * 0.16), (top[28][0], top[28][1] - H2 * 0.03), top[28]]
    fd.polygon(dorsal, fill=fin + (190,))
    # bottom fin
    bx, by = bot[18]
    fd.polygon([bot[14], (bx - W2 * 0.05, by + H2 * 0.10 + swing * 0.2), bot[22]], fill=fin + (180,))
    img.alpha_composite(fin_layer)

    # --- body mask
    mask = Image.new("L", (W2, H2), 0)
    md = ImageDraw.Draw(mask)
    poly = top + [(cx1 + W2 * 0.012, mid[-1][1])] + bot[::-1]
    md.polygon(poly, fill=255)
    if mouth > 0:  # notch for open mouth
        mx, my = cx1 + W2 * 0.012, mid[-1][1]
        md.polygon([(mx + SS * 2, my - H2 * 0.11 * mouth), (mx - W2 * 0.11 * mouth, my),
                    (mx + SS * 2, my + H2 * 0.11 * mouth)], fill=0)

    # vertical gradient back -> belly following body center
    grad = Image.new("RGBA", (W2, H2))
    gp = grad.load()
    for x in range(W2):
        u = min(max((x - cx0) / (cx1 - cx0), 0), 1)
        i = int(u * 40)
        ty, by_ = top[i][1], bot[i][1]
        for y in range(H2):
            t = min(max((y - ty) / max(by_ - ty, 1), 0), 1)
            t = t ** 1.3
            c = lerpc(back, belly, t)
            gp[x, y] = c + (255,)
    body = Image.new("RGBA", (W2, H2), (0, 0, 0, 0))
    body.paste(grad, (0, 0), mask)

    # scales pattern
    sc = Image.new("RGBA", (W2, H2), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sc)
    r = int(H2 * 0.055)
    for row, yy in enumerate(range(0, H2, int(r * 1.2))):
        for xx in range(int(cx0) - r, int(cx1 * 0.82), int(r * 1.5)):
            ox = xx + (r * 0.75 if row % 2 else 0)
            sd.arc([ox - r, yy - r, ox + r, yy + r], 90, 270, fill=(255, 255, 255, 55), width=SS)
    sc_m = Image.new("RGBA", (W2, H2), (0, 0, 0, 0)); sc_m.paste(sc, (0, 0), mask)
    body.alpha_composite(sc_m)

    # koi spots for parent (solid color, blur alpha only -> no dark fringe)
    if spots:
        sa = Image.new("L", (W2, H2), 0)
        sad = ImageDraw.Draw(sa)
        for (ux, uy, rr) in [(0.22, -0.10, 0.12), (0.30, 0.02, 0.09), (0.55, -0.04, 0.12), (0.62, 0.08, 0.07), (0.80, -0.12, 0.07)]:
            i = int(ux * 40); mx_, my_ = mid[i]
            sad.ellipse([mx_ - H2 * rr * 1.5, my_ + H2 * uy - H2 * rr, mx_ + H2 * rr * 1.5, my_ + H2 * uy + H2 * rr], fill=235)
        sa = sa.filter(ImageFilter.GaussianBlur(SS * 1.5))
        sa = ImageChops.multiply(sa, mask)
        sp = Image.new("RGBA", (W2, H2), spots + (255,)); sp.putalpha(sa)
        body.alpha_composite(sp)
    # top highlight
    hl = Image.new("RGBA", (W2, H2), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hl)
    i0, i1 = 10, 34
    hd.line([(top[i][0], top[i][1] + H2 * 0.05) for i in range(i0, i1)], fill=(255, 255, 255, 120), width=SS * 3)
    hl = hl.filter(ImageFilter.GaussianBlur(SS * 1.5))
    hlm = Image.new("RGBA", (W2, H2), (0, 0, 0, 0)); hlm.paste(hl, (0, 0), mask)
    body.alpha_composite(hlm)

    # outline
    edge = ImageChops.subtract(mask.filter(ImageFilter.MaxFilter(SS * 2 + 1)), mask)
    ol = Image.new("RGBA", (W2, H2), lerpc(back, (0, 0, 0), 0.45) + (255,))
    olayer = Image.new("RGBA", (W2, H2), (0, 0, 0, 0)); olayer.paste(ol, (0, 0), edge)
    img.alpha_composite(olayer)
    img.alpha_composite(body)

    # pectoral fin (front, semi transparent)
    pf = Image.new("RGBA", (W2, H2), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pf)
    px, py = mid[27]
    flap = math.sin(phase * 2) * H2 * 0.04
    pd.polygon([(px, py + H2 * 0.04), (px - W2 * 0.10, py + H2 * 0.14 + flap), (px - W2 * 0.03, py + H2 * 0.06)],
               fill=fin + (170,))
    img.alpha_composite(pf)

    # gill line
    d = ImageDraw.Draw(img)
    gx = top[31][0]
    d.arc([gx - H2 * 0.12, mid[31][1] - H2 * 0.16, gx + H2 * 0.04, mid[31][1] + H2 * 0.16], 300, 60,
          fill=lerpc(back, (0, 0, 0), 0.3) + (160,), width=SS)

    # eye
    ex, ey = mid[35][0], mid[35][1] - H2 * 0.06
    er = H2 * 0.065
    if x_eyes:
        d.ellipse([ex - er, ey - er, ex + er, ey + er], fill=(255, 255, 255, 255))
        k = er * 0.65
        d.line([(ex - k, ey - k), (ex + k, ey + k)], fill=(20, 20, 30, 255), width=SS * 2)
        d.line([(ex - k, ey + k), (ex + k, ey - k)], fill=(20, 20, 30, 255), width=SS * 2)
    else:
        d.ellipse([ex - er, ey - er, ex + er, ey + er], fill=(255, 255, 255, 255))
        pr = er * 0.62
        d.ellipse([ex - pr + er * 0.2, ey - pr, ex + pr + er * 0.2, ey + pr], fill=(18, 20, 32, 255))
        hr = er * 0.25
        d.ellipse([ex + er * 0.35 - hr, ey - er * 0.35 - hr, ex + er * 0.35 + hr, ey - er * 0.35 + hr],
                  fill=(255, 255, 255, 255))

    # tint (error)
    if tint and tint_amt > 0:
        a = img.split()[3]
        red = Image.new("RGBA", (W2, H2), tint + (255,))
        tinted = Image.blend(img, red, tint_amt)
        tinted.putalpha(a)
        img = tinted

    # speed lines (dash)
    if speed_lines:
        sl = Image.new("RGBA", (W2, H2), (0, 0, 0, 0))
        sld = ImageDraw.Draw(sl)
        for j, fy in enumerate([0.28, 0.45, 0.62, 0.74]):
            x0 = W2 * (0.02 + 0.03 * ((j + phase) % 2))
            sld.line([(x0, H2 * fy), (x0 + W2 * 0.12, H2 * fy)], fill=(255, 255, 255, 170), width=SS * 2)
        img = Image.alpha_composite(sl, img)

    return img.resize((W, H), Image.LANCZOS)

def transform(im, scale=1.0, alpha=1.0, angle=0.0, dy=0):
    W, H = im.size
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    f = im
    if angle:
        f = f.rotate(angle, resample=Image.BICUBIC, expand=False)
    if scale != 1.0:
        s = max(1, int(W * scale)), max(1, int(H * scale))
        f = f.resize(s, Image.LANCZOS)
    ox, oy = (W - f.size[0]) // 2, (H - f.size[1]) // 2 + dy
    out.alpha_composite(f, (max(ox, 0), max(oy, 0)) if ox >= 0 else (0, 0))
    if alpha < 1.0:
        a = out.split()[3].point(lambda v: int(v * alpha))
        out.putalpha(a)
    return out

def frames_for(state, n, W, H, pal):
    fr = []
    for i in range(n):
        ph = 2 * math.pi * i / n
        if state == "swim":
            fr.append(draw_fish(W, H, pal, phase=ph, amp=0.10))
        elif state == "eat":
            m = [0.0, 0.6, 1.0, 0.5][i]
            fr.append(draw_fish(W, H, pal, phase=ph * 0.5, amp=0.04, mouth=m))
        elif state == "dash":
            fr.append(draw_fish(W, H, pal, phase=ph * 1.5, amp=0.11, stretch=1.06, speed_lines=True))
        elif state == "error":
            base = draw_fish(W, H, pal, phase=0.3, amp=0.03, tint=(235, 40, 50),
                             tint_amt=[0.55, 0.25, 0.55, 0.25][i], x_eyes=True)
            fr.append(transform(base, angle=-[4, 10, 16, 20][i], dy=[0, 1, 2, 3][i] * H // 40))
        elif state == "spawn":
            base = draw_fish(W, H, pal, phase=ph, amp=0.07)
            fr.append(transform(base, scale=[0.35, 0.6, 0.85, 1.0][i], alpha=[0.3, 0.6, 0.85, 1.0][i]))
        elif state == "exit":
            base = draw_fish(W, H, pal, phase=ph, amp=0.07)
            fr.append(transform(base, alpha=[0.85, 0.6, 0.35, 0.12][i]))
    return fr

manifest = {"cols": COLS, "states": {s: {"row": r, "frames": n} for r, (s, n) in enumerate(STATES)},
            "note": "frame rect = (col*w, row*h, w, h). Sheets are pre-flipped for left.", "sheets": {}}

def build(name, pal, W, H):
    sheet_r = Image.new("RGBA", (W * COLS, H * len(STATES)), (0, 0, 0, 0))
    for r, (s, n) in enumerate(STATES):
        for c, f in enumerate(frames_for(s, n, W, H, pal)):
            sheet_r.alpha_composite(f, (c * W, r * H))
    sheet_l = Image.new("RGBA", sheet_r.size, (0, 0, 0, 0))
    for r in range(len(STATES)):
        for c in range(COLS):
            cell = sheet_r.crop((c * W, r * H, (c + 1) * W, (r + 1) * H)).transpose(Image.FLIP_LEFT_RIGHT)
            sheet_l.alpha_composite(cell, (c * W, r * H))
    for d, sh in (("right", sheet_r), ("left", sheet_l)):
        fn = f"fish_{name}_{d}.png"
        sh.save(os.path.join(OUT, fn), optimize=True)
        manifest["sheets"][f"{name}_{d}"] = {"file": fn, "w": W, "h": H}
    return sheet_r

sheets = {}
sheets["parent"] = build("parent", PALETTES["parent"], 160, 80)
for k in ["blue", "orange", "green", "purple"]:
    sheets[k] = build(k, PALETTES[k], 96, 48)

# ---- props: bubbles (3 sizes) + seaweed (4 sway frames) + food + nest
def bubble(d):
    D = d * SS
    im = Image.new("RGBA", (D, D), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    dr.ellipse([SS, SS, D - SS, D - SS], fill=(200, 235, 255, 60), outline=(230, 250, 255, 200), width=SS)
    dr.ellipse([D * 0.25, D * 0.2, D * 0.45, D * 0.4], fill=(255, 255, 255, 220))
    return im.resize((d, d), Image.LANCZOS)
props = Image.new("RGBA", (16 + 12 + 8 + 8 + 12 + 40, 16), (0, 0, 0, 0))
bx = 0; prop_rects = {}
for nm, d in [("bubble_l", 16), ("bubble_m", 12), ("bubble_s", 8)]:
    props.alpha_composite(bubble(d), (bx, 0)); prop_rects[nm] = [bx, 0, d, d]; bx += d
# food pellet
f = Image.new("RGBA", (8 * SS, 8 * SS), (0, 0, 0, 0)); fd = ImageDraw.Draw(f)
fd.ellipse([SS, SS, 7 * SS, 7 * SS], fill=(196, 140, 80, 255)); fd.ellipse([2*SS, 2*SS, 4*SS, 4*SS], fill=(240, 200, 150, 255))
props.alpha_composite(f.resize((8, 8), Image.LANCZOS), (bx, 0)); prop_rects["food"] = [bx, 0, 8, 8]; bx += 8
bx += 8
# nest mound
n = Image.new("RGBA", (40 * SS, 16 * SS), (0, 0, 0, 0)); nd = ImageDraw.Draw(n)
nd.pieslice([0, 4 * SS, 40 * SS, 28 * SS], 180, 360, fill=(210, 180, 130, 255))
for i in range(6):
    nd.ellipse([(5 + i * 5) * SS, (9 + (i % 2)) * SS, (8 + i * 5) * SS, (12 + (i % 2)) * SS], fill=(170, 140, 95, 255))
props.alpha_composite(n.resize((40, 16), Image.LANCZOS), (bx + 12 - 12, 0)); prop_rects["nest"] = [bx, 0, 40, 16]
props.save(os.path.join(OUT, "props.png"), optimize=True)
manifest["props"] = {"file": "props.png", "rects": prop_rects}

# seaweed sheet 4 frames 32x96
SW, SH = 32, 96
weed = Image.new("RGBA", (SW * 4, SH), (0, 0, 0, 0))
for i in range(4):
    im = Image.new("RGBA", (SW * SS, SH * SS), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    for blade, (bx0, hgt, col) in enumerate([(10, 0.95, (40, 150, 90)), (20, 0.75, (60, 180, 110)), (15, 0.6, (30, 120, 80))]):
        pts = []
        for s in range(30):
            u = s / 29
            y = SH * SS * (1 - u * hgt)
            x = bx0 * SS + math.sin(u * 3 + i * math.pi / 2 + blade) * 5 * SS * u
            pts.append((x, y))
        for s in range(29):
            wdt = int((1 - s / 29) * 4 * SS + SS)
            dr.line([pts[s], pts[s + 1]], fill=col + (235,), width=wdt)
    weed.alpha_composite(im.resize((SW, SH), Image.LANCZOS), (i * SW, 0))
weed.save(os.path.join(OUT, "seaweed.png"), optimize=True)
manifest["seaweed"] = {"file": "seaweed.png", "w": SW, "h": SH, "frames": 4}

with open(os.path.join(OUT, "manifest.json"), "w") as fp:
    json.dump(manifest, fp, indent=2)

# ---- preview: contact sheet + animated gif on water background
def water(W, H):
    bg = Image.new("RGBA", (W, H)); p = bg.load()
    for y in range(H):
        c = lerpc((40, 120, 180), (8, 30, 70), y / H)
        for x in range(W): p[x, y] = c + (255,)
    return bg

cs = water(sheets["parent"].size[0], sheets["parent"].size[1] + sheets["blue"].size[1] * 2)
cs.alpha_composite(sheets["parent"], (0, 0))
cs.alpha_composite(sheets["blue"], (0, sheets["parent"].size[1]))
cs.alpha_composite(sheets["purple"], (sheets["blue"].size[0], sheets["parent"].size[1]))
cs.alpha_composite(sheets["orange"], (0, sheets["parent"].size[1] + sheets["blue"].size[1]))
cs.alpha_composite(sheets["green"], (sheets["blue"].size[0], sheets["parent"].size[1] + sheets["blue"].size[1]))
cs.convert("RGB").save(os.path.join(OUT, "preview_sheets.png"))

# animated gif demo
GW, GH = 480, 270
frames = []
def cell(sheet, W, H, state, idx):
    r = manifest["states"][state]["row"]
    return sheet.crop((idx * W, r * H, (idx + 1) * W, (r + 1) * H))
left_parent = Image.open(os.path.join(OUT, "fish_parent_left.png"))
T = 72
for t in range(T):
    bg = water(GW, GH)
    # sand
    ImageDraw.Draw(bg).rectangle([0, GH - 22, GW, GH], fill=(200, 175, 125, 255))
    for k, wx in enumerate([30, 400, 440]):
        bg.alpha_composite(weed.crop(((t // 4 + k) % 4 * SW, 0, ((t // 4 + k) % 4 + 1) * SW, SH)), (wx, GH - SH - 10))
    # parent swims right->left loop
    px = int(GW - (t * 7) % (GW + 160))
    bg.alpha_composite(cell(left_parent, 160, 80, "swim", t % 6), (px, 60 + int(8 * math.sin(t / 6))))
    # blue eats, orange dashes, green error, purple spawn
    st = "eat" if t % 24 < 12 else "swim"
    bg.alpha_composite(cell(sheets["blue"], 96, 48, st, t % manifest["states"][st]["frames"]), (70, 170))
    bg.alpha_composite(props.crop((36, 0, 44, 8)), (160, 150 + (t % 12) * 2))
    ox = int((t * 12) % (GW + 96)) - 96
    bg.alpha_composite(cell(sheets["orange"], 96, 48, "dash", t % 4), (ox, 20))
    gst = "error" if (t // 12) % 2 == 0 else "swim"
    gi = min(t % 12 // 3, 3) if gst == "error" else t % 6
    bg.alpha_composite(cell(sheets["green"], 96, 48, gst, gi), (300, 175))
    si = t % 24
    if si < 4:
        bg.alpha_composite(cell(sheets["purple"], 96, 48, "spawn", si), (330, 100))
    elif si < 20:
        bg.alpha_composite(cell(sheets["purple"], 96, 48, "swim", si % 6), (330, 100))
    else:
        bg.alpha_composite(cell(sheets["purple"], 96, 48, "exit", si - 20), (330, 100))
    for b in range(5):
        by = GH - ((t * 4 + b * 53) % GH)
        bg.alpha_composite(bubble(12 if b % 2 else 8), (120 + b * 60 + int(4 * math.sin(t / 5 + b)), by))
    frames.append(bg.convert("RGB").quantize(colors=255, method=Image.MEDIANCUT))
frames[0].save(os.path.join(OUT, "preview.gif"), save_all=True, append_images=frames[1:], duration=66, loop=0)
print("ok")
