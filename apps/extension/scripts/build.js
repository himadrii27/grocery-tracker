/**
 * Post-TypeScript build script.
 * TypeScript outputs to dist/ with subdirectories matching src/:
 *   dist/background/service-worker.js
 *   dist/content-scripts/swiggy-parser.js
 *   dist/popup/popup.js
 *
 * The manifest expects flat files at dist/:
 *   dist/background.js
 *   dist/content-swiggy.js
 *   dist/popup.js
 *   dist/popup.html
 *   dist/manifest.json
 *   dist/icons/
 *
 * This script performs those renames and copies.
 */

import { copyFileSync, mkdirSync, existsSync, cpSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dist = join(root, "dist");

// Ensure dist exists
mkdirSync(dist, { recursive: true });

// ─── Rename compiled files to match manifest expectations ─────────────────────

const renames = [
  ["dist/background/service-worker.js", "dist/background.js"],
  ["dist/content-scripts/swiggy-parser.js", "dist/content-swiggy.js"],
  ["dist/content-scripts/blinkit-interceptor.js", "dist/content-blinkit-interceptor.js"],
  ["dist/content-scripts/blinkit-parser.js", "dist/content-blinkit.js"],
  ["dist/popup/popup.js", "dist/popup.js"],
];

for (const [src, dest] of renames) {
  const srcPath = join(root, src);
  const destPath = join(root, dest);
  if (!existsSync(srcPath)) {
    console.error(`Missing compiled file: ${src}`);
    process.exit(1);
  }
  copyFileSync(srcPath, destPath);
  console.log(`  ${src} → ${dest}`);
}

// ─── Strip `export {}` from content scripts ───────────────────────────────────
// Content scripts are NOT ES modules — Chrome loads them as regular scripts.
// TypeScript emits `export {}` to treat files as modules (avoids name conflicts
// at compile time), but that syntax is invalid in a non-module context.
// background.js is fine because manifest declares it with "type": "module".

const contentScripts = [
  join(dist, "content-swiggy.js"),
  join(dist, "content-blinkit-interceptor.js"),
  join(dist, "content-blinkit.js"),
];
for (const filePath of contentScripts) {
  const code = readFileSync(filePath, "utf8");
  const stripped = code.replace(/^\s*export\s*\{\s*\};\s*$/m, "");
  writeFileSync(filePath, stripped, "utf8");
  console.log(`  Stripped export {} from ${filePath.replace(root + "/", "")}`);
}

// ─── Copy static files ────────────────────────────────────────────────────────

copyFileSync(join(root, "src/popup/popup.html"), join(dist, "popup.html"));
console.log("  src/popup/popup.html → dist/popup.html");

copyFileSync(join(root, "manifest.json"), join(dist, "manifest.json"));
console.log("  manifest.json → dist/manifest.json");

// ─── Copy icons (if they exist) ───────────────────────────────────────────────

const iconsDir = join(root, "icons");
if (existsSync(iconsDir)) {
  cpSync(iconsDir, join(dist, "icons"), { recursive: true });
  console.log("  icons/ → dist/icons/");
} else {
  // Create placeholder icons directory so manifest doesn't fail on load
  mkdirSync(join(dist, "icons"), { recursive: true });
  console.warn("  icons/ not found — creating empty dist/icons/ (add PNGs before publishing)");
}

console.log("\nExtension build complete → dist/");
