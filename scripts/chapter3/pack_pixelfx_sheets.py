"""
Phase 3: pack PixelFX renders into the game's existing one-shot sprite-sheet contracts.

PixelFX (patch-gg/pixelfx 0.3.1, commit 5294518) renders each effect with
  node tools/render.mjs <id> --sheet [--no-actor] --opts '<json>'
into an Aseprite-style sheet (30 fps, many frames). The game plays 8-frame horizontal strips:
  * monster attack / defeat VFX (Unit3MonsterAttackVfx): 8 square cells, 640 ms, steps(7)
  * weapon VFX (DungeonScreen .weapon-*-vfx): 8 square cells, 1 s, steps(8)
`explosions/smoke-burst-bare` is a PixelFX remix authored for this project (scripts/chapter3/pixelfx-effects/,
copied into the PixelFX checkout's src/fx/explosions/ and indexed with `node tools/index.mjs`): smoke-bomb without
the thrown canister, fuse and white pop, so only the smoke remains.

This script only *selects* 8 PixelFX frames (evenly spaced inside the effect's own time window) and copies
them unchanged — no resampling, recolouring or drawing — into square transparent cells (frame centred,
same offset in every cell so nothing jumps). A JSON sidecar records the PixelFX id, options and frames used.

usage: python3 pack_pixelfx_sheets.py <pixelfx-final-dir> <repo-root>
"""
import json
import os
import sys
from PIL import Image

PIXELFX_COMMIT = "5294518ce7c72e48b6100a744596e0acf57f2826"

# name: (pixelfx run dir, effect id, options, render flags, time window [s], output path, contract)
SHEETS = {
    "uibyeong-hwando-slash": ("hwando", "melee/sword-slash",
        {"palette": ["#3a3f4a", "#5d6472", "#858d9c", "#adb5c2", "#d3d9e2", "#eef2f7", "#ffffff"],
         "sparks": ["#ffffff", "#e8edf4", "#b9c1cd", "#8a93a2"], "radius": 50},
        ["--no-actor"], (0.033, 0.5), "public/assets/combat/vfx/uibyeong-hwando-slash.png", "weapon"),
    "sycophant-dark-burst": ("sycophant", "arcane/mana-burst",
        {"palette": ["#020103", "#08060a", "#120d16", "#1e1622", "#2e2230", "#4a3828", "#7a5c30", "#a8823e"], "light": 0.3},
        [], (0.1, 1.45), "public/assets/chapter3/floor2/vfx/sycophant-dark-burst.png", "monster"),
    "informer-shadow-fog": ("informer", "explosions/smoke-burst-bare",
        {"palette": ["#06040a", "#120a1c", "#1f1230", "#2e1a48", "#432468", "#5e3290", "#8048b8"], "light": 0.4},
        [], (0.97, 4.3), "public/assets/chapter3/floor2/vfx/informer-shadow-fog.png", "monster"),
    "ito-phantom-dark-blast": ("ito", "shadow/dark-explosion",
        {"palette": ["#08070b", "#16131d", "#26212f", "#3a3346", "#544c63", "#77708a", "#a59fb8", "#dcd8e6"]},
        [], (0.1, 2.5), "public/assets/chapter3/floor2/vfx/ito-phantom-dark-blast.png", "monster"),
    "sycophant-black-smoke": ("smoke", "explosions/smoke-burst-bare",
        {"palette": ["#030204", "#0a080d", "#151219", "#221e27", "#322d38", "#47414e", "#605968"], "light": 0.2},
        [], (1.0, 4.6), "public/assets/chapter3/floor2/vfx/sycophant-black-smoke.png", "monster"),
}
FRAMES = 8


def main(src_root, repo_root):
    for name, (run, effect_id, opts, flags, (t0, t1), out_rel, contract) in SHEETS.items():
        base = os.path.join(src_root, run, effect_id)
        stem = effect_id.split("/")[1]
        meta = json.load(open(os.path.join(base, f"{stem}.json")))
        sheet = Image.open(os.path.join(base, f"{stem}.png")).convert("RGBA")
        info = meta["meta"]["pixelfx"]
        fps, w, h = info["fps"], info["frameSize"][0], info["frameSize"][1]
        cell = max(w, h)
        times = [t0 + (t1 - t0) * i / (FRAMES - 1) for i in range(FRAMES)]
        picks = [min(len(meta["frames"]) - 1, round(t * fps)) for t in times]
        out = Image.new("RGBA", (cell * FRAMES, cell), (0, 0, 0, 0))
        ox, oy = (cell - w) // 2, (cell - h) // 2
        for i, index in enumerate(picks):
            r = meta["frames"][index]["frame"]
            out.alpha_composite(sheet.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"])), (i * cell + ox, oy))
        dst = os.path.join(repo_root, out_rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        out.save(dst, optimize=True)
        sidecar = {
            "generator": "pixelfx", "pixelfxCommit": PIXELFX_COMMIT, "effect": effect_id, "options": opts,
            "renderCommand": f"node tools/render.mjs {effect_id} --sheet {' '.join(flags)} --opts '{json.dumps(opts)}'".replace("  ", " "),
            "contract": contract, "frames": FRAMES, "cell": [cell, cell], "sheet": [cell * FRAMES, cell],
            "sourceFps": fps, "sourceFrameSize": [w, h], "sourcePivot": info["pivot"],
            "timeWindowSeconds": [t0, t1], "sourceFramesUsed": picks,
            "playback": "8 frames, 640 ms, steps(7), once" if contract == "monster" else "8 frames, 1000 ms (8 fps), steps(8), once",
        }
        json.dump(sidecar, open(dst[:-4] + ".json", "w"), ensure_ascii=False, indent=1)
        alpha = out.getchannel("A")
        print(f"{name}: {out.size} cell {cell} frames {picks} alpha {alpha.getextrema()} corner {out.getpixel((0, 0))}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
