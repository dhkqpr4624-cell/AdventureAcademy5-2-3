"""Import the Unit 3 Phase 1 asset ZIP into public/assets/chapter3 and src/assets.

usage: python3 scripts/chapter3/prepare_phase1_assets.py <extracted phase_1_assets dir> <repo root>

- Copies map layers to ASCII paths (Korean file names are kept out of URLs).
- Map layers that are 1670/1671 px wide are kept as-is; the renderer stretches every layer to the
  shared 1672x941 map box (<=0.12% horizontal difference).
- Tram: cropped to its visible bounds; the crop origin (x, y) is written to tram.json so the original rail
  height is preserved.
- Holo globe: the sheet is drawn with artPixel=2 (every 2x2 block is identical, verified below), so it is
  repacked losslessly at half resolution (4096x1536) to stay under the 4096px texture limit of many tablets.
  The JSON keeps every frame, duration and the pivot; coordinates are scaled by 0.5 and the original values
  are recorded in meta.sourceScale.
"""
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

src = Path(sys.argv[1])
root = Path(sys.argv[2])
pub = root / "public/assets/chapter3"
(pub / "maps/hq").mkdir(parents=True, exist_ok=True)
(pub / "maps/arrival").mkdir(parents=True, exist_ok=True)
(pub / "maps/basecamp").mkdir(parents=True, exist_ok=True)
(pub / "vfx").mkdir(parents=True, exist_ok=True)
(pub / "illust").mkdir(parents=True, exist_ok=True)
(root / "public/assets/title").mkdir(parents=True, exist_ok=True)

copies = {
    "map/sky.png": "maps/sky.png",
    "map/작전본부/작전본부_cloudatmosphere.png": "maps/hq/cloud-atmosphere.png",
    "map/작전본부/작전본부_props.png": "maps/hq/sky-props.png",
    "map/작전본부/작전본부_backgroundOutside.png": "maps/hq/background-outside.png",
    "map/작전본부/작전본부_background.png": "maps/hq/background.png",
    "map/작전본부/작전본부_foreground.png": "maps/hq/foreground.png",
    "map/작전본부/작전본부_ground.png": "maps/hq/ground.png",
    "map/인트로 도착 맵/인트로맵_background.png": "maps/arrival/background.png",
    "map/인트로 도착 맵/인트로맵_foreground.png": "maps/arrival/foreground.png",
    "map/인트로 도착 맵/인트로맵_ground.png": "maps/arrival/ground.png",
    "map/베이스캠프/베이스캠프_cloud.png": "maps/basecamp/cloud.png",
    "map/베이스캠프/베이스캠프_background.png": "maps/basecamp/background.png",
    "map/베이스캠프/베이스캠프_foreground.png": "maps/basecamp/foreground.png",
    "map/베이스캠프/베이스캠프_ground.png": "maps/basecamp/ground.png",
    "map/베이스캠프/베이스캠프_dungeonEntrance.png": "maps/basecamp/dungeon-entrance.png",
    "illust/intro/나라를 집어삼키는 거대한 포탈 illust.png": "illust/nation-swallowing-portal.png",
}
for a, b in copies.items():
    shutil.copyfile(src / a, pub / b)

# map/베이스캠프/sky.png is byte-identical to map/sky.png -> the base camp uses maps/sky.png.
assert (src / "map/sky.png").read_bytes() == (src / "map/베이스캠프/sky.png").read_bytes()

shutil.copyfile(src / "illust/메인 title 화면 illust.png", root / "public/assets/title/chapter3-title.png")

tram = Image.open(src / "map/베이스캠프/베이스캠프_전차.png").convert("RGBA")
box = tram.getbbox()
tram.crop(box).save(pub / "maps/basecamp/tram.png", optimize=True)
(pub / "maps/basecamp/tram.json").write_text(json.dumps(
    {"source": "베이스캠프_전차.png", "sourceSize": list(tram.size), "x": box[0], "y": box[1],
     "w": box[2] - box[0], "h": box[3] - box[1]}, indent=2))

g = src / "map/작전본부/holo-command-globe-all"
meta = json.loads((g / "holo-command-globe.json").read_text())
atlas = np.array(Image.open(g / "holo-command-globe.png").convert("RGBA"))
half = atlas[0::2, 0::2]
assert all((atlas[dy::2, dx::2] == half).all() for dy in (0, 1) for dx in (0, 1)), "atlas is not 2x pixel art"
Image.fromarray(half).save(pub / "vfx/holo-command-globe.png", optimize=True)
k = 0.5
for frame in meta["frames"]:
    for key in ("frame", "spriteSourceSize"):
        frame[key] = {name: int(value * k) for name, value in frame[key].items()}
    frame["sourceSize"] = {name: int(value * k) for name, value in frame["sourceSize"].items()}
meta["meta"]["size"] = {"w": half.shape[1], "h": half.shape[0]}
meta["meta"]["scale"] = "1"
px = meta["meta"]["pixelfx"]
px["frameSize"] = [int(v * k) for v in px["frameSize"]]
px["pivot"] = [v * k for v in px["pivot"]]
px["artPixel"] = 1
meta["meta"]["sourceScale"] = {"factor": k, "note": "repacked from the 8192x3072 artPixel=2 sheet; pivot/frames scaled by 0.5"}
(pub / "vfx/holo-command-globe.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))

kaiden = root / "src/assets/portraits/chapter3/kaiden"
kaiden.mkdir(parents=True, exist_ok=True)
for a, b in {"kaiden_portrait.png": "default.png", "카이든_smile.png": "smile.png", "카이든_angry.png": "angry.png",
             "카이든_shout.png": "shout.png", "카이든_shame.png": "shame.png"}.items():
    shutil.copyfile(src / a, kaiden / b)
print("ok", box)
