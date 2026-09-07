const {test, expect} = require('@playwright/test');
const support = require('../assets/support-site.js');
const locales = [['ko','korean','도움이 필요하신가요?'],['en','english','Need a hand?'],['de','german','Brauchst du Hilfe?'],['ja','japanese','お困りですか？']];

test('live community stats render public totals and evergreen copy', async ({page}) => {
  const live = {total_score:'34565726',record_count:203,as_of:'2026-09-07T09:22:00Z',window_days:28,all_time:false};
  const requests = [];
  await page.route('**/functions/v1/public-community-stats', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(live)}));
  page.on('request', request => {
    if(request.url().includes('/functions/v1/public-community-stats')) requests.push(request);
  });
  await page.goto('/?lang=ko');
  const section = page.locator('[data-community-stats]');
  await expect(section).toHaveAttribute('data-stats-state','ready');
  await expect(section).toHaveAttribute('data-stats-as-of',live.as_of);
  await expect(page.locator('[data-community-total]')).toHaveAttribute('data-value',live.total_score);
  await expect(page.locator('[data-community-count]')).toHaveAttribute('data-value',String(live.record_count));
  await expect(page.locator('[data-community-total] .counter-accessible')).toHaveText('34,565,726');
  await expect(page.locator('[data-community-count] .counter-accessible')).toHaveText('203');
  await expect(page.locator('.community-date')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('2026.09.05');
  await page.locator('.community-method summary').click();
  await expect(page.locator('.community-method p')).toContainText('최근 28일');
  await expect(page.locator('.community-method p')).toContainText('출시 이후 전체 누적 점수가 아닙니다');
  expect(await section.innerText()).not.toMatch(/nickname|user_id|display_code|email|token|apikey/i);
  await section.scrollIntoViewIfNeeded();
  await expect.poll(async () => page.locator('[data-community-total] .counter-track').evaluateAll(nodes => nodes.length > 0 && nodes.every(node => node.style.transform.startsWith('translateY(-'))), {timeout:4000}).toBe(true);
  await expect(section).not.toHaveClass(/is-counting/);
  await expect(page.locator('[data-community-total] .counter-accessible')).toHaveText('34,565,726');
  await expect(page.locator('[data-community-count] .counter-accessible')).toHaveText('203');
  expect(requests).toHaveLength(1);
});

test('community stats refresh on reload with the newest public fixture', async ({page}) => {
  let calls = 0;
  await page.route('**/functions/v1/public-community-stats', route => {
    calls += 1;
    const live = calls === 1
      ? {total_score:'34565726',record_count:203,as_of:'2026-09-07T09:22:00Z',window_days:28,all_time:false}
      : {total_score:'34565727',record_count:204,as_of:'2026-09-07T09:23:00Z',window_days:28,all_time:false};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(live)});
  });
  await page.goto('/?lang=ko');
  await expect(page.locator('[data-community-total]')).toHaveAttribute('data-value','34565726');
  await page.reload();
  await expect(page.locator('[data-community-total]')).toHaveAttribute('data-value','34565727');
  await expect(page.locator('[data-community-count]')).toHaveAttribute('data-value','204');
  expect(calls).toBe(2);
});

test('community stats shows retry for errors and accepts a valid zero total', async ({page}) => {
  let calls = 0;
  await page.route('**/functions/v1/public-community-stats', route => {
    calls += 1;
    if(calls === 1) return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'unavailable'})});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({total_score:'0',record_count:0,as_of:'2026-09-07T09:24:00Z',window_days:28,all_time:false})});
  });
  await page.goto('/?lang=ko');
  const section = page.locator('[data-community-stats]');
  await expect(section).toHaveAttribute('data-stats-state','error');
  await expect(page.locator('[data-community-retry]')).toBeVisible();
  await page.locator('[data-community-retry]').click();
  await expect(section).toHaveAttribute('data-stats-state','empty');
  await expect(page.locator('[data-community-total]')).toHaveAttribute('data-value','0');
  await expect(page.locator('[data-community-count]')).toHaveAttribute('data-value','0');
  await expect(page.locator('[data-community-status]')).toContainText('첫 번째 실험 기록');
  await expect(page.locator('[data-community-retry]')).toBeHidden();
  expect(calls).toBe(2);
});

test('BGM is manual, audio-only, stoppable and removed on mobile', async ({page,isMobile}) => {
  const mediaRequests = [];
  page.on('request', request => {
    if (/\/assets\/music\/.*\.mp3|youtube.*\/embed|youtube.*iframe_api/.test(request.url())) mediaRequests.push(request.url());
  });
  await page.goto('/?lang=ko');
  const music = page.locator('[data-studio-music]');
  if (isMobile) {
    await expect(music).toHaveCount(0);
    expect(mediaRequests).toEqual([]);
    return;
  }
  await expect(music).toBeVisible();
  expect(mediaRequests).toEqual([]);
  const audio = music.locator('audio');
  await expect(audio).toHaveCount(1);
  await expect(audio).toHaveJSProperty('paused',true);
  await music.getByRole('button',{name:'재생',exact:true}).click();
  await expect(music.getByRole('button',{name:'정지',exact:true})).toBeVisible();
  await expect.poll(() => audio.evaluate(node => node.currentTime)).toBeGreaterThan(0);
  await music.getByRole('button',{name:'정지',exact:true}).click();
  await expect(audio).toHaveJSProperty('paused',true);
  await expect(audio).toHaveJSProperty('currentTime',0);
  await expect(music.getByRole('button',{name:'재생',exact:true})).toBeVisible();
  expect(mediaRequests.some(url => url.includes('/assets/music/'))).toBe(true);
  expect(mediaRequests.some(url => url.includes('youtube'))).toBe(false);
  await music.getByRole('button',{name:'재생',exact:true}).click();
  await expect(audio).toHaveJSProperty('paused',false);
  await page.setViewportSize({width:390,height:844});
  await expect(music).toHaveCount(0);
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
