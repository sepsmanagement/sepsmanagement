/* Printed-number recognition stays on this device; only confirmed receipts reach the database. */
function sepsCameraCandidate(data,rows){
 const words=(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>(p.lines||[]).flatMap(l=>l.words||[])));
 const candidates=words.filter(w=>/^\d{5,}$/.test(w.text.trim())&&w.confidence>=55&&w.bbox).sort((a,b)=>(b.bbox.y1-b.bbox.y0)-(a.bbox.y1-a.bbox.y0));
 if(!candidates.length)return null;
 const top=candidates[0],number=top.text.trim(),height=top.bbox.y1-top.bbox.y0;
 if(candidates.some(w=>w.text.trim()!==number&&(w.bbox.y1-w.bbox.y0)>=height*.85))return null;
 return {number,row:rows.find(r=>String(r.id)===number)||null};
}
function createSepsCameraScanner({getSession,onReceive}){
 const $=id=>document.getElementById(id),panel=$('camera-panel');
 if(!panel)return {close(){}};
 let stream=null,worker=null,generation=0,sessionId=null,candidate=null,busy=false,loading=null;
 const status=text=>$('camera-status').textContent=text;
 function tracksOff(){stream?.getTracks().forEach(t=>t.stop());stream=null;$('camera-video').srcObject=null;}
 function close(){generation++;tracksOff();candidate=null;busy=false;panel.hidden=true;$('camera-confirm').hidden=true;const old=worker;worker=null;if(old)void old.terminate();$('camera-photo').width=0;}
 async function engine(at){
  if(!globalThis.Tesseract){if(!loading)loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='vendor/tesseract.min.js';script.onload=resolve;script.onerror=()=>{loading=null;reject(new Error('Could not load number reader. Check your connection and try again.'));};document.head.append(script);});await loading;}
  if(at!==generation)throw new Error('Camera closed.');
  const created=await Tesseract.createWorker('eng',1,{workerPath:new URL('vendor/tesseract-worker.min.js',location.href).href,corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',langPath:'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int',logger:m=>{if(at===generation&&m.status)status(m.status+' '+Math.round((m.progress||0)*100)+'%');}});
  if(at!==generation){await created.terminate();throw new Error('Camera closed.');}worker=created;
  await worker.setParameters({tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:'11'});return worker;
 }
 async function open(){close();const session=getSession();if(!session)return;panel.hidden=false;sessionId=session.dbId;const at=generation;status('Opening camera…');$('camera-read').disabled=true;$('camera-photo').hidden=true;$('camera-video').hidden=false;
  try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access requires HTTPS and a supported browser.');const opened=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});if(at!==generation){opened.getTracks().forEach(t=>t.stop());return;}stream=opened;$('camera-video').srcObject=stream;await $('camera-video').play();if(at!==generation)return;status('Keep the large shipment number horizontal, then tap Read number.');$('camera-read').disabled=false;$('camera-read').textContent='Read number';}
  catch(error){if(at===generation)status(error.name==='NotAllowedError'?'Camera permission was denied. Allow camera access in your browser, then reopen the camera.':error.message);}
 }
 $('camera-open').onclick=open;$('camera-close').onclick=close;
 $('camera-read').onclick=async()=>{
  if(busy)return;if(candidate||!stream){await open();return;}
  if(getSession()?.dbId!==sessionId){close();return;}const video=$('camera-video');if(!video.videoWidth){status('Camera is starting. Try again in a moment.');return;}
  const at=generation,canvas=$('camera-photo'),scale=Math.min(1,1600/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);canvas.hidden=false;video.hidden=true;tracksOff();busy=true;$('camera-read').disabled=true;status('Loading number reader…');
  try{const reader=worker||await engine(at);const result=await reader.recognize(canvas,{}, {text:true,blocks:true});if(at!==generation)return;if(getSession()?.dbId!==sessionId){close();return;}candidate=sepsCameraCandidate(result.data,getSession().rows);if(!candidate?.row){status(candidate?'Number '+candidate.number+' is not on this manifest. Retake or enter the shipment number manually.':'Could not confidently read one large number. Hold the tag upright, move closer and retake.');candidate=null;}else{status(candidate.number+' · '+candidate.row.name+' · Confirm this matches the package.');$('camera-confirm').hidden=false;}}
  catch(error){if(at===generation)status('Could not read number. '+error.message);}
  finally{if(at===generation){busy=false;$('camera-read').disabled=false;$('camera-read').textContent='Retake / next piece';}}
 };
 $('camera-confirm').onclick=async()=>{
  if(busy||!candidate?.row)return;if(getSession()?.dbId!==sessionId){close();return;}busy=true;const at=generation,number=candidate.number;candidate=null;$('camera-confirm').hidden=true;$('camera-read').disabled=true;status('Saving '+number+'…');
  try{const saved=await onReceive(number,sessionId);if(at===generation)status(saved?'✓ '+number+' received. Tap Next piece for another package.':'Receipt was not confirmed. Check the scan message before trying again.');}
  catch(error){if(at===generation)status(error.message);}
  finally{if(at===generation){busy=false;$('camera-read').disabled=false;$('camera-read').textContent='Next piece';}}
 };
 document.addEventListener('visibilitychange',()=>{if(document.hidden)close();});window.addEventListener('pagehide',close);
 return {close};
}
