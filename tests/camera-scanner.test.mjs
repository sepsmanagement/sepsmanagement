import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../operations/camera-scanner.js',import.meta.url),'utf8');
const ctx=vm.createContext({});vm.runInContext(source,ctx);
const word=(text,height,confidence=90)=>({text,confidence,bbox:{x0:0,y0:0,x1:200,y1:height}});
function read(words,rows){return ctx.sepsCameraCandidate({blocks:[{paragraphs:[{lines:[{words}]}]}]},rows);}
test('reads the largest shipment number dynamically, preserving leading zeros',()=>{
 for(const id of ['14949389','00876543','98765432'])assert.equal(read([word('25303289',12),word(id,80)],[{id}]).row.id,id);
});
test('does not substitute a smaller known number for an unknown large number',()=>{
 const found=read([word('11111111',80),word('22222222',12)],[{id:'22222222'}]);assert.equal(found.number,'11111111');assert.equal(found.row,null);
});
test('rejects ambiguous or low-confidence printed numbers',()=>{
 assert.equal(read([word('11111111',80),word('22222222',75)],[]),null);
 assert.equal(read([word('11111111',80,30)],[]),null);
});
test('camera requires explicit confirmation, prevents duplicate saves and releases tracks',async()=>{
 const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,textContent:'',videoWidth:1000,videoHeight:500,play:async()=>{},getContext:()=>({drawImage(){}})});return nodes.get(id);};
 let stopped=0,receipts=0;let session={dbId:'session1',rows:[{id:'87654321',name:'Owner'}]};let finish;
 const local=vm.createContext({document:{getElementById:get,addEventListener(){}},window:{addEventListener(){}},navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stopped++}}]})}},URL,location:{href:'https://example.com/operations/'},Tesseract:{createWorker:async()=>({setParameters:async()=>{},recognize:async()=>({data:{blocks:[{paragraphs:[{lines:[{words:[word('87654321',90)]}]}]}]}}),terminate:async()=>{}})}});
 vm.runInContext(source,local);const scanner=local.createSepsCameraScanner({getSession:()=>session,onReceive:async()=>{receipts++;await new Promise(resolve=>finish=resolve);return true;}});
 await get('camera-open').onclick();assert.equal(receipts,0);await get('camera-read').onclick();assert.equal(receipts,0,'recognition never saves automatically');assert.equal(get('camera-confirm').hidden,false);const saving=get('camera-confirm').onclick();await get('camera-confirm').onclick();assert.equal(receipts,1);finish();await saving;await get('camera-confirm').onclick();assert.equal(receipts,1,'one capture can only be confirmed once');
 await get('camera-read').onclick();await get('camera-read').onclick();session={dbId:'other',rows:[]};await get('camera-confirm').onclick();assert.equal(receipts,1,'changing sessions invalidates recognized tag');scanner.close();assert(stopped>=2);assert.equal(get('camera-panel').hidden,true);
});
