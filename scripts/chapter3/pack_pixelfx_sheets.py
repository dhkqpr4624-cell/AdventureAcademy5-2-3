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

usage: python3 pack_pixelfx_sheets.py <pixelfx-final-dir> <repo-root> [name,name,...]
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
    # Phase 4 (Unit 3 Floor 3) — rendered into /home/claude/p4/pfx/<run>/... with the same PixelFX checkout
    "kenpei-saber-slash": ("kenpei", "melee/double-slash",
        {"palette": ["#141210", "#2a2620", "#4a443a", "#6e6a5c", "#9c9a8c", "#cfcdc2", "#f4f2ea"],
         "sparks": ["#f4f2ea", "#d9c48a", "#a8803e", "#6e4a24"], "seed": 6},
        ["--no-actor"], (0.033, 0.55), "public/assets/chapter3/floor3/vfx/kenpei-saber-slash.png", "monster"),
    "watcher-surveillance-sigil": ("watcher", "shadow/hex-sigil",
        {"palette": ["#06080a", "#0e1418", "#18222a", "#28363e", "#3e5258", "#5f7a78", "#8fae98", "#c8e0b0"], "seed": 7},
        ["--no-actor"], (0.3, 3.0), "public/assets/chapter3/floor3/vfx/watcher-surveillance-sigil.png", "monster"),
}
FRAMES = 8


def main(src_root, repo_root, only=None):
    for name, (run, effect_id, opts, flags, (t0, t1), out_rel, contract) in SHEETS.items():
        if only and name not in only:
            continue
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


# Phase 4 hotfix 2 — 카프's memory recovery (event map, GridSprite one-shot). `holy/memory-awakening` is a PixelFX
# remix authored for this project (scripts/chapter3/pixelfx-effects/memory-awakening.js, copied into the checkout's
# src/fx/holy/ and indexed with `node tools/index.mjs`). Every 2nd PixelFX frame (30 → 15 fps) is copied unchanged
# into a COLS-wide grid; the peak (full wrap, where the event map swaps 카프's outfit) is reported in the sidecar.
GOLD = ["#2a1a08", "#5a3a12", "#8a5a1c", "#c08a2a", "#e6b84a", "#f6d77e", "#fff0c0", "#ffffff"]
RED = ["#120608", "#2a0c10", "#4a1418", "#7a1e1e", "#a8322a", "#d65a3a", "#f09a6a", "#ffe2cc"]
GRIDS = {
    "kaf-memory-awakening": ("memory", "holy/memory-awakening", {}, ["--no-actor"], 2, 8, 1.0,
        "public/assets/chapter3/floor3/vfx/kaf-memory-awakening.png"),
    # Phase 5 · Floor 4 (아우내 장터 방어전). Options are passed with --opts; frames copied unchanged (every 2nd).
    "f4-light-flow": ("beam", "arcane/arcane-beam", {"palette": GOLD}, ["--no-actor"], 2, 6, 0.0,
        "public/assets/chapter3/floor4/vfx/light-flow.png"),
    "f4-record-door": ("door", "arcane/portal", {"palette": GOLD, "width": 22, "height": 38}, ["--no-actor"], 2, 6, 0.0,
        "public/assets/chapter3/floor4/vfx/record-door.png"),
    "f4-incoming-attack": ("attack", "projectiles/magic-missile", {"palette": RED}, ["--no-actor"], 2, 6, 0.9,
        "public/assets/chapter3/floor4/vfx/incoming-attack.png"),
    "f4-giant-shockwave": ("shockwave", "shadow/dark-explosion", {"palette": RED}, ["--no-actor"], 2, 8, 0.77,
        "public/assets/chapter3/floor4/vfx/giant-shockwave.png"),
    "f4-dungeon-rift": ("rift", "shadow/eclipse", {"palette": RED, "pearl": ["#5a1a1a", "#a8423a", "#f0a08a", "#fff2ea"]}, ["--no-actor"], 2, 10, 0.0,
        "public/assets/chapter3/floor4/vfx/dungeon-rift.png"),
    "f4-shield-crack": ("crack", "ice/ice-shatter", {}, ["--no-actor"], 2, 8, 0.62,
        "public/assets/chapter3/floor4/vfx/shield-crack.png"),
}


def pack_grid(src_root, repo_root, only=None):
    for name, (run, effect_id, opts, flags, step, cols, peak_s, out_rel) in GRIDS.items():
        if only and name not in only:
            continue
        base = os.path.join(src_root, run, effect_id)
        stem = effect_id.split("/")[1]
        meta = json.load(open(os.path.join(base, f"{stem}.json")))
        sheet = Image.open(os.path.join(base, f"{stem}.png")).convert("RGBA")
        info = meta["meta"]["pixelfx"]
        fps, w, h = info["fps"], info["frameSize"][0], info["frameSize"][1]
        picks = list(range(0, len(meta["frames"]), step))
        rows = (len(picks) + cols - 1) // cols
        out = Image.new("RGBA", (cols * w, rows * h), (0, 0, 0, 0))
        for i, index in enumerate(picks):
            r = meta["frames"][index]["frame"]
            out.alpha_composite(sheet.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"])), ((i % cols) * w, (i // cols) * h))
        dst = os.path.join(repo_root, out_rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        out.save(dst, optimize=True)
        out_fps = fps / step
        sidecar = {
            "generator": "pixelfx", "pixelfxCommit": PIXELFX_COMMIT, "effect": effect_id, "options": opts or "defaults (meta.options)",
            "renderCommand": f"node tools/render.mjs {effect_id} --sheet {' '.join(flags)}" + (f" --opts '{json.dumps(opts)}'" if opts else ""),
            "contract": "event-map GridSprite one-shot", "frames": len(picks), "cols": cols, "rows": rows, "frameSize": [w, h],
            "fps": out_fps, "durationMs": round(len(picks) / out_fps * 1000), "sourceFps": fps, "sourcePivot": info["pivot"],
            "sourceFramesUsed": picks, "peakSeconds": peak_s, "peakFrame": round(peak_s * out_fps),
        }
        json.dump(sidecar, open(dst[:-4] + ".json", "w"), ensure_ascii=False, indent=1)
        print(f"{name}: {out.size} {len(picks)} frames @ {out_fps} fps, pivot {info['pivot']}, peak frame {sidecar['peakFrame']}")


if __name__ == "__main__":
    only = set(sys.argv[3].split(",")) if len(sys.argv) > 3 else None
    main(sys.argv[1], sys.argv[2], only)
    pack_grid(sys.argv[1], sys.argv[2], only)
