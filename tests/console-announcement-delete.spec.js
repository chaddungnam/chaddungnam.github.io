const { test, expect } = require('@playwright/test');

const notice = { id: 7, category: 'event', body: '삭제 대상 행사 공지', starts_at: '2026-09-06T10:00:00.000Z', ends_at: null, active: false };
async function boot(page) {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort();
  });
  await page.route('**/console/auth.js*', route => route.fulfill({ contentType: 'application/javascript', body: `window.ConsoleAuth={initialize:async()=>({signedIn:true,unlocked:true,email:'qa@houseduck.in'}),snapshot:()=>({signedIn:true,unlocked:true,email:'qa@houseduck.in'}),isUnlocked:()=>true,requireChallenge:()=>{},unlock:async()=>{},logout:()=>{},headers:()=>({})};` }));
  await page.route('**/console/api.js*', route => route.fulfill({ contentType: 'application/javascript', body: `
    window.__mutations=[]; window.__deleteMode='success';
    window.ConsoleAPI={initialize:()=>{},post:async(_name,payload)=>{
      if(payload.action==='operations.get')return {config:{},notices:[${JSON.stringify(notice)}],catalog:[],reward_mail_broadcasts:[]};
      if(!payload.action.startsWith('announcements.'))return {};
      window.__mutations.push(payload);
      if(payload.action==='announcements.delete'){
        if(window.__deleteMode==='hold')await new Promise(resolve=>window.__releaseDelete=resolve);
        if(window.__deleteMode==='fail')throw new Error('temporary_failure');
        if(window.__deleteMode==='unconfirmed')return {ok:false};
        return {ok:true};
      }
      if(payload.action==='announcements.media.upload'){
        await new Promise(resolve=>window.__releaseUpload=resolve);
        return {path:'${'a'.repeat(64)}.webp'};
      }
      if(window.__holdPublish)await new Promise(resolve=>window.__releasePublish=resolve);
      return {ok:true,announcement_id:8};
    }};` }));
  await page.goto('/console/');
  await page.locator('#projectQuirkyBall').click();
  await page.locator('#consoleNav a[data-page="operations"]').click();
  await page.locator('#noticeTask').evaluate(node => { node.open = true; });
  await expect(page.locator('[data-delete-notice="7"]')).toBeVisible();
  await page.evaluate(() => { window.ConsoleApp.confirmChange = async () => true; });
}
async function openDelete(page) {
  await page.locator('[data-delete-notice="7"]').click();
  await expect(page.getByRole('dialog', { name: '공지 삭제' })).toBeVisible();
}
async function readyDelete(page, reason = '지난 행사 정리') {
  await page.locator('#announcementDeleteForm [name=reason]').fill(reason);
  await page.locator('#announcementDeleteForm [name=confirmed]').check();
}
const submitDelete = page => page.locator('#announcementDeleteForm button[type=submit]').click();

test('category labels remain textual and new notice resets to notice', async ({ page }) => {
  await boot(page);
  const category = page.locator('#announcementForm [name=category]');
  await expect(category).toHaveAccessibleName('분류');
  await expect(category).toHaveValue('notice');
  await expect(page.locator('.announcement-category')).toHaveText('[이벤트]');
  await page.locator('[data-edit-notice="7"]').click();
  await expect(category).toHaveValue('event');
  await expect(page.locator('#announcementDocument [data-paragraph]')).toHaveText(notice.body);
  await category.selectOption('preview');
  await page.locator('#announcementReset').click();
  await expect(category).toHaveValue('notice');
  expect(await page.evaluate(() => window.__mutations)).toEqual([]);
});

