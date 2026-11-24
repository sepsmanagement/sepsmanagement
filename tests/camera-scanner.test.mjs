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
test('camera continuously reads without capture taps, confirms once and releases tracks',async()=>{
 const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,textContent:'',videoWidth:1000,videoHeight:500,play:async()=>{},getContext:()=>({drawImage(){}})});return nodes.get(id);};
 let tick=null;let stopped=0,receipts=0;let session={dbId:'session1',rows:[{id:'87654321',name:'Owner'}]};let finish;
 const local=vm.createContext({setTimeout(fn){tick=fn;return 1},clearTimeout(){tick=null},document:{getElementById:get,addEventListener(){}},window:{addEventListener(){}},navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stopped++}}]})}},URL,location:{href:'https://example.com/operations/'},Tesseract:{createWorker:async()=>({setParameters:async()=>{},recognize:async()=>({data:{blocks:[{paragraphs:[{lines:[{words:[word('87654321',90)]}]}]}]}}),terminate:async()=>{}})}});
 vm.runInContext(source,local);const scanner=local.createSepsCameraScanner({getSession:()=>session,onReceive:async()=>{receipts++;await new Promise(resolve=>finish=resolve);return true;}});
 await get('camera-open').onclick();await new Promise(resolve=>setImmediate(resolve));assert.equal(receipts,0);assert(tick,'automatic scan loop scheduled');await tick();assert.equal(receipts,0,'recognition waits for receipt confirmation');assert.equal(get('camera-confirm').hidden,false);assert.equal(get('camera-video').hidden,false,'preview remains live');const saving=get('camera-confirm').onclick();await get('camera-confirm').onclick();assert.equal(receipts,1);finish();await saving;await get('camera-confirm').onclick();assert.equal(receipts,1,'one match can only be confirmed once');
 await get('camera-read').onclick();await new Promise(resolve=>setImmediate(resolve));await tick();session={dbId:'other',rows:[]};await get('camera-confirm').onclick();assert.equal(receipts,1,'changing sessions invalidates recognized tag');scanner.close();assert(stopped>=1);assert.equal(get('camera-panel').hidden,true);
});
test('joins eight spaced digits or OCR fragments and rejects other lengths',()=>{
 const words='1 4 9 4 9 3 8 9'.split(' ').map((d,i)=>({...word(d,80),bbox:{x0:i*35,x1:i*35+30,y0:0,y1:80}}));
 assert.equal(read(words,[{id:'14949389'}]).number,'14949389');
 assert.equal(read([word('1494 9389',80)],[{id:'14949389'}]).number,'14949389');
 assert.equal(read([word('1494938',80)],[]),null);
 assert.equal(read([word('149493891',80)],[]),null);
});
