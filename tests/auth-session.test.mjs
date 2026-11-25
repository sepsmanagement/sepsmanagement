import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const setup=await readFile(new URL('../operations/auth-client.js',import.meta.url),'utf8');
const auth=await readFile(new URL('../operations/auth.js',import.meta.url),'utf8');
test('portal uses memory-only auth and removes only its old saved login',()=>{
 const removed=[],calls=[];const client={};const window={SEPS_CONFIG:{url:'https://example.supabase.co',publishableKey:'public'},localStorage:{removeItem:key=>removed.push(key)},supabase:{createClient:(...args)=>(calls.push(args),client)}};
 vm.runInNewContext(setup,{window});assert.equal(window.sepsClient,client);assert.equal(calls[0][2].auth.persistSession,false);assert.equal(calls[0][2].auth.autoRefreshToken,true);assert.equal(calls[0][2].auth.detectSessionInUrl,false);assert.deepEqual(removed,['seps-staff-auth','seps-staff-auth-user']);
});
function fixture(){
 const nodes=new Map(),listeners={},events=[];let resolveLogin;
 const get=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='email'?'staff@example.com':'password',addEventListener(type,fn){this[type]=fn}});return nodes.get(id)};
 const client={auth:{signInWithPassword:()=>new Promise(resolve=>resolveLogin=resolve),getUser:async()=>({data:{user:{id:'staff'}}}),signOut:async()=>({error:null})},from(){return{select(){return this},eq(){return this},maybeSingle:async()=>({data:{active:true,email:'staff@example.com'}})}}};
 const window={sepsClient:client,location:{href:'https://example.com/operations/receiving.html'},addEventListener:(type,fn)=>listeners[type]=fn,dispatchEvent:event=>events.push(event.type)};
 vm.runInNewContext(auth,{window,document:{getElementById:get},URL,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail}}});
 return {get,events,listeners,window,complete:()=>resolveLogin({error:null})};
}
test('explicit password sign-in opens workspace, but a late response after sign-out cannot reopen it',async()=>{
 const normal=fixture();const task=normal.get('login-form').submit({preventDefault(){}});normal.complete();await task;assert.deepEqual(normal.events,['seps:authenticated']);
 const stale=fixture();const pending=stale.get('login-form').submit({preventDefault(){}});await stale.window.SEPS_AUTH.signOut();stale.complete();await pending;assert.deepEqual(stale.events,['seps:locked']);
 const away=fixture();const navigation=away.get('login-form').submit({preventDefault(){}});away.listeners.pagehide();away.complete();await navigation;assert.deepEqual(away.events,[]);
});
