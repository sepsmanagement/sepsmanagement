import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../operations/scan-feedback.js',import.meta.url),'utf8');
test('accepted scans beep, rejected scans buzz and supported devices vibrate',async()=>{
 const tones=[],vibrations=[];let contexts=0;
 class AudioContext{constructor(){contexts++;this.state='suspended';this.currentTime=0;this.destination={}}async resume(){this.state='running'}createOscillator(){const o={type:'sine',frequency:{setValueAtTime(hz){o.hz=hz}},connect(){},disconnect(){},start(){tones.push(o)},stop(){}};return o}createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}}}}
 const ctx=vm.createContext({AudioContext,navigator:{vibrate:pattern=>vibrations.push(Array.from(pattern))}});vm.runInContext(source,ctx);const feedback=ctx.createSepsScanFeedback();assert.equal(await feedback.unlock(),true);feedback.accepted();assert.equal(tones.length,1);assert.equal(tones[0].type,'sine');assert.equal(vibrations.length,0);feedback.rejected();assert.equal(tones.length,3);assert.equal(tones[1].type,'square');assert(tones[1].hz<tones[0].hz);assert.deepEqual(vibrations,[[140,70,140]]);await feedback.unlock();assert.equal(contexts,1);
});
test('blocked or unavailable audio and vibration do not throw or interrupt scanning',async()=>{
 for(const AudioContext of [undefined,class{constructor(){throw Error('Audio blocked')}}]){const ctx=vm.createContext({AudioContext,navigator:{vibrate(){throw Error('Unsupported')}}});vm.runInContext(source,ctx);const feedback=ctx.createSepsScanFeedback();assert.equal(await feedback.unlock(),false);assert.doesNotThrow(()=>feedback.accepted());assert.doesNotThrow(()=>feedback.rejected());}
});
