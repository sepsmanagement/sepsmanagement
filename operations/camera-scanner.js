/* Continuous eight-digit recognition stays on this device; recognized numbers use the normal receiving flow. */
function sepsCameraCandidate(data,rows){
 const lines=(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[]));
 const candidates=[];
 for(const line of lines){
  const words=(line.words||[]).filter(w=>w.bbox);
  for(let i=0;i<words.length;i++){
   let digits='',group=[];
   for(let j=i;j<words.length;j++){
    const w=words[j],text=w.text.trim();if(!/^[\d\s]+$/.test(text)||w.confidence<45)break;
    if(group.length){const prev=group[group.length-1],h=Math.max(w.bbox.y1-w.bbox.y0,prev.bbox.y1-prev.bbox.y0);if(w.bbox.x0-prev.bbox.x1>h*1.5)break;}
    group.push(w);digits+=text.replace(/\s/g,'');if(digits.length>8)break;
    if(digits.length===8){const adjacent=[i>0?words[i-1]:null,j+1<words.length?words[j+1]:null].filter(Boolean);if(adjacent.some(n=>/^\d+$/.test(n.text.trim())&&Math.abs((n.bbox.y1-n.bbox.y0)-(w.bbox.y1-w.bbox.y0))<Math.max(5,(w.bbox.y1-w.bbox.y0)*.25)&&Math.min(Math.abs(n.bbox.x0-w.bbox.x1),Math.abs(words[i].bbox.x0-n.bbox.x1))<(w.bbox.y1-w.bbox.y0)*.6))break;candidates.push({text:digits,bbox:{y0:Math.min(...group.map(x=>x.bbox.y0)),y1:Math.max(...group.map(x=>x.bbox.y1))}});break;}
   }
  }
 }
 candidates.sort((a,b)=>(b.bbox.y1-b.bbox.y0)-(a.bbox.y1-a.bbox.y0));
 if(!candidates.length)return null;
 const top=candidates[0],number=top.text.trim(),height=top.bbox.y1-top.bbox.y0;
 if(candidates.some(w=>w.text.trim()!==number&&(w.bbox.y1-w.bbox.y0)>=height*.85))return null;
 return {number,row:rows.find(r=>String(r.id)===number)||null};
}
function createSepsCameraScanner({getSession,onReceive}){
 const $=id=>document.getElementById(id),panel=$('camera-panel');
 if(!panel)return {close(){}};
 let stream=null,worker=null,generation=0,sessionId=null,blockedNumber=null,clearFrames=0,busy=false,loading=null,timer=null,reading=false,lastNumber=null,stable=0;
 const status=text=>$('camera-status').textContent=text;
 function tracksOff(){stream?.getTracks().forEach(t=>t.stop());stream=null;$('camera-video').srcObject=null;}
 function close(){generation++;clearTimeout(timer);reading=false;lastNumber=null;stable=0;tracksOff();blockedNumber=null;clearFrames=0;busy=false;panel.hidden=true;const old=worker;worker=null;if(old)void old.terminate();$('camera-photo').width=0;}
 async function engine(at){
  if(!globalThis.Tesseract){if(!loading)loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='vendor/tesseract.min.js';script.onload=resolve;script.onerror=()=>{loading=null;reject(new Error('Could not load number reader. Check your connection and try again.'));};document.head.append(script);});await loading;}
  if(at!==generation)throw new Error('Camera closed.');
  const created=await Tesseract.createWorker('eng',1,{workerPath:new URL('vendor/tesseract-worker.min.js',location.href).href,corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',langPath:'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int',logger:m=>{if(at===generation&&!reading&&m.status)status(m.status+' '+Math.round((m.progress||0)*100)+'%');}});
  if(at!==generation){await created.terminate();throw new Error('Camera closed.');}worker=created;
  await worker.setParameters({tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:'11'});return worker;
 }
 async function open(){close();const session=getSession();if(!session)return;panel.hidden=false;sessionId=session.dbId;const at=generation;status('Opening camera…');$('camera-photo').hidden=true;$('camera-video').hidden=false;
  try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access requires HTTPS and a supported browser.');const opened=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});if(at!==generation){opened.getTracks().forEach(t=>t.stop());return;}stream=opened;$('camera-video').srcObject=stream;await $('camera-video').play();if(at!==generation)return;status('Starting automatic reader…');await engine(at);if(at!==generation)return;reading=true;status('Scanning automatically. Hold the eight digits horizontally in the guide.');void scanFrame(at);}
  catch(error){if(at===generation)status(error.name==='NotAllowedError'?'Camera permission was denied. Allow camera access in your browser, then reopen the camera.':error.message);}
 }
 $('camera-open').onclick=open;$('camera-close').onclick=close;
 async function scanFrame(at){
  if(at!==generation||!reading||busy)return;
  if(getSession()?.dbId!==sessionId){close();return;}
  const video=$('camera-video'),canvas=$('camera-photo');
  if(!video.videoWidth){timer=setTimeout(()=>scanFrame(at),250);return;}
  // Read only the central guide instead of running OCR on the whole camera frame.
  const width=video.videoWidth,height=video.videoHeight,sy=height*.32,sh=height*.36;
  const scale=Math.min(1,1100/width);canvas.width=Math.round(width*scale);canvas.height=Math.round(sh*scale);
  canvas.getContext('2d').drawImage(video,0,sy,width,sh,0,0,canvas.width,canvas.height);
  try{
   const result=await worker.recognize(canvas,{}, {text:true,blocks:true});
   if(at!==generation)return;if(getSession()?.dbId!==sessionId){close();return;}
   const found=sepsCameraCandidate(result.data,getSession().rows);
   if(found){
    clearFrames=0;
    if(found.number===blockedNumber){lastNumber=null;stable=0;status('Move this tag out of the guide before scanning another piece with the same number.');}
    else{
     stable=lastNumber===found.number?stable+1:1;lastNumber=found.number;
     if(stable>=2){
      // Block this presentation before the request starts, including rejected scans.
      blockedNumber=found.number;busy=true;lastNumber=null;stable=0;status('Receiving '+found.number+'…');
      const saved=await onReceive(found.number,sessionId);
      if(at!==generation)return;
      busy=false;status(saved?'✓ '+found.number+' received. Move to the next package.':'Number was not accepted. Check the scan error and move the tag out before retrying.');
     }else status('Reading '+found.number+'…');
    }
   }else{
    lastNumber=null;stable=0;
    // Require several genuinely empty OCR frames, rather than one misread frame.
    clearFrames=!String(result.data.text||'').trim()?clearFrames+1:0;
    if(clearFrames>=3)blockedNumber=null;
    status(blockedNumber?'Move the tag out of the guide to scan the next piece.':'Scanning automatically. Hold all eight digits horizontally in the guide.');
   }
  }catch(error){if(at!==generation)return;busy=false;reading=false;status('Number reader stopped. Close and reopen the camera to retry.');return;}
  timer=setTimeout(()=>scanFrame(at),180);
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)close();});window.addEventListener('pagehide',close);
 return {close};
}
