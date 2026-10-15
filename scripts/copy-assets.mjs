import { copyFileSync, mkdirSync, readdirSync, rmSync, existsSync, statSync, utimesSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function syncDir(src, dst) {
  mkdirSync(dst, { recursive: true });
  const names = new Set();
  for (const e of readdirSync(src, { withFileTypes: true })) {
    names.add(e.name);
    const s = join(src, e.name);
    const d = join(dst, e.name);
    if (e.isDirectory()) {
      if (existsSync(d) && !statSync(d).isDirectory()) rmSync(d, { force: true });
      syncDir(s, d);
    } else if (e.isFile()) {
      const ss = statSync(s);
      const ds = existsSync(d) ? statSync(d) : null;
      if (ds && ds.isDirectory()) rmSync(d, { recursive: true, force: true });
      if (!ds || !ds.isFile() || ds.size !== ss.size || Math.floor(ds.mtimeMs) !== Math.floor(ss.mtimeMs)) {
        copyFileSync(s, d);
        utimesSync(d, ss.atime, ss.mtime);
      }
    }
  }
  for (const e of readdirSync(dst)) {
    if (!names.has(e)) rmSync(join(dst, e), { recursive: true, force: true });
  }
}

/** Incremental copy of every subfolder of `from` except `originals/` into `to`; removes stale targets. */
export function copyAssets(from = "../05-assets/files", to = "public/media") {
  const src = resolve(root, from);
  const dst = resolve(root, to);
  if (!existsSync(src)) {
    // Standalone export: the originals folder is not part of the repository; the committed public/media is used as is.
    if (existsSync(dst)) {
      console.log(`copy-assets: source ${src} not found, keeping existing ${dst}`);
      return;
    }
    throw new Error(`copy-assets: missing source ${src} and no ${dst}`);
  }
  mkdirSync(dst, { recursive: true });
  const dirs = readdirSync(src, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== "originals").map((e) => e.name);
  for (const n of dirs) syncDir(join(src, n), join(dst, n));
  for (const e of readdirSync(dst)) if (!dirs.includes(e)) rmSync(join(dst, e), { recursive: true, force: true });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) copyAssets();
