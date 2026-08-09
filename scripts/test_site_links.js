const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const ignoredDirectories = new Set([".git", ".worktrees", "node_modules", "tistory-skin"]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || ignoredDirectories.has(entry.name)) return [];
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const htmlFiles = walk(root).filter((file) => file.endsWith(".html"));
const failures = [];

function routeToFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (_error) {
    return null;
  }
  const relative = decoded.replace(/^\/+/, "");
  if (!relative || decoded.endsWith("/")) return path.join(root, relative, "index.html");
  const direct = path.join(root, relative);
  if (path.extname(relative)) return direct;
  return fs.existsSync(direct) && fs.statSync(direct).isDirectory()
    ? path.join(direct, "index.html")
    : direct;
}

function resolveInternal(raw, sourceFile) {
  if (!raw || /^(?:mailto:|tel:|javascript:|data:)/i.test(raw)) return null;
  let url;
  try {
    url = new URL(raw, `https://houseduck.in/${path.relative(root, sourceFile).replaceAll(path.sep, "/")}`);
  } catch (_error) {
    failures.push(`${path.relative(root, sourceFile)}: invalid URL ${raw}`);
    return null;
  }
  if (url.origin !== "https://houseduck.in") return null;
  return { file: routeToFile(url.pathname), fragment: url.hash.slice(1), raw };
}

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  for (const match of html.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
    const target = resolveInternal(match[1], file);
    if (!target) continue;
    if (!target.file || !fs.existsSync(target.file)) {
      failures.push(`${path.relative(root, file)}: missing ${target.raw}`);
      continue;
    }
    if (!target.fragment || target.fragment.startsWith("/")) continue;
    const targetHtml = fs.readFileSync(target.file, "utf8");
    const escaped = target.fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!new RegExp(`(?:id|name)=["']${escaped}["']`).test(targetHtml)) {
      failures.push(`${path.relative(root, file)}: missing fragment ${target.raw}`);
    }
  }
}

const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
for (const [, location] of sitemap.matchAll(/<loc>(https:\/\/houseduck\.in[^<]+)<\/loc>/g)) {
  const target = resolveInternal(location, path.join(root, "sitemap.xml"));
  if (!target?.file || !fs.existsSync(target.file)) {
    failures.push(`sitemap.xml: missing ${location}`);
    continue;
  }
  const html = fs.readFileSync(target.file, "utf8");
  if (/http-equiv=["']refresh["']|location\.(?:replace|href)\s*=/i.test(html)) {
    failures.push(`sitemap.xml: redirect URL must be excluded: ${location}`);
  }
}

assert.deepEqual(failures, [], `site link contract failed:\n${failures.join("\n")}`);
console.log(`site links: PASS (${htmlFiles.length} HTML files)`);
