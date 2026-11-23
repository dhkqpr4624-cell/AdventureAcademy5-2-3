// Art pipeline (offline, run once): Gyeongseong building FBX from "3d assets.zip" → GSM2 meshes + textures.
//   node scripts/chapter3/convert-gyeongseong-buildings.mjs <labUrl> <outDir>
// <labUrl> serves gyeongseong-buildings-convert.html next to `three/` (three r181 incl. examples/jsm) and
// `models2/<n>/<n>.fbx` (art-source/chapter3/gyeongseong-buildings). Needs Playwright + Chrome.
//
// Texture note: the FBX files reference their textures by absolute Tripo-server / Blender temp paths
// (e.g. ".../tripo_image_<id>_0_0.jpg", "C:\\...\\Color.jpg") that do not exist next to the files, so loading
// the FBX directly leaves the material without its map (404 → flat/black). The supplied JPEGs are bound
// explicitly instead (TEXTURES below) and copied to public/assets/chapter3/gyeongseong/textures.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const [labUrl, outDir] = process.argv.slice(2);
if (!labUrl || !outDir) throw new Error("usage: convert-gyeongseong-buildings.mjs <labUrl> <outDir>");
const require = createRequire(process.env.PLAYWRIGHT_REQUIRE_FROM ?? import.meta.url);
const { chromium } = require("playwright");

export const JOBS = [
  { id: "gs-timber-shop", fbx: "models2/1/1.fbx", texture: "models2/1/tripo_convert_b87dc502-576f-4957-87cb-dd14ed825850.fbm/1_tex.jpg" },
  { id: "gs-brick-corner", fbx: "models2/2/2.fbx", texture: "models2/2/2/2_tex.jpg" },
  { id: "gs-hanok", fbx: "models2/3/3.fbx", texture: "models2/3/3/3_tx.jpg" },
  { id: "gs-station", fbx: "models2/4/4.fbx", texture: "models2/4/4/tripo_image_0237cc0c-a8a3-417e-b349-a96bcd497f34_0_0.jpg" },
  // 5.fbx is Z-up (Blender export, scale 100) with its entrance towards −Z after the X rotation.
  { id: "gs-mansion", fbx: "models2/5/5.fbx", texture: "models2/5/5_tex.jpg", rotateX: -Math.PI / 2, rotateY: Math.PI },
];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--use-gl=swiftshader"] });
const page = await browser.newPage();
await page.goto(`${labUrl.replace(/\/$/, "")}/gyeongseong-buildings-convert.html#${encodeURIComponent(JSON.stringify(JOBS))}`);
await page.waitForFunction(() => window.__done, null, { timeout: 600000 });
const result = await page.evaluate(() => window.__out);
await browser.close();
fs.mkdirSync(path.join(outDir, "meshes"), { recursive: true });
const manifest = {};
for (const [id, entry] of Object.entries(result)) {
  fs.writeFileSync(path.join(outDir, "meshes", `${id}.bin`), Buffer.from(entry.b64, "base64"));
  if (id.endsWith("-lod1")) { manifest[id.replace(/-lod1$/, "")] ??= {}; }
  const { b64, ...rest } = entry;
  void b64;
  manifest[id] = rest;
}
fs.writeFileSync(path.join(outDir, "meshes", "buildings-manifest.json"), `${JSON.stringify(manifest, null, 1)}\n`);
console.log(JSON.stringify(manifest, null, 1));
