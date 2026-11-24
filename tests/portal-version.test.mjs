import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../operations/portal-version.js',import.meta.url),'utf8');
test('cached portal reloads to a new release once while current and offline pages stay usable',async()=>{
 for(const [latest,href,expected] of [['automatic-20','https://example.com/operations/',false],['automatic-21','https://example.com/operations/',true],['automatic-21','https://example.com/operations/?release=automatic-21',false],[null,'https://example.com/operations/',false]]){
  let redirected=null,options=null;const context=vm.createContext({URL,location:{href,replace(url){redirected=url}},window:{addEventListener(){}},fetch:async(url,opts)=>{options=opts;if(latest===null)throw Error('offline');return{ok:true,json:async()=>({version:latest})}}});
  vm.runInContext(source,context);await new Promise(resolve=>setImmediate(resolve));assert.equal(!!redirected,expected);assert.equal(options.cache,'no-store');if(expected)assert.equal(new URL(redirected).searchParams.get('release'),latest);
 }
});
