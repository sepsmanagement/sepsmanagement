'use strict';
// One audio context per page. Audio/vibration failures must never affect receiving.
globalThis.createSepsScanFeedback = function createSepsScanFeedback() {
 let context=null,generation=0,speechPrimed=false,cachedVoices=[];const pendingSpeech=new Set();
 function speechAvailable(){return typeof globalThis.SpeechSynthesisUtterance==='function'&&typeof globalThis.speechSynthesis?.speak==='function';}
 function available(){return mediaAvailable()||typeof(globalThis.AudioContext||globalThis.webkitAudioContext)==='function';}
 function loadVoices(){try{cachedVoices=globalThis.speechSynthesis?.getVoices?.()||[];}catch{}}
 loadVoices();globalThis.speechSynthesis?.addEventListener?.('voiceschanged',loadVoices);
 function primeSpeech(){
  if(!speechAvailable())return;
  try{const speech=globalThis.speechSynthesis;loadVoices();if(speech.paused)speech.resume?.();if(speechPrimed)return;
   const warm=new globalThis.SpeechSynthesisUtterance('.');warm.volume=0;warm.rate=10;warm.lang='en-US';
   const voice=cachedVoices.find(v=>v.localService&&/^en/i.test(v.lang));if(voice)warm.voice=voice;
   pendingSpeech.add(warm);warm.onend=warm.onerror=()=>pendingSpeech.delete(warm);speech.speak(warm);speechPrimed=true;
  }catch{}
 }
 async function unlock(){
  primeSpeech();
  try{const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return false;
   if(!context||context.state==='closed')context=new Audio();
   if(context.state!=='running'){let timeout;try{await Promise.race([context.resume(),new Promise(resolve=>{timeout=setTimeout(resolve,1500)})]);}finally{clearTimeout(timeout);}}
   return context.state==='running';
  }catch{return false;}
 }
 let media=null,currentMedia=null;const mediaQueue=[];
 function mediaAvailable(){return typeof globalThis.Audio==='function';}
 function getMedia(){
  if(!media){media=globalThis.document?.getElementById('scan-audio-player')||new globalThis.Audio();media.preload='auto';media.playsInline=true;}
  return media;
 }
 function playMedia(kind,after){
  if(!mediaAvailable())return null;
  return new Promise(resolve=>{mediaQueue.push({kind,after,resolve,version:generation});pumpMedia();});
 }
 function pumpMedia(){
  if(currentMedia||!mediaQueue.length)return;
  const job=mediaQueue.shift();if(job.version!==generation){job.resolve(false);pumpMedia();return;}
  currentMedia=job;let timer=null,finished=false,fallingBack=false;
  const finish=()=>{if(finished)return;finished=true;job.resolve(true);clearTimeout(timer);if(currentMedia===job)currentMedia=null;if(job.version===generation){try{job.after?.();}catch{}}pumpMedia();};
  const fallback=()=>{if(finished||fallingBack)return;fallingBack=true;clearTimeout(timer);try{media.pause();}catch{}void unlock().then(ready=>{if(finished)return;job.resolve(ready);if(job.version!==generation){finish();return;}if(ready)tone(job.kind,finish);else finish();});};
  job.cancel=()=>{finished=true;clearTimeout(timer);job.resolve(false);};
  try{const player=getMedia();player.onended=finish;player.onerror=fallback;player.volume=1;player.muted=false;
   player.src=new URL('audio/'+job.kind+'.wav',globalThis.location.href).href;
   timer=setTimeout(fallback,4000);
   const started=player.play();
   Promise.resolve(started).then(()=>{if(!finished)job.resolve(true);}).catch(fallback);
  }catch{fallback();}
 }
 function tone(kind,after){
  const finish=()=>{try{after?.();}catch{}};
  if(!context||context.state!=='running'){finish();return;}
  try{const start=context.currentTime;const pulses=kind==='accepted'?[{at:0,duration:.12,hz:940,type:'sine'}]:[{at:0,duration:.13,hz:125,type:'square'},{at:.20,duration:.13,hz:100,type:'square'}];
   for(const p of pulses){const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type=p.type;oscillator.frequency.setValueAtTime(p.hz,start+p.at);gain.gain.setValueAtTime(0,start+p.at);gain.gain.linearRampToValueAtTime(kind==='accepted'?.18:.09,start+p.at+.008);gain.gain.setValueAtTime(kind==='accepted'?.18:.09,start+p.at+p.duration-.02);gain.gain.linearRampToValueAtTime(0,start+p.at+p.duration);oscillator.connect(gain);gain.connect(context.destination);oscillator.start(start+p.at);oscillator.stop(start+p.at+p.duration);oscillator.onended=()=>{try{oscillator.disconnect();gain.disconnect();}catch{}if(p===pulses[pulses.length-1])finish();};}
  }catch{finish();}
 }
 function prepareAnnouncement(name){
  const text=String(name||'').trim();if(!text||!speechAvailable())return null;
  try{const utterance=new globalThis.SpeechSynthesisUtterance(text);
   const voice=cachedVoices.find(v=>v.localService&&/^en[-_]US$/i.test(v.lang))||cachedVoices.find(v=>v.localService&&/^en/i.test(v.lang));
   if(voice)utterance.voice=voice;utterance.lang=voice?.lang||'en-US';utterance.rate=1.1;utterance.volume=1;return utterance;
  }catch{return null;}
 }
 function announce(utterance,version){
  if(!utterance||version!==generation)return;
  try{const speech=globalThis.speechSynthesis;if(speech.paused)speech.resume?.();
   pendingSpeech.add(utterance);utterance.onend=utterance.onerror=()=>pendingSpeech.delete(utterance);try{speech.speak(utterance);}catch{pendingSpeech.delete(utterance);}
  }catch{}
 }
 function accepted(ownerName=''){const version=generation,utterance=prepareAnnouncement(ownerName),after=()=>announce(utterance,version);const native=playMedia('accepted',after);if(native)return native;if(context?.state==='running'){tone('accepted',after);return Promise.resolve(true);}return unlock().then(ready=>{if(version!==generation)return false;if(ready)tone('accepted',after);else after();return ready;});}
 function stop(){generation++;speechPrimed=false;if(currentMedia){currentMedia.cancel?.();currentMedia=null;}for(const job of mediaQueue.splice(0))job.resolve(false);if(media){try{media.pause();}catch{}media.onended=media.onerror=null;}pendingSpeech.clear();try{globalThis.speechSynthesis?.cancel();}catch{}}

 function rejected(){try{globalThis.navigator?.vibrate?.([140,70,140]);}catch{}if(playMedia('rejected'))return;if(context?.state==='running')tone('rejected');else void unlock().then(ready=>{if(ready)tone('rejected');});}
 return {available,speechAvailable,unlock,accepted,rejected,stop};
};
