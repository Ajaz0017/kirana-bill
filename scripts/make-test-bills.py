"""Fake handwritten kirana parchis (+ answers.json) for testing the scan.

    python3 scripts/make-test-bills.py              # all bills
    python3 scripts/make-test-bills.py bill-4-...   # only these (answers.json is merged)

Needs Pillow with raqm (Devanagari shaping). Downloads the Kalam handwriting font once into scripts/.fonts.
Real handwriting is messier than a font, so also test with real bills (npm run eval -- <folder>).
"""
import json, math, random, sys, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont, features

ROOT = Path(__file__).resolve().parent
FONTS, OUT = ROOT / '.fonts', ROOT.parent / 'test-bills'
W, H = 1240, 1700
assert features.check('raqm'), 'Pillow needs raqm for Hindi text (pip install --upgrade pillow)'

def ensure_fonts():
    FONTS.mkdir(exist_ok=True)
    for w in ('Regular', 'Bold'):
        f = FONTS / f'Kalam-{w}.ttf'
        if not f.exists():
            urllib.request.urlretrieve(f'https://raw.githubusercontent.com/google/fonts/main/ofl/kalam/Kalam-{w}.ttf', f)

def font(weight, size):
    return ImageFont.truetype(str(FONTS / f'Kalam-{weight}.ttf'), size, layout_engine=ImageFont.LAYOUT_RAQM)

def paper(rng):
    img = Image.new('RGB', (W, H), (247, 243, 228))
    px = img.load()
    for _ in range(60000):  # paper grain
        x, y = rng.randrange(W), rng.randrange(H)
        d = rng.randint(-10, 6)
        r, g, b = px[x, y]
        px[x, y] = (r + d, g + d, b + d)
    d = ImageDraw.Draw(img)
    for y in range(230, H - 40, 78):
        d.line([(0, y), (W, y)], fill=(170, 190, 225), width=2)
    d.line([(118, 0), (118, H)], fill=(225, 140, 140), width=3)
    return img

