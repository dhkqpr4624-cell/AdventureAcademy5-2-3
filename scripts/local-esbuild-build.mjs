// Offline stand-in for `vite build` (npm registry unreachable in this environment).
// Mirrors what this project needs from Vite: base path, hashed asset imports (*.png),
// `?raw` text imports, CSS bundling, `import.meta.env.{BASE_URL,DEV,MODE,PROD}` and public/ copy.
// Usage: node scripts/local-esbuild-build.mjs [--base=/AdventureAcademy5-2-2/] [--out=dist] [--metafile=meta.json]
import { build } from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const rawBase = args.base ?? "/";
const base = rawBase === "/" ? "/" : `/${rawBase.replace(/^\/+|\/+$/g, "")}/`;
const outDir = path.resolve(args.out ?? "dist");
const root = process.cwd();

rmSync(outDir, { recursive: true, force: true });
mkdirSync(path.join(outDir, "assets"), { recursive: true });
cpSync(path.join(root, "public"), outDir, { recursive: true });

const rawPlugin = {
  name: "raw",
  setup(b) {
    b.onResolve({ filter: /\?raw$/ }, (a) => ({ path: path.resolve(a.resolveDir, a.path.replace(/\?raw$/, "")), namespace: "raw" }));
    b.onLoad({ filter: /.*/, namespace: "raw" }, (a) => ({ contents: `export default ${JSON.stringify(readFileSync(a.path, "utf8"))};`, loader: "js" }));
  },
};

const result = await build({
  entryPoints: { main: path.join(root, "src/main.tsx") },
  bundle: true,
  splitting: true,
  format: "esm",
  outdir: path.join(outDir, "assets"),
  entryNames: "[name]-[hash]",
  chunkNames: "chunk-[hash]",
  assetNames: "[name]-[hash]",
  publicPath: `${base}assets`,
  loader: { ".png": "file", ".jpg": "file", ".webp": "file", ".gif": "file", ".wav": "file", ".mp3": "file" },
  jsx: "automatic",
  target: "es2022",
  minify: true,
  sourcemap: false,
  metafile: true,
  define: {
    "import.meta.env.BASE_URL": JSON.stringify(base),
    "import.meta.env.DEV": "false",
    "import.meta.env.PROD": "true",
    "import.meta.env.MODE": '"production"',
    "process.env.NODE_ENV": '"production"',
  },
  plugins: [rawPlugin],
  logLevel: "warning",
});

const outputs = Object.keys(result.metafile.outputs).map((p) => path.relative(outDir, path.resolve(root, p)));
const mainJs = outputs.find((p) => /assets\/main-.*\.js$/.test(p));
const mainCss = outputs.find((p) => /assets\/main-.*\.css$/.test(p));
let html = readFileSync(path.join(root, "index.html"), "utf8");
html = html.replace(/\s*<script type="module" src="\/src\/main.tsx"><\/script>/, "");
html = html.replace("</head>", `    <script type="module" crossorigin src="${base}${mainJs}"></script>\n${mainCss ? `    <link rel="stylesheet" crossorigin href="${base}${mainCss}">\n` : ""}  </head>`);
writeFileSync(path.join(outDir, "index.html"), html);
if (args.metafile) writeFileSync(args.metafile, JSON.stringify(result.metafile));
console.log(`built ${outputs.length} files to ${path.relative(root, outDir)} (base ${base})`);
