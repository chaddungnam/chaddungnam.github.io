const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
for (const locale of ['ko', 'en', 'de', 'ja']) {
  const privacy = fs.readFileSync(path.join(root, `privacy/${locale}.html`), 'utf8');
  const terms = fs.readFileSync(path.join(root, `quirky-ball/terms/${locale}.html`), 'utf8');
  const deletion = fs.readFileSync(path.join(root, `quirky-ball/privacy/delete_${locale}.html`), 'utf8');
  for (const token of ['eu-west-1', 'Supabase Pte. Ltd.', 'privacy@supabase.io', 'SCC', 'FCM', 'APNs', '2026-09-08']) assert.ok(privacy.includes(token), `${locale}: missing ${token}`);
  for (let n=1;n<=13;n++) assert.equal((privacy.match(new RegExp(`id="section-${n}"`, 'g'))||[]).length,1,`${locale}: privacy anchor ${n}`);
  assert.ok(terms.includes('2026-09-08'));
  assert.ok(deletion.includes(`/privacy/${locale}.html#section-9`));
  assert.ok(deletion.indexOf('28') < deletion.indexOf('<!-- 문서 본문 끝 -->'));
  assert.doesNotMatch(privacy, /Supabase \(Supabase Inc\.\)/);
  assert.doesNotMatch(privacy + terms + deletion, /�/);
}
console.log('cross-border, notification and consent notices: PASS');
