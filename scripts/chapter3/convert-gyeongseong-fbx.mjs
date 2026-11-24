// Art pipeline (run once, offline): converts the supplied Gyeongseong FBX files into compact binary meshes
// ("GSM1") + base-colour JPEGs used by src/three/dungeon/gyeongseong/GyeongseongEnvironment.ts.
//
//   node scripts/chapter3/convert-gyeongseong-fbx.mjs <labUrl> <outDir>
//
// <labUrl> serves scripts/chapter3/gyeongseong-convert.html next to `three/` (three r181 incl. examples/jsm,
// for FBXLoader) and `models/*.fbx` (art-source/chapter3/gyeongseong). Requires Playwright + Chrome.
// Building textures are the embedded 2048px base-colour JPEGs, re-encoded to 1024px (normal/roughness/
// metallic maps are not used by the stylised Lambert materials). 12a-cracked-road is intentionally NOT
// converted: it must never appear on Floors 1–7.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const [labUrl, outDir] = process.argv.slice(2);
if (!labUrl || !outDir) throw new Error("usage: convert-gyeongseong-fbx.mjs <labUrl> <outDir>");
const require = createRequire(process.env.PLAYWRIGHT_REQUIRE_FROM ?? import.meta.url);
const { chromium } = require("playwright");

const BUILDING_SCALE = 0.01; // cm → world units (1 unit = 1 m)
const ROAD_SCALE = 0.005; // 400 cm tile → 2 world units (one lattice cell)
export const JOBS = [
  { id: "timber-shop", source: "01-timber-shop", scale: BUILDING_SCALE },
  { id: "brick-corner-shop", source: "02-brick-corner-shop", scale: BUILDING_SCALE },
  { id: "hanok-courtyard", source: "03-hanok-courtyard", scale: BUILDING_SCALE },
  { id: "brick-arch", source: "04-brick-arch", scale: BUILDING_SCALE },
  { id: "railway-station", source: "05-railway-station", scale: BUILDING_SCALE },
  { id: "platform-canopy", source: "06-platform-canopy", scale: BUILDING_SCALE },
  { id: "school", source: "07-school", scale: BUILDING_SCALE },
  // The newspaper office faces −Z in the source file; rotate so every façade faces +Z.
  { id: "newspaper-office", source: "08-newspaper-office", scale: BUILDING_SCALE, rotateY: Math.PI },
  { id: "road-tram", source: "07b-tram-road", scale: ROAD_SCALE },
  // Plain paving: the tram tile without its rails and rail beds (stone joints remain).
  { id: "road-paving", source: "07b-tram-road", scale: ROAD_SCALE, drop: ["Rail steel", "Cast iron"] },
  { id: "road-curb", source: "07a-curb-drain", scale: ROAD_SCALE },
];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--use-gl=swiftshader"] });
const page = await browser.newPage();
await page.goto(`${labUrl.replace(/\/$/, "")}/gyeongseong-convert.html#${encodeURIComponent(JSON.stringify(JOBS))}`);
await page.waitForFunction(() => window.__done, null, { timeout: 300000 });
const result = await page.evaluate(() => window.__out);
await browser.close();
fs.mkdirSync(path.join(outDir, "meshes"), { recursive: true });
const manifest = {};
for (const [id, entry] of Object.entries(result)) {
  fs.writeFileSync(path.join(outDir, "meshes", `${id}.bin`), Buffer.from(entry.b64, "base64"));
  manifest[id] = { vertices: entry.vertices, materials: entry.materials, bbox: entry.bbox.map((v) => v.map((n) => Math.round(n * 1000) / 1000)) };
}
fs.writeFileSync(path.join(outDir, "meshes", "manifest.json"), `${JSON.stringify(manifest, null, 1)}\n`);
console.log("converted", Object.keys(manifest).join(", "));
