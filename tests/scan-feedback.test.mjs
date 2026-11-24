import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../operations/scan-feedback.js',import.meta.url),'utf8');
test('accepted scans beep, rejected scans buzz and supported devices vibrate',async()=>{
 const tones=[],vibrations=[];let contexts=0;
 class AudioContext{constructor(){contexts++;this.state='suspended';this.currentTime=0;this.destination={}}async resume(){this.state='running'}createOscillator(){const o={type:'sine',frequency:{setValueAtTime(hz){o.hz=hz}},connect(){},disconnect(){},start(){tones.push(o)},stop(){}};return o}createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}}}}
 const ctx=vm.createContext({setTimeout,clearTimeout,AudioContext,navigator:{vibrate:pattern=>vibrations.push(Array.from(pattern))}});vm.runInContext(source,ctx);const feedback=ctx.createSepsScanFeedback();assert.equal(await feedback.unlock(),true);feedback.accepted();assert.equal(tones.length,1);assert.equal(tones[0].type,'sine');assert.equal(vibrations.length,0);feedback.rejected();assert.equal(tones.length,3);assert.equal(tones[1].type,'square');assert(tones[1].hz<tones[0].hz);assert.deepEqual(vibrations,[[140,70,140]]);await feedback.unlock();assert.equal(contexts,1);
});
test('blocked or unavailable audio and vibration do not throw or interrupt scanning',async()=>{
 for(const AudioContext of [undefined,class{constructor(){throw Error('Audio blocked')}}]){const ctx=vm.createContext({setTimeout,clearTimeout,AudioContext,navigator:{vibrate(){throw Error('Unsupported')}}});vm.runInContext(source,ctx);const feedback=ctx.createSepsScanFeedback();assert.equal(await feedback.unlock(),false);assert.doesNotThrow(()=>feedback.accepted());assert.doesNotThrow(()=>feedback.rejected());}
});
test('announces the confirmed owner only after the beep ends; errors never announce a name',async()=>{
 const tones=[],spoken=[],cancelled=[];
 class AudioContext{constructor(){this.state='running';this.currentTime=0;this.destination={}}createOscillator(){const o={frequency:{setValueAtTime(){}},connect(){},disconnect(){},start(){tones.push(o)},stop(){}};return o}createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}}}}
 class Utterance{constructor(text){this.text=text}}
 const ctx=vm.createContext({setTimeout,clearTimeout,AudioContext,SpeechSynthesisUtterance:Utterance,speechSynthesis:{getVoices:()=>[],speak:u=>spoken.push(u.text),cancel:()=>cancelled.push(true)}});vm.runInContext(source,ctx);const feedback=ctx.createSepsScanFeedback();await feedback.unlock();
 feedback.accepted('MITCHELL, HADAKI');assert.deepEqual(spoken,[]);tones[0].onended();assert.deepEqual(spoken,['MITCHELL, HADAKI']);
 feedback.accepted('MARTIS, MONIQUE');tones[1].onended();assert.deepEqual(spoken,['MITCHELL, HADAKI','MARTIS, MONIQUE']);
 feedback.rejected();tones[2].onended();tones[3].onended();assert.equal(spoken.length,2);
 feedback.accepted('Private owner');feedback.stop();tones[4].onended();assert.equal(spoken.length,2,'sign-out cancels names waiting for a beep');assert.equal(cancelled.length,1);
});
test('missing or blocked text-to-speech cannot interrupt receiving sounds',async()=>{
 for(const Utterance of [undefined,class{constructor(text){this.text=text}}]){const ctx=vm.createContext({setTimeout,clearTimeout,SpeechSynthesisUtterance:Utterance,speechSynthesis:{speak(){throw Error('Speech blocked')}}});vm.runInContext(source,ctx);const feedback=ctx.createSepsScanFeedback();assert.equal(feedback.speechAvailable(),typeof Utterance==='function');assert.doesNotThrow(()=>feedback.accepted('Owner name'));await Promise.resolve();}
});
test('native media plays during the click, queues tones and announces only after the audio ends',async()=>{
 const plays=[],spoken=[];let player;
 class Audio{constructor(){player=this}play(){plays.push(this.src);return Promise.resolve()}pause(){}}
 class Utterance{constructor(text){this.text=text}}
 const ctx=vm.createContext({Audio,URL,location:{href:'https://www.sepsmanagement.com/operations/'},SpeechSynthesisUtterance:Utterance,speechSynthesis:{speak:u=>spoken.push(u.text),cancel(){},getVoices:()=>[]},setTimeout,clearTimeout});vm.runInContext(source,ctx);const feedback=ctx.createSepsScanFeedback();
 const first=feedback.accepted('First owner');assert.equal(plays.length,1,'starts synchronously in the user gesture');assert.equal(await first,true);assert.deepEqual(spoken,[]);
 feedback.accepted('Second owner');assert.equal(plays.length,1,'does not interrupt the first beep');player.onended();assert.deepEqual(spoken,['First owner']);assert.equal(plays.length,2);player.onended();assert.deepEqual(spoken,['First owner','Second owner']);
 feedback.rejected();assert(plays[2].endsWith('audio/rejected.wav'));player.onended();assert.equal(spoken.length,2);feedback.stop();
});
