// MapLibre v6 loads its Web Worker relative to its own module URL, which the Next.js bundler
// moves. Serve the worker from public/ instead (SensorMap2D calls setWorkerUrl). Runs before dev/build
// so the copy always matches the installed maplibre-gl version.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/package.json"));
mkdirSync("public", { recursive: true });
copyFileSync(join(dist, "dist", "maplibre-gl-worker.mjs"), join("public", "maplibre-gl-worker.mjs"));