def write(img, xy, text, rng, size=48, weight='Regular', ink=(22, 38, 120), slant=1.2, strike=False):
    """One handwritten chunk with its own tilt, size and pressure."""
    f = font(weight, int(size * rng.uniform(0.93, 1.08)))
    l, t, r, b = f.getbbox(text)
    layer = Image.new('RGBA', (r - l + 40, b - t + 40), (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((20 - l, 20 - t), text, font=f, fill=ink + (rng.randint(215, 250),))
    if strike:
        dd, my = ImageDraw.Draw(layer), layer.height // 2
        dd.line([(10, my + 6), (layer.width - 10, my - 8)], fill=ink + (235,), width=5)
        dd.line([(14, my - 4), (layer.width - 16, my + 4)], fill=ink + (220,), width=4)
    layer = layer.rotate(rng.uniform(-slant, slant), resample=Image.BICUBIC, expand=True)
    img.paste(layer, (int(xy[0] + rng.uniform(-6, 6)), int(xy[1] - layer.height // 2 + rng.uniform(-5, 5))), layer)

def bill(rng, spec, cols_x=(160, 560, 800, 1000), size=48):
    img = paper(rng)
    for x, y, text, sz, wt in spec['header']:
        write(img, (x, y), text, rng, size=sz, weight=wt)
    y = 270
    for x, text in zip(cols_x, spec['columns']):
        write(img, (x, y), text, rng, size=size - 4, weight='Bold')
    ImageDraw.Draw(img).line([(130, y + 36), (W - 70, y + 40)], fill=(30, 45, 125), width=3)
    for row in spec['rows']:
        y += 78
        strike = row[0] == '~'  # ['~', name, qty, rate, amount] = crossed-out line
        for x, text in zip(cols_x, row[1:] if strike else row):
            if text:
                write(img, (x, y), text, rng, size=size, strike=strike)
    y += 70
    ImageDraw.Draw(img).line([(cols_x[-1] - 20, y), (W - 70, y + 4)], fill=(30, 45, 125), width=3)
    y += 62
    write(img, (cols_x[-2] - 40, y), spec['total'][0], rng, size=size + 4, weight='Bold')
    write(img, (cols_x[-1], y), spec['total'][1], rng, size=size + 6, weight='Bold')
    return img

def as_photo(img, rng, tilt=2.5, blur=0.6, shadow=0.35):
    """Phone-photo look: tilt, perspective, uneven light, softness, sensor noise."""
    bg = Image.new('RGB', (W + 260, H + 260), (92, 74, 58))  # wooden counter
    bg.paste(img, (130, 130))
    bg = bg.rotate(tilt, resample=Image.BICUBIC, fillcolor=(92, 74, 58))
    k = rng.uniform(0.00002, 0.00005)
    bg = bg.transform(bg.size, Image.PERSPECTIVE, (1, 0.03, -20, 0.01, 1, -10, k, 0.00001), resample=Image.BICUBIC)
    small = Image.new('L', (bg.width // 8 + 1, bg.height // 8 + 1))
    cx, cy = small.width * 0.3, small.height * 0.25
    small.putdata([int(255 * (1 - shadow * min(1, math.hypot(i % small.width - cx, i // small.width - cy) / small.width)))
                   for i in range(small.width * small.height)])
    light = small.resize(bg.size, Image.BILINEAR)
    bg = Image.composite(bg, Image.new('RGB', bg.size, (0, 0, 0)), light).filter(ImageFilter.GaussianBlur(blur))
    px = bg.load()
    for _ in range(90000):
        x, y = rng.randrange(bg.width), rng.randrange(bg.height)
        n = rng.randint(-14, 14)
        px[x, y] = tuple(max(0, min(255, c + n)) for c in px[x, y])
    return bg.crop((60, 60, bg.width - 60, bg.height - 60))

BILLS = [
    dict(
        name='bill-1-aasan',
        header=[(160, 90, 'Ramesh ji', 56, 'Bold'), (820, 95, '14/10/26', 46, 'Regular')],
        columns=['Item', 'Qty', 'Rate', 'Amt'],
        rows=[['Atta', '10 kg', '38', '380'], ['Chawal', '5 kg', '52', '260'], ['Cheeni', '2 kg', '44', '88'],
              ['Sarson Tel', '1 ltr', '180', '180'], ['Maggi', '6 pkt', '14', '84'], ['Surf', '1 pkt', '120', '120']],
        total=('Total', '1112/-'),
        photo=dict(tilt=1.2, blur=0.4, shadow=0.2),
        answer=[('Atta', 10, 'kg', 38, 380), ('Chawal', 5, 'kg', 52, 260), ('Cheeni', 2, 'kg', 44, 88),
                ('Sarson Tel', 1, 'ltr', 180, 180), ('Maggi', 6, 'pkt', 14, 84), ('Surf', 1, 'pkt', 120, 120)],
        note='Saaf Hinglish. Sab items bilkul sahi aane chahiye.',
    ),
    dict(
        name='bill-2-mix',
        header=[(160, 90, 'सोहेल भाई', 58, 'Bold'), (800, 95, '14 Oct', 48, 'Regular')],
        columns=['सामान', 'मात्रा', 'रेट', 'रकम'],
        rows=[['दाल अरहर', '2 kg', '144', '288'], ['चीनी', '5 kg', '44', '220'], ['Basmati चावल', '1 kg', '110', '110'],
              ['हल्दी', '250 gm', '240', '60'], ['जीरा', '100 gm', '400', '40'], ['अंडा', '12', '7', '84'],
              ['~', 'साबुन', '4', '10', '40'], ['सरसों तेल', '½ ltr', '180', '90']],
        total=('कुल', '892'),
        photo=dict(tilt=-2.2, blur=0.6, shadow=0.3),
        answer=[('Daal Arhar', 2, 'kg', 144, 288), ('Cheeni', 5, 'kg', 44, 220), ('Basmati Chawal', 1, 'kg', 110, 110),
                ('Haldi', 0.25, 'kg', 240, 60), ('Jeera', 0.1, 'kg', 400, 40), ('Anda', 12, 'pcs', 7, 84),
                ('Sarson Tel', 0.5, 'ltr', 180, 90)],
        note='Hindi + English mix. Saabun kata hua hai, use NAHI aana chahiye. Haldi 250 gm = 0.25 kg, '
             'Jeera 100 gm = 0.1 kg, Tel ½ = 0.5 ltr. "कुल" wali total line nahi aani chahiye.',
    ),
    dict(
        name='bill-3-mushkil',
        header=[(160, 90, 'नसीम खान', 58, 'Bold'), (800, 95, '१४/१०', 50, 'Regular')],
        columns=['सामान', 'वजन', 'भाव', 'रुपये'],
        rows=[['आटा', '25 kg', '33', '825'], ['मैदा', '2 kg', '40', '80'], ['बेसन', '1 kg', '90', '90'],
              ['देसी घी', '1 kg', '600', '600'], ['पनीर', 'पाव', '360', '90'], ['चाय पत्ती', 'आधा kg', '420', '210'],
              ['मैगी', '5 पैकेट', '14', '75'], ['आलू', '3 kg', '25', '75']],
        total=('टोटल', '2045'),
        photo=dict(tilt=3.5, blur=0.9, shadow=0.45),
        answer=[('Atta', 25, 'kg', 33, 825), ('Maida', 2, 'kg', 40, 80), ('Besan', 1, 'kg', 90, 90),
                ('Desi Ghee', 1, 'kg', 600, 600), ('Paneer', 0.25, 'kg', 360, 90), ('Chai Patti', 0.5, 'kg', 420, 210),
                ('Maggi', 5, 'pkt', 14, 75), ('Aloo', 3, 'kg', 25, 75)],
        note='Lagbhag poori Devanagari, tirchhi aur dhundhli photo. पाव = 0.25 kg, आधा = 0.5 kg. '
             'Maggi mein galti jaan-boojh ke hai: 5 × 14 = 70, par 75 likha hai, to app mein uncertain dikhna chahiye.',
    ),
    dict(
        name='bill-4-hindi-naap',
        header=[(160, 90, 'अनवर भाई', 58, 'Bold'), (800, 95, '१६/१०', 50, 'Regular')],
        columns=['सामान', 'मात्रा', 'रेट', 'रकम'],
        rows=[['चावल', 'साढ़े 2 kg', '52', '130'], ['मूंग दाल', 'पौना kg', '120', '90'],
              ['अंडा', '१२ नग', '७', '८४'], ['साबुन', '3', '30', '90'], ['”', '2', '45', '90']],
        total=('कुल', '484'),
        photo=dict(tilt=-1.8, blur=0.7, shadow=0.35),
        answer=[('Chawal', 2.5, 'kg', 52, 130), ('Daal Moong', 0.75, 'kg', 120, 90), ('Anda', 12, 'pcs', 7, 84),
                ('Sabun', 3, 'pcs', 30, 90), ('Sabun', 2, 'pcs', 45, 90)],
        note='Hindi naap-tol: साढ़े 2 = 2.5, पौना = 0.75. Ande wali line हिंदी अंकों mein hai (१२ नग × ७ = ८४). '
             'Aakhri line ” (ditto) hai, matlab upar wala item (Sabun) dobara.',
    ),
]

if __name__ == '__main__':
    ensure_fonts()
    only = set(sys.argv[1:])
    OUT.mkdir(exist_ok=True)
    answers_file = OUT / 'answers.json'
    keys = json.loads(answers_file.read_text()) if only and answers_file.exists() else {}
    for i, spec in enumerate(BILLS):
        if only and spec['name'] not in only:
            continue
        rng = random.Random(42 + i)
        as_photo(bill(rng, spec), rng, **spec['photo']).save(OUT / f"{spec['name']}.jpg", quality=88)
        keys[spec['name']] = dict(
            note=spec['note'],
            total=sum(a[4] for a in spec['answer']),
            items=[dict(name=n, qty=q, unit=u, rate=r, amount=a) for n, q, u, r, a in spec['answer']],
        )
        print('bana:', spec['name'])
    answers_file.write_text(json.dumps(keys, ensure_ascii=False, indent=2) + '\n')
