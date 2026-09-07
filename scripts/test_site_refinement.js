#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const support = require('../assets/support-site.js');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function element() {
  return {value: '', hidden: true, textContent: '', handlers: {}, attributes: {},
    addEventListener(type, fn) { this.handlers[type] = fn; },
    setAttribute(key, value) { this.attributes[key] = value; },
    focus() { this.focused = true; }, select() { this.selected = true; }};
}
function fixture(lang, message = '') {
  const nodes = Object.fromEntries(['.support-counter', '[data-mail-draft]',
    '[data-mail-status]', '[data-mail-preview]', '[data-mail-open]', '[data-mail-copy]']
    .map(selector => [selector, element()]));
  const form = element();
  form.dataset = {language: lang};
  form.elements = {category: {value: 'Purchase / restore'}, platform: {value: 'Android'}, message: element()};
  form.elements.message.value = message;
  form.querySelector = selector => nodes[selector];
  const win = {navigator: {}, location: {href: 'https://example.invalid/support/'}};
  support.initForm(form, win);
  return {form, nodes, win};
}

async function main() {
  for (const [lang, file, loading, retry] of [['ko','index.html','기록을 불러오는 중…','다시 시도'],
    ['en','index_en.html','Loading records…','Retry'], ['de','index_de.html','Aufzeichnungen werden geladen…','Erneut versuchen'],
    ['ja','index_ja.html','記録を読み込み中…','再試行']]) {
    const html = read(file);
    assert.match(html, /data-community-stats[^>]*aria-busy="true"/);
    assert.ok(html.includes('<strong data-community-total>—</strong>'));
    assert.ok(html.includes('<strong data-community-count>—</strong>'));
    assert.ok(html.includes(`<p class="community-status" data-community-status role="status">${loading}</p>`));
    assert.ok(html.includes(`<button type="button" class="community-retry" data-community-retry hidden>${retry}</button>`));
    assert.match(html, /studio-home\.css\?v=20260907-community-music/);
    assert.match(html, /studio-music\.css\?v=20260907/);
    assert.match(html, /community-stats\.js\?v=20260907/);
    assert.match(html, /studio-music\.js\?v=20260907/);
    assert.doesNotMatch(html, /data-stats-as-of|community-date/);
    assert.match(html, /community-window[^>]*>[^<]*28/);
    const method = html.match(/<details class="community-method">[\s\S]*?<\/details>/)?.[0];
    assert.ok(method);
    assert.doesNotMatch(method, /2026|202건|202 completed|202 abgeschlossenen|2026年/);
    for (const legal of [`privacy/${lang}.html`, `quirky-ball/terms/${lang}.html`,
      `quirky-ball/privacy/delete_${lang}.html`, `impressum/${lang}.html`]) {
      assert.match(read(legal), /legal-update[^]*<time datetime="2026-09-05">/);
    }
  }
  assert.doesNotMatch(read('index_en.html'), /And counting/);
  const html = read('support/index.html');
  assert.equal((html.match(/maxlength="800"/g) || []).length, 4);
  assert.equal((html.match(/<form class="support-form" hidden data-mail-form/g) || []).length, 4);
  assert.doesNotMatch(html, /<(?:input|textarea|select)\b[^>]*\srequired(?:\s|>|=)/);
  for (const id of ['legal-content','legal-title','support-ko-title','support-en-title',
    'support-de-title','ko-ranking','korean','english','german','japanese']) {
    assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, id);
  }
  assert.doesNotMatch(read('assets/support-site.js'), /fetch\(|XMLHttpRequest|\.innerHTML|localStorage|sessionStorage/);

  for (const [lang, hash] of [['ko','korean'],['en','english'],['de','german'],['ja','japanese']]) {
    assert.equal(support.localeFromHash('#' + hash), lang);
    assert.equal(support.localeFromHash('#' + lang + '-purchase'), lang);
    assert.equal(support.requestedLocale({location: {hash: '#' + hash, search: '?lang=xx'}, navigator: {language: 'fr'}}), lang);
    const payload = '<img src=x onerror=alert(1)> &bcc=not-a-recipient@example.invalid\nTest';
    const {form, nodes, win} = fixture(lang, payload);
    assert.equal(form.hidden, false);
    nodes['[data-mail-preview]'].handlers.click();
    assert.ok(nodes['[data-mail-draft]'].value.includes(payload));
    assert.equal(nodes['[data-mail-draft]'].hidden, false);
    assert.ok(nodes['[data-mail-draft]'].attributes['aria-label']);
    assert.equal(win.location.href, 'https://example.invalid/support/');
    const mailto = new URL(support.mailtoFor(form));
    assert.equal(mailto.pathname, 'support@houseduck.in');
    assert.equal(mailto.searchParams.has('bcc'), false);
    assert.ok(mailto.searchParams.get('body').includes(payload));
    let prevented = false;
    form.handlers.submit({preventDefault() { prevented = true; }});
    assert.equal(prevented, true);
    nodes['[data-mail-copy]'].handlers.click();
    assert.equal(nodes['[data-mail-draft]'].selected, true);
  }
  assert.equal(support.requestedLocale({location: {hash: '#de-purchase', search: '?lang=en'}, navigator: {language: 'ko'}}), 'de');
  const long = fixture('ko', '문의'.repeat(400));
  long.nodes['[data-mail-open]'].handlers.click();
  assert.equal(long.win.location.href, 'https://example.invalid/support/');
  assert.equal(long.nodes['[data-mail-draft]'].selected, true);
  assert.ok(long.nodes['[data-mail-draft]'].value.includes('문의'.repeat(400)));
  const denied = fixture('de', 'Testanfrage');
  denied.win.navigator.clipboard = {writeText: async () => { throw new Error('denied'); }};
  denied.nodes['[data-mail-copy]'].handlers.click();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(denied.nodes['[data-mail-draft]'].selected, true);
  assert.match(denied.nodes['[data-mail-status]'].textContent, /kopiere/);
  console.log('PASS: live community markup contract, 16 document dates, legacy anchors, 4 languages, safe previews, mailto encoding, long-message and denied-clipboard fallbacks.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
