const {test, expect} = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const support = require('../assets/support-site.js');
const root = path.join(__dirname,'..');
const stats = JSON.parse(fs.readFileSync(path.join(root,'assets/community-stats.json'),'utf8'));
const locales = [['ko','korean','도움이 필요하신가요?'],['en','english','Need a hand?'],['de','german','Brauchst du Hilfe?'],['ja','japanese','お困りですか？']];

test('aggregate snapshot contains only public totals, with explicit limited coverage', async ({page}) => {
  expect(stats.all_time).toBe(false);
  expect(stats.window_days).toBe(28);
  expect(BigInt(stats.total_score)>0n).toBeTruthy();
  expect(stats.record_count).toBeGreaterThan(0);
  expect(Object.keys(stats).sort()).toEqual(['schema_version','total_score','record_count','as_of','coverage_start','coverage_end','window_days','source','exclusions','all_time'].sort());
  expect(JSON.stringify(stats)).not.toMatch(/nickname|user_id|display_code|email|token|apikey/i);
  await page.goto('/?lang=ko');
  await expect(page.locator('[data-community-total]')).toHaveText(new Intl.NumberFormat('ko-KR').format(BigInt(stats.total_score)));
  await expect(page.locator('.community-window')).toContainText('최근 28일');
  await expect(page.locator('.community-date')).toContainText('실시간 아님');
  await page.locator('.community-method summary').click();
  await expect(page.locator('.community-method p')).toContainText('출시 이후 전체 누적 점수가 아닙니다');
});

for(const [lang,hash,title] of locales){
 test(`support ${lang}: useful without external requests or login`, async ({page}) => {
  const external=[],errors=[];
  page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173/'))external.push(r.url());});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`/support/?lang=${lang}`);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('h1')).toHaveText(title);
  await expect(page.locator('.support-locale:visible')).toHaveCount(1);
  await expect(page.locator('.support-locale:visible .support-card')).toHaveCount(6);
  await expect(page.locator('.support-locale:visible .support-quick-contact a')).toHaveAttribute('href','mailto:support@houseduck.in');
  expect(external).toEqual([]); expect(errors).toEqual([]);
  expect(await page.locator('input[required],textarea[required],select[required]')).toHaveCount(0);
  await page.locator(`#${lang}-purchase summary`).click();
  await expect(page.locator(`#${lang}-purchase`)).toHaveAttribute('open','');
  await expect(page.locator(`[data-language="${lang}"] select[name="category"]`)).toHaveJSProperty('selectedIndex',2);
 });
 test(`support ${lang}: 320px viewport and long copy remain usable`,async({page})=>{
  await page.setViewportSize({width:320,height:844});
  await page.goto(`/support/#${hash}`);
  await page.locator(`#${lang}-purchase summary`).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const cards=await page.locator('.support-locale:visible .support-card summary').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().height));
  expect(Math.min(...cards)).toBeGreaterThanOrEqual(44);
 });
}

test('support preserves hash precedence, old anchors and unsent local drafts',async({page})=>{
 await page.goto('/support/?lang=en#ko-purchase');
 await expect(page.locator('html')).toHaveAttribute('lang','ko');
 await expect(page.locator('#ko-purchase')).toHaveAttribute('open','');
 await page.locator('#korean textarea[name="message"]').fill('복원 문의: 아직 보내지 않은 내용');
 await page.locator('.support-languages a[href="#german"]').click();
 await expect(page.locator('html')).toHaveAttribute('lang','de');
 await page.locator('.support-languages a[href="#korean"]').click();
 await expect(page.locator('#korean textarea[name="message"]')).toHaveValue('복원 문의: 아직 보내지 않은 내용');
 for(const id of ['legal-content','legal-title','support-ko-title','support-en-title','support-de-title','ko-ranking'])await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
 expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual([]);
 await page.reload();
 await expect(page.locator('#korean textarea[name="message"]')).toHaveValue('');
});

test('draft preview treats input as text, does not send or persist it',async({page})=>{
 const writes=[]; page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method()+' '+r.url());});
 await page.goto('/support/#english');
 const payload='<img src=x onerror="window.injected=true"> &bcc=attacker@example.invalid\r\nTest';
 await page.locator('#english textarea[name="message"]').fill(payload);
 await page.locator('#english [data-mail-preview]').click();
 await expect(page.locator('#english [data-mail-draft]')).toHaveValue(/<img src=x/);
 await expect(page.locator('#english [data-mail-status]')).toContainText('Nothing has been sent');
 await expect(page.locator('#english img[src="x"]')).toHaveCount(0);
 expect(await page.evaluate(()=>window.injected)).toBeUndefined();
 expect(writes).toEqual([]);
 const mock={dataset:{language:'en'},elements:{category:{value:'Bug report'},platform:{value:'Android'},message:{value:payload}}};
 const url=new URL(support.mailtoFor(mock));
 expect(url.pathname).toBe('support@houseduck.in'); expect(url.searchParams.has('bcc')).toBe(false);
 expect(url.searchParams.get('body')).toContain(payload.trim());
});

test('long email draft uses selectable fallback instead of opening a broken mailto',async({page})=>{
 await page.goto('/support/#korean');
 await page.locator('#korean textarea[name="message"]').fill('문의'.repeat(400));
 await page.locator('#korean [data-mail-open]').click();
 await expect(page.locator('#korean [data-mail-draft]')).toBeVisible();
 await expect(page.locator('#korean [data-mail-status]')).toContainText('복사');
 expect(page.url()).toContain('/support/');
});

test('copy failure exposes the full draft for manual copying',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('denied'))},configurable:true}));
 await page.goto('/support/#german');
 await page.locator('#german textarea[name="message"]').fill('Testanfrage');
 await page.locator('#german [data-mail-copy]').click();
 await expect(page.locator('#german [data-mail-draft]')).toBeVisible();
 await expect(page.locator('#german [data-mail-draft]')).toHaveValue(/Testanfrage/);
 await expect(page.locator('#german [data-mail-status]')).toContainText('kopiere');
});

test.describe('without JavaScript',()=>{
test.use({javaScriptEnabled:false});
test('support remains readable and contactable with JavaScript disabled',async({page})=>{
 await page.goto('/support/');
 await expect(page.locator('.support-locale:visible')).toHaveCount(4);
 await page.locator('#en-purchase summary').click();
 await expect(page.locator('#en-purchase')).toHaveAttribute('open','');
 await expect(page.locator('#english .support-quick-contact a')).toHaveAttribute('href','mailto:support@houseduck.in');
});
});

for(const [lang] of locales){
 test(`legal ${lang}: unchanged public routes, usable contents, bottom update date`,async({page})=>{
  for(const route of [`/privacy/${lang}.html`,`/quirky-ball/terms/${lang}.html`,`/quirky-ball/privacy/delete_${lang}.html`,`/impressum/${lang}.html`]){
   const response=await page.goto(route);expect(response.status()).toBe(200);
   await expect(page.locator('.legal-document-footer time')).toHaveAttribute('datetime','2026-09-05');
   await expect(page.locator('.legal-tools button')).toBeVisible();
   expect(await page.locator('[data-toc-list] a').count()).toBeGreaterThan(0);
   await page.setViewportSize({width:320,height:844});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  }
  const redirect=await page.goto(`/quirky-ball/privacy/${lang}.html`);expect(redirect.ok()).toBeTruthy();
  await expect(page).toHaveURL(new RegExp(`/privacy/${lang}\\.html$`));
 });
}
