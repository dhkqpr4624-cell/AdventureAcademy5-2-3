"""Generate the placeholder player sprite (anonymous cloaked silhouette) used in the Unit 3 intro.

The repository has no player-character sprite (the game is first-person). The intro script asks for the
player to stand among the party, so this draws a neutral hooded silhouette in the same 380x600 frame,
pixel grid (4x) and foot line as the other story NPC sprites. Replace public/assets/chapter3/actors/player-*.png
with real art later; no code change is needed.
usage: python3 scripts/chapter3/make_player_silhouette.py <out_dir>
"""
import sys
from PIL import Image, ImageDraw, ImageFilter

out = sys.argv[1]
S = 4                     # pixel grid size (sprite is drawn at 95x150 then scaled x4)
W, H = 95, 150
img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
body = (24, 30, 46, 255)
# boots / legs
d.rectangle([36, 128, 44, 146], fill=body); d.rectangle([51, 128, 59, 146], fill=body)
d.rectangle([33, 141, 45, 147], fill=body); d.rectangle([50, 141, 62, 147], fill=body)
# cloak (trapezoid) + sleeves
d.polygon([(30, 70), (65, 70), (76, 132), (19, 132)], fill=body)
d.polygon([(28, 74), (20, 110), (27, 112), (34, 80)], fill=body)
d.polygon([(67, 74), (75, 110), (68, 112), (61, 80)], fill=body)
# hooded head (chibi proportions)
d.ellipse([18, 8, 77, 72], fill=body)
d.polygon([(44, 2), (56, 10), (40, 12)], fill=body)            # hood tip
# hood opening (slightly lighter, faceless)
d.ellipse([29, 30, 66, 66], fill=(36, 45, 66, 255))
img = img.resize((W * S, H * S), Image.NEAREST)
# rim light: thin warm outline so it reads against dark interiors
alpha = img.getchannel("A")
edge = alpha.filter(ImageFilter.MaxFilter(9))
rim = Image.new("RGBA", img.size, (232, 196, 120, 0)); rim.putalpha(edge.point(lambda v: 200 if v else 0))
canvas = Image.new("RGBA", (380, 600), (0, 0, 0, 0))
ox, oy = (380 - img.width) // 2, 591 - img.height + 4 * S - 8  # feet on the shared 591px foot line
canvas.alpha_composite(rim, (ox, oy)); canvas.alpha_composite(img, (ox, oy))
canvas = canvas.crop((0, 0, 380, 600))
canvas.save(f"{out}/player-standing.png")
print("bbox", canvas.getbbox())
