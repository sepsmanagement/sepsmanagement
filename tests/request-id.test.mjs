import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../operations/request-id.js',import.meta.url),'utf8');
const valid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
test('creates unique UUID request IDs when randomUUID is unavailable',()=>{
 const ctx=vm.createContext({crypto:{getRandomValues:bytes=>webcrypto.getRandomValues(bytes)},Uint8Array});vm.runInContext(source,ctx);
 const ids=Array.from({length:1000},()=>ctx.sepsRequestId());assert(ids.every(id=>valid.test(id)));assert.equal(new Set(ids).size,1000);
});
test('uses native UUID generation where available',()=>{const ctx=vm.createContext({crypto:webcrypto,Uint8Array});vm.runInContext(source,ctx);assert(valid.test(ctx.sepsRequestId()));});
test('refuses to use weak randomness when secure randomness is absent',()=>{const ctx=vm.createContext({Uint8Array});vm.runInContext(source,ctx);assert.throws(()=>ctx.sepsRequestId(),/Secure request IDs/);});
