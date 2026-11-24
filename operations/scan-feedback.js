'use strict';
// One audio context per page. Audio/vibration failures must never affect receiving.
globalThis.createSepsScanFeedback = function createSepsScanFeedback() {
 let context=null,generation=0;const pendingSpeech=new Set();
 function speechAvailable(){return typeof globalThis.SpeechSynthesisUtterance==='function'&&typeof globalThis.speechSynthesis?.speak==='function';}
 function available(){return typeof(globalThis.AudioContext||globalThis.webkitAudioContext)==='function';}
 async function unlock(){
  try{const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return false;
   if(!context||context.state==='closed')context=new Audio();
   if(context.state!=='running')await context.resume();
   return context.state==='running';
  }catch{return false;}
 }
 function tone(kind,after){
  const finish=()=>{try{after?.();}catch{}};
  if(!context||context.state!=='running'){finish();return;}
  try{const start=context.currentTime;const pulses=kind==='accepted'?[{at:0,duration:.12,hz:940,type:'sine'}]:[{at:0,duration:.13,hz:125,type:'square'},{at:.20,duration:.13,hz:100,type:'square'}];
   for(const p of pulses){const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type=p.type;oscillator.frequency.setValueAtTime(p.hz,start+p.at);gain.gain.setValueAtTime(0,start+p.at);gain.gain.linearRampToValueAtTime(kind==='accepted'?.18:.09,start+p.at+.008);gain.gain.setValueAtTime(kind==='accepted'?.18:.09,start+p.at+p.duration-.02);gain.gain.linearRampToValueAtTime(0,start+p.at+p.duration);oscillator.connect(gain);gain.connect(context.destination);oscillator.start(start+p.at);oscillator.stop(start+p.at+p.duration);oscillator.onended=()=>{try{oscillator.disconnect();gain.disconnect();}catch{}if(p===pulses[pulses.length-1])finish();};}
  }catch{finish();}
 }
 function announce(name,version){
  const text=String(name||'').trim();if(!text||version!==generation)return;
  try{const speech=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance;if(!speech||typeof Utterance!=='function')return;
   const utterance=new Utterance(text);const voices=speech.getVoices?.()||[];
   const voice=voices.find(v=>v.localService&&/^en[-_]US$/i.test(v.lang))||voices.find(v=>v.localService&&/^en/i.test(v.lang));
   if(voice)utterance.voice=voice;utterance.lang=voice?.lang||'en-US';utterance.rate=1;utterance.volume=1;
   // The browser queues names in order; never cancel an earlier accepted scan for a new one.
   pendingSpeech.add(utterance);utterance.onend=utterance.onerror=()=>pendingSpeech.delete(utterance);try{speech.speak(utterance);}catch{pendingSpeech.delete(utterance);}
  }catch{}
 }
 function accepted(ownerName=''){const version=generation,after=()=>announce(ownerName,version);if(context?.state==='running')tone('accepted',after);else void unlock().then(ready=>{if(version!==generation)return;if(ready)tone('accepted',after);else after();});}
 function stop(){generation++;pendingSpeech.clear();try{globalThis.speechSynthesis?.cancel();}catch{}}

 function rejected(){try{globalThis.navigator?.vibrate?.([140,70,140]);}catch{}if(context?.state==='running')tone('rejected');else void unlock().then(ready=>{if(ready)tone('rejected');});}
 return {available,speechAvailable,unlock,accepted,rejected,stop};
};
