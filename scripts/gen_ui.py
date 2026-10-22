"""Éléments d'interface pixel art (direction « Forge noire ») -> textures/ui/.

Tout est dessiné pixel par pixel : mur de briques, cadres de panneau, boutons, cases, barre, plaque de titre. Les
cadres sont en « 9-slice » : la page les étire avec border-image (coins fixes, bords étirés). Ils sont affichés à
2 ou 3 px par pixel (variable --u de src/ui/style.css), avec image-rendering: pixelated pour rester nets.

    python scripts/gen_ui.py
"""
import os
import random
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'textures', 'ui')

# palette de la Forge noire : fer, braise, brique brune
C = dict(
    out='#0b0806', band_lt='#7a6a5c', band='#4d4239', band_dk='#2a231e', fill='#191310',
    rivet='#c2ad94', rivet_dk='#5a4c40', accent='#ff7a2e', accent_lt='#ffc27a', accent_dk='#8f2f0c',
    slot_fill='#0f0b09', slot_dk='#070504', slot_lt='#3a302a',
    bg=['#241b16', '#2a201a', '#1f1713', '#2e231c'], bg_mortar='#110c0a', bg_hl='#3a2c23', bg_sh='#150f0c',
)


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def canvas(w, h):
    return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def rect(im, x0, y0, x1, y1, col):
    """rectangle plein, bornes incluses"""
    c = rgb(col)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            im.putpixel((x, y), c)


def frame(im, x0, y0, x1, y1, lt, dk):
    """contour d'1 pixel : clair en haut et à gauche, sombre en bas et à droite"""
    rect(im, x0, y0, x1, y0, lt); rect(im, x0, y0, x0, y1, lt)
    rect(im, x0, y1, x1, y1, dk); rect(im, x1, y0, x1, y1, dk)


def wall(rnd):
    """mur de briques brunes 96×96, raccordable : briques 24×12, décalées d'une demi-brique une rangée sur deux"""
    S = 96; im = canvas(S, S)
    for row in range(S // 12):
        off = 12 if row % 2 else 0
        for b in range(-1, S // 24 + 1):
            x0 = b * 24 + off; y0 = row * 12; base = rnd.choice(C['bg'])
            for y in range(y0, y0 + 12):
                for x in range(x0, x0 + 24):
                    lx = x - x0; ly = y - y0
                    if ly == 11 or lx == 23: col = C['bg_mortar']
                    elif ly == 0 or lx == 0: col = C['bg_hl']
                    elif ly == 10 or lx == 22: col = C['bg_sh']
                    else:
                        r = rnd.random()
                        col = C['bg_hl'] if r < .03 else C['bg_sh'] if r < .08 else base
                    im.putpixel((x % S, y), rgb(col))
    return im


def panel(hi=False):
    """plaque de fer 18×18 (tranche 6) : contour, bande biseautée, rivets aux coins ; hi = liseré de braise"""
    S = 18; im = canvas(S, S)
    rect(im, 0, 0, S - 1, S - 1, C['out'])
    rect(im, 1, 1, S - 2, S - 2, C['band'])
    frame(im, 1, 1, S - 2, S - 2, C['accent'] if hi else C['band_lt'], C['band_dk'])
    frame(im, 4, 4, S - 5, S - 5, C['band_dk'], C['band_lt'])
    rect(im, 5, 5, S - 6, S - 6, C['fill'])
    for (x, y) in ((2, 2), (S - 4, 2), (2, S - 4), (S - 4, S - 4)):
        rect(im, x, y, x + 1, y + 1, C['rivet']); im.putpixel((x + 1, y + 1), rgb(C['rivet_dk']))
    return im


def button(state):
    """bouton 15×15 (tranche 3) : n = normal, h = survol, on = actif (braise)"""
    S = 15; im = canvas(S, S)
    face = {'n': C['band'], 'h': C['band_lt'], 'on': C['accent']}[state]
    lt = {'n': C['band_lt'], 'h': C['rivet'], 'on': C['accent_lt']}[state]
    dk = {'n': C['band_dk'], 'h': C['band'], 'on': C['accent_dk']}[state]
    rect(im, 1, 0, S - 2, S - 1, C['out']); rect(im, 0, 1, S - 1, S - 2, C['out'])   # coins arrondis d'1 pixel
    rect(im, 1, 1, S - 2, S - 3, face)
    rect(im, 1, 1, S - 2, 1, lt); rect(im, 1, 1, 1, S - 3, lt)
    rect(im, 1, S - 3, S - 2, S - 2, dk); rect(im, S - 2, 1, S - 2, S - 2, dk)
    return im


def slot(state):
    """case 18×18 (tranche 3) : creusée (ombre en haut à gauche) ; sel = bordure de braise"""
    S = 18; im = canvas(S, S)
    rect(im, 0, 0, S - 1, S - 1, C['accent'] if state == 'sel' else C['out'])
    rect(im, 1, 1, S - 2, S - 2, C['slot_fill'])
    frame(im, 1, 1, S - 2, S - 2, C['slot_dk'], C['slot_lt'])
    frame(im, 2, 2, S - 3, S - 3, C['slot_dk'], C['slot_fill'])
    if state == 'sel':
        frame(im, 1, 1, S - 2, S - 2, C['accent_lt'], C['accent_dk'])
    return im


def bar():
    """rainure de barre 9×9 (tranche 3)"""
    S = 9; im = canvas(S, S)
    rect(im, 0, 0, S - 1, S - 1, C['out'])
    frame(im, 1, 1, S - 2, S - 2, C['band_dk'], C['band_lt'])
    rect(im, 2, 2, S - 3, S - 3, C['slot_dk'])
    return im


def plate():
    """plaque de titre 30×14 (tranches 3 / 7) : bandeau de braise sombre à pointes"""
    W, H = 30, 14; im = canvas(W, H)
    rect(im, 2, 0, W - 3, H - 1, C['out'])
    rect(im, 0, 3, W - 1, H - 4, C['out'])
    rect(im, 3, 1, W - 4, H - 2, C['accent_dk'])
    rect(im, 1, 4, W - 2, H - 5, C['accent_dk'])
    rect(im, 3, 1, W - 4, 1, C['accent'])
    rect(im, 3, H - 2, W - 4, H - 2, C['out'])
    return im


def main():
    os.makedirs(OUT, exist_ok=True)
    rnd = random.Random(7)
    files = {'wall.png': wall(rnd), 'panel.png': panel(), 'panel_hi.png': panel(True), 'bar.png': bar(), 'plate.png': plate()}
    for s in ('n', 'h', 'on'): files[f'btn_{s}.png'] = button(s)
    for s in ('n', 'sel'): files[f'slot_{s}.png'] = slot(s)
    for name, im in files.items(): im.save(os.path.join(OUT, name))
    print(len(files), 'fichiers ->', os.path.relpath(OUT))


if __name__ == '__main__':
    main()
