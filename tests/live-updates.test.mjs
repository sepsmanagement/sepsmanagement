import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../operations/live-updates.js',import.meta.url),'utf8');
function fixture(refresh=async()=>{}){
 const timers=new Map();let next=0,channel,status,removed=0,active=true,connections=[],errors=[];
 const client={channel(){channel={handlers:[],on(type,config,fn){this.handlers.push({type,config,fn});return this},subscribe(fn){status=fn;return this}};return channel},async removeChannel(){removed++}};
 const ctx=vm.createContext({setTimeout(fn){const id=++next;timers.set(id,fn);return id},clearTimeout(id){timers.delete(id)}});vm.runInContext(source,ctx);
 const controller=ctx.createSepsLiveSync({client,isActive:()=>active,refresh,onConnection:x=>connections.push(x),onError:e=>errors.push(e)});
 return{controller,client,timers,connections,errors,get channel(){return channel},get removed(){return removed},set active(x){active=x},status:x=>status(x),event(table='seps_scan_events'){channel.handlers.find(h=>h.config.table===table).fn()},async flush(){while(timers.size){const [id,fn]=timers.entries().next().value;timers.delete(id);await fn();}}};
}
test('two open clients refresh from confirmed database events and coalesce scan bursts',async()=>{
 let databaseCount=0,left=-1,right=-1,reads=0;
 const a=fixture(async()=>{left=databaseCount;reads++}),b=fixture(async()=>{right=databaseCount;reads++});
 a.controller.start();b.controller.start();a.status('SUBSCRIBED');b.status('SUBSCRIBED');await a.flush();await b.flush();assert.equal(left,0);assert.equal(right,0);
 databaseCount=2;for(let n=0;n<5;n++){a.event();b.event();}assert.equal(a.timers.size,1);assert.equal(b.timers.size,1);
 await a.flush();await b.flush();assert.equal(left,2);assert.equal(right,2);assert.equal(reads,4,'one refresh per device per burst');
 a.controller.stop();b.controller.stop();
});
test('an event during a running refresh causes another read rather than getting lost',async()=>{
 let release,reads=0;const f=fixture(async()=>{reads++;if(reads===1)await new Promise(resolve=>release=resolve)});f.controller.start();f.event();const pending=f.flush();assert.equal(reads,1);f.event();release();await pending;assert.equal(reads,2);f.controller.stop();
});
test('reconnecting catches up; stale callbacks and pending timers cannot refresh after logout',async()=>{
 let reads=0;const f=fixture(async()=>reads++);f.controller.start();const oldCallback=f.channel.handlers[0].fn,oldStatus=f.status;
 f.status('SUBSCRIBED');await f.flush();assert.equal(reads,1);f.status('CHANNEL_ERROR');assert.equal(f.connections.at(-1),false);f.status('SUBSCRIBED');await f.flush();assert.equal(reads,2);
 f.event();f.controller.stop();assert.equal(f.timers.size,0);assert.equal(f.removed,1);oldCallback();oldStatus('SUBSCRIBED');await f.flush();assert.equal(reads,2);
 f.controller.start();f.active=false;f.event();await f.flush();assert.equal(reads,2);f.controller.stop();
});
test('read failures report a delayed sync without changing confirmed data',async()=>{const f=fixture(async()=>{throw Error('Network unavailable')});f.controller.start();f.event();await f.flush();assert.equal(f.errors.length,1);f.controller.stop();});
