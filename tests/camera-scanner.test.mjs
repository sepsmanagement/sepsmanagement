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
test('camera auto-receives, blocks repeated frames, rearms after removal and sends unknown numbers to validation',async()=>{
 const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,textContent:'',videoWidth:1000,videoHeight:500,play:async()=>{},getContext:()=>({drawImage(){}})});return nodes.get(id);};
 let started=false;let clock=0;let tick=null,stopped=0,number='87654321',confidence=90,text=null,finish=null;
 const receipts=[];let session={dbId:'session1',rows:[{id:'87654321',name:'Owner'},{id:'22222222',name:'Second owner'}]};
 const local=vm.createContext({Date:{now:()=>clock},setTimeout(fn,delay){clock+=delay;tick=fn;return 1},clearTimeout(){tick=null},document:{getElementById:get,addEventListener(){}},window:{addEventListener(){}},navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stopped++}}]})}},URL,location:{href:'https://example.com/operations/'},Tesseract:{createWorker:async()=>({setParameters:async()=>{},recognize:async()=>({data:{text:text??number,blocks:[{paragraphs:[{lines:[{words:number?[word(number,90,confidence)]:[]}]}]}]}}),terminate:async()=>{}})}});
 vm.runInContext(source,local);const scanner=local.createSepsCameraScanner({onStart:()=>{started=true},getSession:()=>session,onReceive:async(code,id)=>{receipts.push([code,id]);if(finish==='wait')await new Promise(resolve=>finish=resolve);return code==='87654321';}});
 assert.equal(get('camera-confirm').hidden,true,'cached manual controls are hidden');assert.equal(get('camera-read').hidden,true);
 await get('camera-open').onclick();assert.equal(started,true,'camera start unlocks speech from the user tap');await new Promise(resolve=>setImmediate(resolve));assert.equal(receipts.length,0);finish='wait';const saving=tick();await new Promise(resolve=>setImmediate(resolve));assert.equal(receipts.length,1,'second consistent read automatically submits');finish();await saving;
 for(let i=0;i<5;i++)await tick();assert.equal(receipts.length,1,'held tag cannot create duplicate receipts');assert.equal(get('camera-video').hidden,false);
 number='';text='unreadable tag';for(let i=0;i<4;i++)await tick();number='87654321';text=null;await tick();await tick();assert.equal(receipts.length,1,'misread frames do not rearm');
 number='';for(let i=0;i<16;i++)await tick();number='87654321';await tick();await tick();assert.equal(receipts.length,2,'removing tag rearms for another piece with same number');
 number='12345678';await tick();await tick();assert.deepEqual(receipts.at(-1),['12345678','session1'],'next different tag submits automatically without buttons');
 number='11111111';await tick();await tick();assert.deepEqual(receipts.at(-1),['11111111','session1'],'unknown numbers use normal server error flow');await tick();await tick();assert.equal(receipts.length,4,'rejected tag does not repeatedly submit');
 number='22222222';confidence=96;await tick();assert.equal(receipts.length,5,'clear manifest match submits after a single read');
 number='33333333';await tick();assert.equal(receipts.length,5,'unknown high-confidence number still needs a second read');
 session={dbId:'other',rows:[]};await tick();assert.equal(receipts.length,5);assert(stopped>=1);assert.equal(get('camera-panel').hidden,true);scanner.close();
});
test('joins eight spaced digits or OCR fragments and rejects other lengths',()=>{
 const words='1 4 9 4 9 3 8 9'.split(' ').map((d,i)=>({...word(d,80),bbox:{x0:i*35,x1:i*35+30,y0:0,y1:80}}));
 assert.equal(read(words,[{id:'14949389'}]).number,'14949389');
 assert.equal(read([word('1494 9389',80)],[{id:'14949389'}]).number,'14949389');
 assert.equal(read([word('1494938',80)],[]),null);
 assert.equal(read([word('149493891',80)],[]),null);
});
