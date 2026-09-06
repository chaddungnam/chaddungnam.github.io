import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const context = vm.createContext({ window: {} });
vm.runInContext(await readFile(new URL('../quirky-ball/notices/content.js', import.meta.url), 'utf8'), context);
const { valid } = context.window.HouseDuckNoticeContent;
const p = (text='hello') => ({ type:'paragraph', text, size:'normal', align:'left', bold:false, italic:false, underline:false });
const img = (path='a'.repeat(64)+'.webp') => ({type:'image', path, alt:'Preview', width:100});
const doc = (...blocks) => ({version:1, blocks});
test('accepts bounded translated paragraphs and controlled media keys',()=>{
  assert.equal(valid(doc(p('안내'),img(),{type:'divider'},p('مرحبا'))),true);
  assert.equal(valid(doc(p('a'.repeat(12000)))),true);
  assert.equal(valid(doc(p('a'.repeat(12001)))),false);
  assert.equal(valid(doc(p(String.fromCodePoint(0x1f642).repeat(12000)))),true);
  assert.equal(valid(doc(p('a'.repeat(11998)), p('b'))),false);
  assert.equal(valid(doc(p('a'.repeat(11999)), img())),false);
});
test('rejects external paths, unbounded media and formatting injection',()=>{
  for(const path of ['https://example.com/x.webp','../secret.webp','//example.com/x.webp','a'.repeat(64)+'.svg','A'.repeat(64)+'.webp']) assert.equal(valid(doc(img(path))),false);
  assert.equal(valid(doc(...Array.from({length:9},()=>img()))),false);
  assert.equal(valid(doc(...Array.from({length:61},()=>p()))),false);
  assert.equal(valid(doc({...p(),size:'10000px'})),false);
  assert.equal(valid(doc({...p(),align:'left;display:none'})),false);
  assert.equal(valid(doc({...p(),bold:'false'})),false);
  assert.equal(valid(doc({...img(),width:9999})),false);
  assert.equal(valid(doc({type:'html',html:'<script>evil()</script>'})),false);
});
test('legacy and malformed payloads fail safely to text',()=>{
  for(const value of [undefined,null,{},[],{version:2,blocks:[p()]},doc(),doc(null)]) assert.equal(valid(value),false);
});