test('delete cancellation, reason and explicit confirmation never publish or discard a draft', async ({ page }) => {
  await boot(page);
  const draft = page.locator('#announcementDocument [data-paragraph]');
  await draft.fill('유지할 새 공지');
  await openDelete(page);
  await expect(page.locator('#announcementDeleteTarget')).toContainText('#7');
  await expect(page.locator('#announcementDeleteTarget')).toContainText(notice.body);
  await expect(page.locator('#announcementDeleteForm [name=reason]')).toHaveAttribute('maxlength', '300');
  await submitDelete(page);
  await expect(page.locator('#announcementDeleteMessage')).toContainText('아직 삭제하지 않았습니다');
  await page.locator('#announcementDeleteForm [name=reason]').fill('   ');
  await page.locator('#announcementDeleteForm [name=confirmed]').check();
  await submitDelete(page);
  await expect(page.locator('#announcementDeleteMessage')).toContainText('삭제 사유');
  await page.locator('#announcementDeleteForm [name=reason]').fill('삭제 사유');
  await page.locator('#announcementDeleteForm [name=confirmed]').uncheck();
  await submitDelete(page);
  await page.locator('#announcementDeleteCancel').click();
  await expect(page.locator('#announcementDeleteDialog')).not.toBeVisible();
  await expect(draft).toHaveText('유지할 새 공지');
  await expect(page.locator('[data-notice-id="7"]')).toBeVisible();
  expect(await page.evaluate(() => window.__mutations)).toEqual([]);
  await openDelete(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#announcementDeleteDialog')).not.toBeVisible();
});

test('failed deletion preserves a rich draft, retries the same ID, and removes only after server success', async ({ page }) => {
  await boot(page);
  await page.locator('#announcementDocument [data-paragraph]').fill('별도 리치 초안');
  await page.locator('#announcementForm [name=category]').selectOption('preview');
  await page.locator('[data-format=bold]').click();
  await openDelete(page);
  await readyDelete(page);
  await page.evaluate(() => { window.__deleteMode = 'fail'; });
  await submitDelete(page);
  await expect(page.locator('#announcementDeleteMessage')).toContainText('삭제를 완료하지 못했습니다');
  await expect(page.locator('[data-notice-id="7"]')).toHaveCount(1);
  await page.evaluate(() => { window.__deleteMode = 'unconfirmed'; });
  await submitDelete(page);
  await expect.poll(() => page.evaluate(() => window.__mutations.length)).toBe(2);
  await expect(page.locator('#announcementDeleteMessage')).toContainText('삭제를 완료하지 못했습니다');
  await page.evaluate(() => { window.__deleteMode = 'hold'; });
  await submitDelete(page);
  await expect(page.locator('#announcementDeleteForm')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#announcementDocument')).toHaveAttribute('contenteditable', 'false');
  await expect(page.locator('#announcementImageInput')).toBeDisabled();
  await expect(page.locator('#announcementForm button[type=submit]')).toBeDisabled();
  await page.locator('#announcementDeleteForm').evaluate(form => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    document.querySelector('#announcementForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await page.keyboard.press('Escape');
  await expect(page.locator('#announcementDeleteDialog')).toBeVisible();
  await expect(page.locator('[data-notice-id="7"]')).toHaveCount(1);
  const payloads = await page.evaluate(() => window.__mutations);
  expect(payloads).toHaveLength(3);
  expect(payloads[0]).toMatchObject({ action: 'announcements.delete', announcementId: 7, reason: '지난 행사 정리' });
  expect(payloads[0].requestId).toBeTruthy();
  expect(payloads[1]).toEqual(payloads[0]);
  expect(payloads[2]).toEqual(payloads[0]);
  await page.evaluate(() => window.__releaseDelete());
  await expect(page.locator('[data-notice-id="7"]')).toHaveCount(0);
  await expect(page.locator('#operationsHistory')).toContainText('최근 운영 기록이 없습니다');
  await expect(page.locator('#announcementDeleteDialog')).not.toBeVisible();
  await expect(page.locator('#announcementForm [name=category]')).toHaveValue('preview');
  await expect(page.locator('#announcementDocument [data-paragraph]')).toHaveText('별도 리치 초안');
  await expect(page.locator('#announcementDocument [data-paragraph]')).toHaveAttribute('data-bold', 'true');
  await expect(page.locator('#announcementImageInput')).toBeEnabled();
});

test('changed deletion reason gets a new request ID and successful deletion resets the selected editor', async ({ page }) => {
  await boot(page);
  await page.locator('[data-edit-notice="7"]').click();
  await page.locator('#announcementDocument [data-paragraph]').fill('편집 중인 대상');
  await openDelete(page);
  await readyDelete(page);
  await page.evaluate(() => { window.__deleteMode = 'fail'; });
  await submitDelete(page);
  await expect(page.locator('#announcementDeleteMessage')).toContainText('삭제를 완료하지 못했습니다');
  await expect(page.locator('#announcementForm [name=announcementId]')).toHaveValue('7');
  await readyDelete(page, '잘못 게시한 행사 정리');
  await page.evaluate(() => { window.__deleteMode = 'success'; });
  await submitDelete(page);
  await expect(page.locator('#announcementDeleteDialog')).not.toBeVisible();
  await expect(page.locator('#announcementForm [name=announcementId]')).toHaveValue('');
  await expect(page.locator('#announcementForm [name=category]')).toHaveValue('notice');
  await expect(page.locator('#announcementDocument [data-paragraph]')).toHaveText('');
  const payloads = await page.evaluate(() => window.__mutations);
  expect(payloads).toHaveLength(2);
  expect(payloads[1].requestId).not.toBe(payloads[0].requestId);
  expect(payloads.every(payload => payload.action === 'announcements.delete')).toBe(true);
});

test('publishing blocks delete, edit and image uploads until the request finishes', async ({ page }) => {
  await boot(page);
  await page.locator('#announcementDocument [data-paragraph]').fill('발행 잠금 확인');
  await page.locator('#announcementForm [name=startsAt]').fill('2026-09-06T12:00');
  await page.locator('#announcementForm [name=reason]').fill('동시 작업 차단');
  await page.evaluate(() => { window.__holdPublish = true; });
  await page.locator('#announcementForm button[type=submit]').click();
  await expect.poll(() => page.evaluate(() => window.__mutations.length)).toBe(1);
  await expect(page.locator('[data-delete-notice="7"]')).toBeDisabled();
  await expect(page.locator('[data-edit-notice="7"]')).toBeDisabled();
  await expect(page.locator('#announcementDocument')).toHaveAttribute('contenteditable', 'false');
  await expect(page.locator('#announcementImageInput')).toBeDisabled();
  await page.locator('[data-delete-notice="7"]').dispatchEvent('click');
  await expect(page.locator('#announcementDeleteDialog')).not.toBeVisible();
  await page.evaluate(() => window.__releasePublish());
  await expect(page.locator('[data-delete-notice="7"]')).toBeEnabled();
});

test('an in-progress image upload blocks deletion and publishing', async ({ page }) => {
  await boot(page);
  await page.locator('#announcementDocument [data-paragraph]').fill('이미지 업로드 잠금');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    canvas.getContext('2d').fillRect(0, 0, 64, 64); return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#announcementImageInput').setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect.poll(() => page.evaluate(() => window.__mutations.length)).toBe(1);
  await expect(page.locator('[data-delete-notice="7"]')).toBeDisabled();
  await expect(page.locator('#announcementForm button[type=submit]')).toBeDisabled();
  await page.locator('[data-delete-notice="7"]').dispatchEvent('click');
  await expect(page.locator('#announcementDeleteDialog')).not.toBeVisible();
  await page.evaluate(() => window.__releaseUpload());
  await expect(page.locator('[data-delete-notice="7"]')).toBeEnabled();
  expect((await page.evaluate(() => window.__mutations)).map(payload => payload.action)).toEqual(['announcements.media.upload']);
});
