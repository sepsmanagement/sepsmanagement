import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../scanner/app.js',import.meta.url),'utf8');
test('workspace starts locked, shows authenticated data, reconstructs date totals and clears data on logout',async()=>{
 const nodes=new Map();function node(){return {set id(value){nodes.set(value,this)},value:'',_text:'',get textContent(){return this._text+this.children.map(child=>child.textContent).join('')},set textContent(value){this._text=String(value);this.children=[]},hidden:false,children:[],classList:{toggle(){},add(){},remove(){}},append(...items){for(const x of items){this.children.push(x);if(x.value&&!this.value)this.value=x.value}},replaceChildren(){this.children=[];this._text='';this.value=''},setAttribute(){},addEventListener(){},focus(){}};}
 const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};let prints=0;
 const tables={seps_sessions:[{id:'session1',container:'SEGU3921667',voyage:'TE1804',source:'private-manifest.pdf',manifest_incomplete:true,created_at:'2026-11-06T08:00:00'}],seps_shipments:[{id:'shipment1',session_id:'session1',shipment_no:'12345678',bl_no:'TSCW 12345678',consignee:'Private customer',barcode:'12345678',expected:2,received:0}],seps_scan_events:[{id:'event1',session_id:'session1',shipment_id:'shipment1',actor_id:'staff1',actor_email:'staff@example.com',action:'receive',delta:1,barcode:'12345678',created_at:'2026-11-06T09:00:00'},{id:'event2',session_id:'session1',shipment_id:'shipment1',actor_id:'staff1',actor_email:'staff@example.com',action:'undo',delta:-1,barcode:'12345678',original_event_id:'event1',reason:'Correction',created_at:'2026-11-07T09:00:00'}]};
 const profile={user_id:'staff1',email:'staff@example.com',active:true,role:'staff'};
 const client={auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(){}},from(table){return{select(){return this},order(){return this},range:async()=>({data:tables[table],error:null})}}};
 const ctx=vm.createContext({document:{hidden:false,getElementById:get,createElement:node,querySelectorAll(){return[]},addEventListener(){}},window:{addEventListener(){},prompt(){return''},print(){prints++}},SEPS_AUTH:{client,membership:async()=>profile,message(){},signOut(){}},setInterval(){},crypto:{randomUUID(){return'uuid'}},pdfjsLib:{GlobalWorkerOptions:{}},console,Date});
 await vm.runInContext(source,ctx);assert.equal(get('workspace').hidden,true);assert.equal(get('checklist').children.length,0,'no demo data before login');
 ctx.testProfile=profile;await vm.runInContext('activate(testProfile)',ctx);assert.equal(get('workspace').hidden,false);assert.equal(get('checklist').children.length,1);assert.equal(get('received').textContent,'0');
 get('day').value='2026-11-06';vm.runInContext('renderReport()',ctx);assert(get('reporttotal').textContent.includes('Received 1'),'past report excludes the next-day correction');
 get('day').value='';vm.runInContext('renderReport()',ctx);assert(get('reporttotal').textContent.includes('Received 0'),'current report includes correction');
 vm.runInContext("$('historyreport').onclick()",ctx);assert.equal(prints,1);
 vm.runInContext('lock()',ctx);assert.equal(get('workspace').hidden,true);assert.equal(get('checklist').children.length,0);assert.equal(get('reportrows').children.length,0);assert.equal(get('activemeta').textContent,'');assert.equal(get('staff-list').children.length,0);assert.equal(get('signedin-email').textContent,'Signed out');
});
