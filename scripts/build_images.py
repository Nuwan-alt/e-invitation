"""
One-off image processing script for the Dilshi & Nuwan wedding invitation site.
Reads from images/, writes optimized/social assets into images/optimized/.
Run with: python scripts/build_images.py
Requires: Pillow (pip install pillow)
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "images")
OUT = os.path.join(ROOT, "images", "optimized")
FONTS = os.path.join(ROOT, "scripts", "fonts")
os.makedirs(OUT, exist_ok=True)

GOLD = (176, 154, 108)  # #B09A6C
GOLD_DEEP = (156, 133, 88)  # #9C8558 — cover-only monogram/names variant
CREAM = (250, 249, 246)  # #FAF9F6


def _save_alpha_pair(img, stem, png_kw=None, webp_kw=None):
    """Save an RGBA image as both PNG and WebP (alpha preserved in both)."""
    png_kw = png_kw or {"optimize": True}
    webp_kw = webp_kw or {"quality": 85, "method": 6}
    img.save(os.path.join(OUT, f"{stem}.png"), **png_kw)
    img.save(os.path.join(OUT, f"{stem}.webp"), **webp_kw)


# ---------------------------------------------------------------------------
# 1. Gold monogram logo (transparent) + favicons, from images/D-N.jpg
#    (white "DN" on black -> transparent PNG, letters recoloured gold)
# ---------------------------------------------------------------------------
def build_logo():
    im = Image.open(os.path.join(SRC, "D-N.jpg")).convert("L")
    # denoise the JPEG compression speckle before thresholding
    im = im.filter(ImageFilter.MedianFilter(size=3))

    low, high = 34, 190  # below low -> fully transparent, above high -> fully opaque
    lut = []
    span = high - low
    for v in range(256):
        if v <= low:
            lut.append(0)
        elif v >= high:
            lut.append(255)
        else:
            lut.append(int((v - low) / span * 255))
    alpha = im.point(lut)

    gold_layer = Image.new("RGBA", im.size, GOLD + (0,))
    gold_layer.putalpha(alpha)

    # tight-crop to the glyphs with a little breathing room
    bbox = gold_layer.getbbox()
    pad_x = int((bbox[2] - bbox[0]) * 0.08)
    pad_y = int((bbox[3] - bbox[1]) * 0.10)
    crop_box = (
        max(bbox[0] - pad_x, 0),
        max(bbox[1] - pad_y, 0),
        min(bbox[2] + pad_x, gold_layer.width),
        min(bbox[3] + pad_y, gold_layer.height),
    )
    gold_cropped = gold_layer.crop(crop_box)

    gold_cropped.save(os.path.join(OUT, "logo-gold.png"))
    gold_cropped.save(os.path.join(OUT, "logo-gold.webp"), quality=90, method=6, lossless=False)

    # ---- favicons: gold monogram on a soft cream rounded square ----
    def make_favicon(size, filename, radius_ratio=0.28):
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        radius = int(size * radius_ratio)
        draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=CREAM + (255,))
        # fit monogram into ~72% of the canvas, preserving aspect
        pad = size * 0.14
        max_w, max_h = size - 2 * pad, size - 2 * pad
        gw, gh = gold_cropped.size
        s = min(max_w / gw, max_h / gh)
        rw, rh = max(1, int(gw * s)), max(1, int(gh * s))
        glyph = gold_cropped.resize((rw, rh), Image.LANCZOS)
        canvas.alpha_composite(glyph, ((size - rw) // 2, (size - rh) // 2))
        canvas.save(os.path.join(OUT, filename))

    make_favicon(32, "favicon-32.png")
    make_favicon(180, "favicon-180.png")  # apple-touch-icon
    make_favicon(512, "favicon-512.png")

    print("logo + favicons done", gold_cropped.size)
    return gold_cropped


# ---------------------------------------------------------------------------
# 2. Gold "Dilshi and Nuwan" names artwork, from images/NAMES_2.png
#    (white script on black -> transparent PNG, letters recoloured gold)
# ---------------------------------------------------------------------------
def build_names_gold():
    im = Image.open(os.path.join(SRC, "NAMES_2.png")).convert("L")

    low, high = 22, 200  # below low -> fully transparent, above high -> fully opaque
    lut = []
    span = high - low
    for v in range(256):
        if v <= low:
            lut.append(0)
        elif v >= high:
            lut.append(255)
        else:
            lut.append(int((v - low) / span * 255))
    alpha = im.point(lut)

    gold_layer = Image.new("RGBA", im.size, GOLD + (0,))
    gold_layer.putalpha(alpha)

    # trim to the lettering, keeping a touch of breathing room, aspect intact
    bbox = gold_layer.getbbox()
    pad_x = int((bbox[2] - bbox[0]) * 0.03)
    pad_y = int((bbox[3] - bbox[1]) * 0.05)
    crop_box = (
        max(bbox[0] - pad_x, 0),
        max(bbox[1] - pad_y, 0),
        min(bbox[2] + pad_x, gold_layer.width),
        min(bbox[3] + pad_y, gold_layer.height),
    )
    names_cropped = gold_layer.crop(crop_box)

    # kept at full native resolution (no upscale) so it renders sharp on
    # retina phones even though it's displayed well under its source size
    _save_alpha_pair(names_cropped, "names-gold", webp_kw={"quality": 92, "method": 6})

    print("names-gold done", names_cropped.size)
    return names_cropped


# ---------------------------------------------------------------------------
# 2b. Deeper-gold monogram + names variant, used only on the cover screen —
#     there they sit on a solid white/cream ground instead of a photo, and
#     the lighter GOLD used everywhere else reads as washed out on white.
# ---------------------------------------------------------------------------
def _recolor_glyphs(gray_img, gold, low, high):
    lut = []
    span = high - low
    for v in range(256):
        if v <= low:
            lut.append(0)
        elif v >= high:
            lut.append(255)
        else:
            lut.append(int((v - low) / span * 255))
    alpha = gray_img.point(lut)
    layer = Image.new("RGBA", gray_img.size, gold + (0,))
    layer.putalpha(alpha)
    return layer


def build_cover_gold_variants():
    logo_gray = Image.open(os.path.join(SRC, "D-N.jpg")).convert("L")
    logo_gray = logo_gray.filter(ImageFilter.MedianFilter(size=3))
    logo_layer = _recolor_glyphs(logo_gray, GOLD_DEEP, 34, 190)
    bbox = logo_layer.getbbox()
    pad_x = int((bbox[2] - bbox[0]) * 0.08)
    pad_y = int((bbox[3] - bbox[1]) * 0.10)
    logo_cropped = logo_layer.crop((
        max(bbox[0] - pad_x, 0), max(bbox[1] - pad_y, 0),
        min(bbox[2] + pad_x, logo_layer.width), min(bbox[3] + pad_y, logo_layer.height),
    ))
    _save_alpha_pair(logo_cropped, "logo-gold-deep", webp_kw={"quality": 90, "method": 6})

    names_gray = Image.open(os.path.join(SRC, "NAMES_2.png")).convert("L")
    names_layer = _recolor_glyphs(names_gray, GOLD_DEEP, 22, 200)
    bbox = names_layer.getbbox()
    pad_x = int((bbox[2] - bbox[0]) * 0.03)
    pad_y = int((bbox[3] - bbox[1]) * 0.05)
    names_cropped = names_layer.crop((
        max(bbox[0] - pad_x, 0), max(bbox[1] - pad_y, 0),
        min(bbox[2] + pad_x, names_layer.width), min(bbox[3] + pad_y, names_layer.height),
    ))
    _save_alpha_pair(names_cropped, "names-gold-deep", webp_kw={"quality": 92, "method": 6})

    print("cover gold variants done", logo_cropped.size, names_cropped.size)


# ---------------------------------------------------------------------------
# 3. Floral corner crops + soft watermark, from images/back.png
#    (already a transparent watercolour daisy/eucalyptus frame — no
#    background removal needed, just crop + resize for the web)
# ---------------------------------------------------------------------------
def build_floral():
    im = Image.open(os.path.join(SRC, "back.png")).convert("RGBA")
    w, h = im.size

    tr = im.crop((int(w * 0.4717), 0, w, int(h * 0.4444)))       # ~ (1500,0)-(3180,2000)
    bl = im.crop((0, int(h * 0.6), int(w * 0.4560), h))           # ~ (0,2700)-(1450,4500)

    def web_size(crop, max_w):
        cw, ch = crop.size
        if cw <= max_w:
            return crop
        scale = max_w / cw
        return crop.resize((max_w, int(ch * scale)), Image.LANCZOS)

    tr_web = web_size(tr, 700)
    bl_web = web_size(bl, 620)
    _save_alpha_pair(tr_web, "floral-tr")
    _save_alpha_pair(bl_web, "floral-bl")

    # full-frame low-opacity watermark for behind the invitation card
    watermark = web_size(im, 1200)
    _save_alpha_pair(watermark, "floral-watermark", webp_kw={"quality": 78, "method": 6})

    print("floral crops done", tr_web.size, bl_web.size, "watermark", watermark.size)
    return tr_web, bl_web


# ---------------------------------------------------------------------------
# 4. Pre-shoot photos: resize to max 1600px on the long edge, export webp+jpg
#    (used by the "Our Moments" gallery — framing/crop stays as before)
# ---------------------------------------------------------------------------
def build_photos():
    files = ["ps1.jpg", "ps2.jpg", "ps3.jpg"]
    for f in files:
        im = Image.open(os.path.join(SRC, f)).convert("RGB")
        im = ImageOps.exif_transpose(im)
        w, h = im.size
        max_edge = 1600
        if max(w, h) > max_edge:
            scale = max_edge / max(w, h)
            im = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        stem = os.path.splitext(f)[0]
        im.save(os.path.join(OUT, f"{stem}.jpg"), quality=82, optimize=True)
        im.save(os.path.join(OUT, f"{stem}.webp"), quality=80, method=6)
        print(f, "->", im.size)


# ---------------------------------------------------------------------------
# 5. Full-bleed hero backgrounds: ps3 (cover screen), ps1 (countdown section)
#    resized to max ~1920px wide, never upscaled beyond the source photo
# ---------------------------------------------------------------------------
def build_hero_photos():
    jobs = [("ps3.jpg", "ps3-hero"), ("ps1.jpg", "ps1-hero")]
    for src_name, stem in jobs:
        im = Image.open(os.path.join(SRC, src_name)).convert("RGB")
        im = ImageOps.exif_transpose(im)
        w, h = im.size
        max_edge = 1920
        if max(w, h) > max_edge:
            scale = max_edge / max(w, h)
            im = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        im.save(os.path.join(OUT, f"{stem}.jpg"), quality=84, optimize=True)
        im.save(os.path.join(OUT, f"{stem}.webp"), quality=82, method=6)
        print(src_name, "-> hero", im.size)


# ---------------------------------------------------------------------------
# 6. Social share preview (1200x630) — ps3 fading into white, gold names, date
# ---------------------------------------------------------------------------
def build_og_preview(names_gold):
    W, H = 1200, 630
    canvas = Image.new("RGB", (W, H), (255, 255, 255))

    photo = Image.open(os.path.join(SRC, "ps3.jpg")).convert("RGB")
    photo_cover = ImageOps.fit(photo, (W, H), method=Image.LANCZOS, centering=(0.5, 0.22))

    # vertical alpha mask: solid photo across the top third, fading to pure
    # white by about half way down, leaving clean room for the names/date
    gradient = Image.new("L", (1, H), 0)
    for y in range(H):
        t = y / H
        if t < 0.26:
            a = 255
        elif t < 0.58:
            a = int(255 * (1 - (t - 0.26) / (0.58 - 0.26)))
        else:
            a = 0
        gradient.putpixel((0, y), a)
    gradient = gradient.resize((W, H))

    canvas = Image.composite(photo_cover, canvas, gradient)

    # gold names artwork, centred in the lower (white) portion
    names_w = 400
    scale = names_w / names_gold.width
    names_resized = names_gold.resize((names_w, int(names_gold.height * scale)), Image.LANCZOS)
    names_y = 335
    canvas.paste(names_resized, ((W - names_w) // 2, names_y), names_resized)

    draw = ImageDraw.Draw(canvas)
    date_font = ImageFont.truetype(os.path.join(FONTS, "Cinzel-SemiBold.ttf"), 26)
    sub_font = ImageFont.truetype(os.path.join(FONTS, "CormorantGaramond-Medium.ttf"), 24)

    def centered_text(y, text, font, fill):
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        draw.text(((W - tw) / 2, y), text, font=font, fill=fill)

    centered_text(names_y + names_resized.height + 10, "2 5   .   1 1   .   2 0 2 6", date_font, (43, 43, 43))
    centered_text(names_y + names_resized.height + 52, "THE KINGSBURY, COLOMBO", sub_font, (100, 100, 100))

    canvas.save(os.path.join(OUT, "og-preview.jpg"), quality=88, optimize=True)
    print("og preview done", canvas.size)


def _cleanup_old_card_foliage():
    """Remove assets from the previous card-based foliage decoration —
    the site no longer embeds the reference invitation card image."""
    for name in (
        "foliage-top-right.jpg", "foliage-top-right.webp",
        "foliage-bottom-left.jpg", "foliage-bottom-left.webp",
    ):
        path = os.path.join(OUT, name)
        if os.path.exists(path):
            os.remove(path)
            print("removed stale", name)


# ---------------------------------------------------------------------------
# Rotating gold mandala for the top of the invitation, from images/mandala.png
# (black line art -> gold lines on transparent; white fills become clear)
# ---------------------------------------------------------------------------
def build_mandala(size=640):
    im = Image.open(os.path.join(SRC, "mandala.png")).convert("RGBA")
    gray = im.convert("L")
    # darkness drives opacity, so white inner fills turn transparent too
    ink = gray.point(lambda v: max(0, min(255, int((235 - v) * 255 / 175))))
    alpha = ImageChops.multiply(ink, im.split()[3])
    out = Image.new("RGBA", im.size, GOLD + (0,))
    out.putalpha(alpha)
    out = out.resize((size, size), Image.LANCZOS)
    # single-colour art: a 64-colour palette PNG is well under half the
    # size of a WebP here, so ship just the PNG
    out.quantize(64).save(os.path.join(OUT, "mandala-gold.png"), optimize=True)


# ---------------------------------------------------------------------------
# 8. Venue crest (lions, crown, shield, ribbons) cut from the hotel logo,
#    images/kingsbury.jpg — used as a stencil for the gold-foil crest on
#    the venue card. Darkness drives opacity: the dark-green ink is solid,
#    the gold ribbons come out half-tone, and the cream details inside the
#    shield/lions become cut-outs, so the foil keeps the engraving.
# ---------------------------------------------------------------------------
def build_venue_crest():
    im = Image.open(os.path.join(SRC, "kingsbury.jpg")).convert("L")
    im = im.crop((6, 60, im.width - 6, 305))  # crest only; skips the JPEG's dark edge pixels
    low, high = 60, 225  # luminance: <= low fully opaque, >= high transparent
    alpha = im.point(lambda v: 255 if v <= low else 0 if v >= high else int((high - v) * 255 / (high - low)))

    crest = Image.new("RGBA", im.size, GOLD + (0,))
    crest.putalpha(alpha)
    crest = crest.crop(crest.getbbox())
    crest = crest.resize((crest.width * 2, crest.height * 2), Image.LANCZOS)  # smoother mask edges
    _save_alpha_pair(crest, "kingsbury-crest", webp_kw={"quality": 90, "method": 6})
    print("venue crest done", crest.size)


# ---------------------------------------------------------------------------
# 9. Venue photo (hotel entrance with the crest/name sign), images/hotel.jpg.
#    Note: the source is really an AVIF with a .jpg name; Pillow reads it.
#    The arch frame crops it in CSS, so the full frame is kept here.
# ---------------------------------------------------------------------------
def build_venue_photo():
    im = Image.open(os.path.join(SRC, "hotel.jpg")).convert("RGB")
    w, h = im.size
    max_edge = 1200
    if max(w, h) > max_edge:
        scale = max_edge / max(w, h)
        im = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    im.save(os.path.join(OUT, "hotel.jpg"), quality=82, optimize=True)
    im.save(os.path.join(OUT, "hotel.webp"), quality=80, method=6)
    print("venue photo done", im.size)


# ---------------------------------------------------------------------------
# 10. Cover bottom foliage: the lower strip of images/lower.png (eucalyptus
#     cluster bottom-left + small sprig bottom-right), shown under the
#     "Open Invitation" button. The strip ends where the sprig's visible
#     leaves do (row 575; the rows below are near-white edge pixels), so the
#     sprig sits on the screen's bottom edge; that also drops the template's
#     credit line in the last few rows. The left cluster
#     just bleeds off the bottom a little more.
# ---------------------------------------------------------------------------
def build_cover_foliage():
    im = Image.open(os.path.join(SRC, "lower.png")).convert("RGBA")
    strip = im.crop((0, 355, im.width, 575))
    strip = strip.crop(strip.getbbox())
    _save_alpha_pair(strip, "cover-foliage", webp_kw={"quality": 88, "method": 6})
    print("cover foliage done", strip.size)


if __name__ == "__main__":
    logo = build_logo()
    names = build_names_gold()
    build_cover_gold_variants()
    build_floral()
    build_mandala()
    build_photos()
    build_hero_photos()
    build_og_preview(names)
    build_venue_crest()
    build_venue_photo()
    build_cover_foliage()
    _cleanup_old_card_foliage()
    print("ALL DONE")
