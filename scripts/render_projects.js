#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const PAGE_LOCALES = [
  ["index.html", "ko"],
  ["index_en.html", "en"],
  ["index_de.html", "de"],
  ["index_ja.html", "ja"],
];
const STATUS_OPEN = '<ul class="status-list">';
const CATALOG_OPEN = '<div class="project-compact-grid">';
const COUNT_START = "<!-- PROJECT_COUNT:START -->";
const COUNT_END = "<!-- PROJECT_COUNT:END -->";
const STATUS_START = "<!-- PROJECT_STATUS:START -->";
const STATUS_END = "<!-- PROJECT_STATUS:END -->";
const CATALOG_START = "<!-- PROJECT_CATALOG:START -->";
const CATALOG_END = "<!-- PROJECT_CATALOG:END -->";

function parseArguments(argv) {
  const options = { check: false, root: path.join(__dirname, "..") };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--check") {
      options.check = true;
    } else if (argument === "--root") {
      index += 1;
      if (!argv[index]) throw new Error("--root requires a directory");
      options.root = path.resolve(argv[index]);
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  return options;
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function localized(value, locale, label) {
  if (typeof value === "string") return requireString(value, label);
  if (!value || typeof value !== "object") throw new Error(`${label} must include localized text`);
  return requireString(value[locale], `${label}.${locale}`);
}

function optionalLocalized(value, locale, label) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") throw new Error(`${label} must include localized text or null`);
  if (value[locale] == null) return "";
  return requireString(value[locale], `${label}.${locale}`);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function validateImage(image, label) {
  if (!image || typeof image !== "object") throw new Error(`${label} must be an object`);
  requireString(image.src, `${label}.src`);
  if (!Number.isInteger(image.width) || image.width <= 0) throw new Error(`${label}.width must be a positive integer`);
  if (!Number.isInteger(image.height) || image.height <= 0) throw new Error(`${label}.height must be a positive integer`);
}

function validateCatalog(data) {
  if (!data || data.version !== 1) throw new Error("assets/projects.json version must be 1");
  const locales = new Set(Array.isArray(data.locales) ? data.locales : []);
  for (const [, locale] of PAGE_LOCALES) {
    if (!locales.has(locale)) throw new Error(`assets/projects.json is missing locale ${locale}`);
    const countLabel = localized(data.projectCountLabel, locale, "projectCountLabel");
    if (!countLabel.includes("{count}")) throw new Error(`projectCountLabel.${locale} must include {count}`);
  }
  if (!Array.isArray(data.projects) || data.projects.length === 0) throw new Error("projects must be a non-empty array");

  const ids = new Set();
  for (const project of data.projects) {
    const id = requireString(project && project.id, "project.id");
    if (ids.has(id)) throw new Error(`duplicate project id: ${id}`);
    ids.add(id);
    requireString(project.panelStatus, `${id}.panelStatus`);
    requireString(project.cardStatus, `${id}.cardStatus`);
    if (project.href !== null && (typeof project.href !== "object" || Array.isArray(project.href))) {
      throw new Error(`${id}.href must be localized links or null`);
    }
    for (const [, locale] of PAGE_LOCALES) {
      localized(project.name, locale, `${id}.name`);
      localized(project.subtitle, locale, `${id}.subtitle`);
      localized(project.description, locale, `${id}.description`);
      localized(project.cta, locale, `${id}.cta`);
      if (project.href !== null) localized(project.href, locale, `${id}.href`);
    }

    const media = project.media;
    if (!media || typeof media !== "object") throw new Error(`${id}.media must be an object`);
    requireString(media.containerClass, `${id}.media.containerClass`);
    if (media.kind === "showcase") {
      validateImage(media.feature, `${id}.media.feature`);
      if (!Array.isArray(media.shots) || media.shots.length === 0) throw new Error(`${id}.media.shots must not be empty`);
      media.shots.forEach((shot, index) => validateImage(shot, `${id}.media.shots[${index}]`));
    } else if (media.kind === "image") {
      validateImage(media, `${id}.media`);
    } else if (media.kind === "concept") {
      requireString(media.cardClass, `${id}.media.cardClass`);
      if (!Array.isArray(media.titleLines) || media.titleLines.length === 0) throw new Error(`${id}.media.titleLines must not be empty`);
      media.titleLines.forEach((line, index) => requireString(line, `${id}.media.titleLines[${index}]`));
      requireString(media.meta, `${id}.media.meta`);
    } else {
      throw new Error(`${id}.media.kind is unsupported: ${media.kind}`);
    }
  }
  return { projects: data.projects, projectCountLabel: data.projectCountLabel };
}

function imageTag(image, locale, includeStoreMarker) {
  const className = image.className ? ` class="${escapeHtml(image.className)}"` : "";
  const marker = includeStoreMarker ? " data-store-asset" : "";
  return `<img${className} src="${escapeHtml(image.src)}" width="${image.width}" height="${image.height}" alt="${escapeHtml(localized(image.alt, locale, `${image.src}.alt`))}" loading="lazy"${marker}>`;
}

function renderMedia(media, locale) {
  const containerClass = escapeHtml(media.containerClass);
  if (media.kind === "showcase") {
    const shots = media.shots.map((shot) => imageTag(shot, locale, true)).join("");
    return `<div class="${containerClass}">${imageTag(media.feature, locale, true)}<div class="project-shot-row">${shots}</div></div>`;
  }
  if (media.kind === "image") {
    return `<div class="${containerClass}">${imageTag(media, locale, false)}</div>`;
  }

  const ariaLabel = optionalLocalized(media.ariaLabel, locale, "media.ariaLabel");
  const aria = ariaLabel ? ` aria-label="${escapeHtml(ariaLabel)}"` : "";
  const title = media.titleLines.map(escapeHtml).join("<br>");
  return `<div class="${containerClass}"><div class="${escapeHtml(media.cardClass)}"${aria}><strong>${title}</strong><span>${escapeHtml(media.meta)}</span></div></div>`;
}

function renderStatus(projects, locale) {
  return projects.map((project) => {
    const content = `<span><strong>${escapeHtml(localized(project.name, locale, `${project.id}.name`))}</strong><small>${escapeHtml(localized(project.subtitle, locale, `${project.id}.subtitle`))}</small></span><em>${escapeHtml(localized(project.panelStatus, locale, `${project.id}.panelStatus`))}</em>`;
    if (project.href === null) return `<li><div class="status-item">${content}</div></li>`;
    return `<li><a href="${escapeHtml(localized(project.href, locale, `${project.id}.href`))}">${content}</a></li>`;
  }).join("");
}

function renderCatalog(projects, locale) {
  return projects.map((project, index) => {
    const href = project.href === null ? "" : localized(project.href, locale, `${project.id}.href`);
    const cta = escapeHtml(localized(project.cta, locale, `${project.id}.cta`));
    const action = href
      ? `<a class="text-link" href="${escapeHtml(href)}">${cta}</a>`
      : `<span class="text-link">${cta}</span>`;
    return `<article class="project-card reveal">${renderMedia(project.media, locale)}<div class="project-copy"><div class="project-card-top"><span class="project-status">${escapeHtml(localized(project.cardStatus, locale, `${project.id}.cardStatus`))}</span><span class="project-index">${String(index + 1).padStart(2, "0")}</span></div><h3>${escapeHtml(localized(project.name, locale, `${project.id}.name`))}</h3><p>${escapeHtml(localized(project.description, locale, `${project.id}.description`))}</p>${action}</div></article>`;
  }).join("\n        ");
}

function renderProjectCount(projectCountLabel, locale, count) {
  return escapeHtml(localized(projectCountLabel, locale, "projectCountLabel")).replace("{count}", String(count));
}

function markerCount(html, marker) {
  return html.split(marker).length - 1;
}

function replaceMarkedContent(html, startMarker, endMarker, content, file) {
  if (markerCount(html, startMarker) !== 1 || markerCount(html, endMarker) !== 1) {
    throw new Error(`${file} must contain one ${startMarker} and ${endMarker}`);
  }
  const start = html.indexOf(startMarker) + startMarker.length;
  const end = html.indexOf(endMarker, start);
  if (end < start) throw new Error(`${file} has invalid project markers`);
  return html.slice(0, start) + content + html.slice(end);
}

function renderManagedProjectCount(html, content, file) {
  if (html.includes(COUNT_START) || html.includes(COUNT_END)) {
    return replaceMarkedContent(html, COUNT_START, COUNT_END, content, file);
  }
  const factsClass = html.indexOf('class="studio-facts"');
  if (factsClass < 0) throw new Error(`${file} is missing studio-facts`);
  const factsOpenEnd = html.indexOf(">", factsClass);
  const spanOpen = html.indexOf("<span>", factsOpenEnd);
  const contentStart = spanOpen + "<span>".length;
  const spanClose = html.indexOf("</span>", contentStart);
  if (factsOpenEnd < 0 || spanOpen < 0 || spanClose < contentStart) {
    throw new Error(`${file} project count is not available`);
  }
  return html.slice(0, contentStart) + COUNT_START + content + COUNT_END + html.slice(spanClose);
}

function renderManagedStatus(html, content, file) {
  if (html.includes(STATUS_START) || html.includes(STATUS_END)) {
    return replaceMarkedContent(html, STATUS_START, STATUS_END, content, file);
  }
  const open = html.indexOf(STATUS_OPEN);
  if (open < 0) throw new Error(`${file} is missing ${STATUS_OPEN}`);
  const contentStart = open + STATUS_OPEN.length;
  const close = html.indexOf("</ul>", contentStart);
  if (close < 0) throw new Error(`${file} status list is not closed`);
  return html.slice(0, contentStart) + STATUS_START + content + STATUS_END + html.slice(close);
}

function renderManagedCatalog(html, content, file) {
  const formatted = `\n        ${content}\n      `;
  if (html.includes(CATALOG_START) || html.includes(CATALOG_END)) {
    return replaceMarkedContent(html, CATALOG_START, CATALOG_END, formatted, file);
  }
  const open = html.indexOf(CATALOG_OPEN);
  if (open < 0) throw new Error(`${file} is missing ${CATALOG_OPEN}`);
  const contentStart = open + CATALOG_OPEN.length;
  const sectionEnd = html.indexOf("</section>", contentStart);
  const close = html.lastIndexOf("</div>", sectionEnd);
  if (sectionEnd < 0 || close < contentStart) throw new Error(`${file} project catalog is not closed`);
  return html.slice(0, contentStart) + CATALOG_START + formatted + CATALOG_END + html.slice(close);
}

function renderHome(html, projects, projectCountLabel, locale, file) {
  const withCount = renderManagedProjectCount(html, renderProjectCount(projectCountLabel, locale, projects.length), file);
  const withStatus = renderManagedStatus(withCount, renderStatus(projects, locale), file);
  return renderManagedCatalog(withStatus, renderCatalog(projects, locale), file);
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const dataPath = path.join(options.root, "assets", "projects.json");
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const { projects, projectCountLabel } = validateCatalog(data);
  const changed = [];

  for (const [file, locale] of PAGE_LOCALES) {
    const filePath = path.join(options.root, file);
    const current = fs.readFileSync(filePath, "utf8");
    const rendered = renderHome(current, projects, projectCountLabel, locale, file);
    if (rendered === current) continue;
    changed.push(file);
    if (!options.check) fs.writeFileSync(filePath, rendered);
  }

  if (options.check && changed.length > 0) {
    console.error(`project catalog out of date: ${changed.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  if (options.check) console.log(`project catalog check: PASS (${PAGE_LOCALES.length} pages)`);
  else console.log(`project catalog render: PASS (${PAGE_LOCALES.length} pages, ${changed.length} updated)`);
}

try {
  main();
} catch (error) {
  console.error(`project catalog render failed: ${error.message}`);
  process.exitCode = 1;
}
