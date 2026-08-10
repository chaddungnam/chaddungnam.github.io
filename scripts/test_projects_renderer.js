#!/usr/bin/env node

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoDir = path.join(__dirname, "..");
const renderer = path.join(__dirname, "render_projects.js");
const dataFile = path.join(repoDir, "assets", "projects.json");
const pages = [
  ["index.html", "ko", "4 active projects"],
  ["index_en.html", "en", "4 active projects"],
  ["index_de.html", "de", "4 aktive Projekte"],
  ["index_ja.html", "ja", "4 active projects"],
];

function runRenderer(args) {
  return spawnSync(process.execPath, [renderer, ...args], {
    cwd: repoDir,
    encoding: "utf8",
  });
}

function output(result) {
  return `${result.stdout || ""}${result.stderr || ""}`;
}

test("checked-in home pages match the single project catalog", () => {
  assert.ok(fs.existsSync(renderer), "scripts/render_projects.js must exist");
  assert.ok(fs.existsSync(dataFile), "assets/projects.json must exist");

  const result = runRenderer(["--check"]);
  assert.equal(result.status, 0, output(result));
  assert.match(output(result), /project catalog check: PASS/);
});

test("adding one project to the data renders the project catalog in every locale", () => {
  assert.ok(fs.existsSync(renderer), "scripts/render_projects.js must exist");
  assert.ok(fs.existsSync(dataFile), "assets/projects.json must exist");

  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "house-duck-projects-"));
  try {
    fs.mkdirSync(path.join(fixtureRoot, "assets"), { recursive: true });
    fs.copyFileSync(dataFile, path.join(fixtureRoot, "assets", "projects.json"));
    for (const [file] of pages) fs.copyFileSync(path.join(repoDir, file), path.join(fixtureRoot, file));

    const fixtureDataPath = path.join(fixtureRoot, "assets", "projects.json");
    const fixtureData = JSON.parse(fs.readFileSync(fixtureDataPath, "utf8"));
    fixtureData.projects.push({
      id: "future-app",
      name: "Future App",
      href: {
        ko: "future-app/?lang=ko",
        en: "future-app/?lang=en",
        de: "future-app/?lang=de",
        ja: "future-app/?lang=ja",
      },
      panelStatus: "Prototype",
      cardStatus: "Prototype",
      subtitle: {
        ko: "미래 앱",
        en: "Future app",
        de: "Zukünftige App",
        ja: "将来のアプリ",
      },
      description: {
        ko: "데이터 한 곳에서 추가한 미래 앱.",
        en: "A future app added from one data source.",
        de: "Eine zukünftige App aus einer Datenquelle.",
        ja: "一つのデータソースから追加した将来のアプリ。",
      },
      cta: {
        ko: "프로젝트 보기 →",
        en: "View project →",
        de: "Projekt ansehen →",
        ja: "プロジェクトを見る →",
      },
      media: {
        kind: "image",
        containerClass: "project-media",
        src: "assets/house-duck-logo.png",
        width: 512,
        height: 512,
        alt: {
          ko: "Future App 이미지",
          en: "Future App image",
          de: "Future-App-Bild",
          ja: "Future Appの画像",
        },
      },
    });
    fs.writeFileSync(fixtureDataPath, `${JSON.stringify(fixtureData, null, 2)}\n`);

    const stale = runRenderer(["--root", fixtureRoot, "--check"]);
    assert.notEqual(stale.status, 0, "--check must reject stale generated HTML");
    assert.match(output(stale), /out of date/);

    const rendered = runRenderer(["--root", fixtureRoot]);
    assert.equal(rendered.status, 0, output(rendered));

    const checked = runRenderer(["--root", fixtureRoot, "--check"]);
    assert.equal(checked.status, 0, output(checked));

    for (const [file, locale, projectCount] of pages) {
      const html = fs.readFileSync(path.join(fixtureRoot, file), "utf8");
      assert.match(html, /<h3>Future App<\/h3>/, `${file} project card`);
      assert.match(html, new RegExp(fixtureData.projects.at(-1).description[locale].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${file} localized copy`);
    }
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("compact home rendering does not require duplicate project status regions", () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "house-duck-compact-projects-"));
  try {
    fs.mkdirSync(path.join(fixtureRoot, "assets"), { recursive: true });
    fs.copyFileSync(dataFile, path.join(fixtureRoot, "assets", "projects.json"));
    for (const [file] of pages) {
      const source = fs.readFileSync(path.join(repoDir, file), "utf8")
        .replace(/<div class="studio-facts"[\s\S]*?<\/div>/, "")
        .replace(/<aside class="studio-status-panel[\s\S]*?<\/aside>/, "");
      fs.writeFileSync(path.join(fixtureRoot, file), source);
    }

    const rendered = runRenderer(["--root", fixtureRoot]);
    assert.equal(rendered.status, 0, output(rendered));
    for (const [file] of pages) {
      const html = fs.readFileSync(path.join(fixtureRoot, file), "utf8");
      assert.match(html, /class="project-compact-grid/);
      assert.doesNotMatch(html, /class="studio-status-panel|class="studio-facts/);
    }
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
