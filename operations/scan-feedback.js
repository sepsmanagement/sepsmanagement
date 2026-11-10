'use strict';
// One audio context per page. Audio/vibration failures must never affect receiving.
globalThis.createSepsScanFeedback = function createSepsScanFeedback() {
 let context=null;
 function available(){return typeof(globalThis.AudioContext||globalThis.webkitAudioContext)==='function';}
 async function unlock(){
  try{const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return false;
   if(!context||context.state==='closed')context=new Audio();
   if(context.state!=='running')await context.resume();
   return context.state==='running';
  }catch{return false;}
 }
 function tone(kind){
  if(!context||context.state!=='running')return;
  try{const start=context.currentTime;const pulses=kind==='accepted'?[{at:0,duration:.12,hz:940,type:'sine'}]:[{at:0,duration:.13,hz:125,type:'square'},{at:.20,duration:.13,hz:100,type:'square'}];
   for(const p of pulses){const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type=p.type;oscillator.frequency.setValueAtTime(p.hz,start+p.at);gain.gain.setValueAtTime(0,start+p.at);gain.gain.linearRampToValueAtTime(kind==='accepted'?.18:.09,start+p.at+.008);gain.gain.setValueAtTime(kind==='accepted'?.18:.09,start+p.at+p.duration-.02);gain.gain.linearRampToValueAtTime(0,start+p.at+p.duration);oscillator.connect(gain);gain.connect(context.destination);oscillator.start(start+p.at);oscillator.stop(start+p.at+p.duration);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};}
  }catch{}
 }
 function accepted(){if(context?.state==='running')tone('accepted');else void unlock().then(ready=>{if(ready)tone('accepted');});}
 function rejected(){try{globalThis.navigator?.vibrate?.([140,70,140]);}catch{}if(context?.state==='running')tone('rejected');else void unlock().then(ready=>{if(ready)tone('rejected');});}
 return {available,unlock,accepted,rejected};
};
