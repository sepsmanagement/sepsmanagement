'use strict';
// Postgres Changes obey the tables' SELECT privileges and row-level security.
// Notifications trigger authoritative reads; clients never increment shared totals locally.
globalThis.createSepsLiveSync = function createSepsLiveSync({client,isActive,refresh,onConnection,onError}) {
 let channel=null,timer=null,running=false,dirty=false,active=false,generation=0;
 function requestRefresh(delay=150){
  if(!active||!isActive())return;
  dirty=true;if(timer!==null||running)return;
  const version=generation;
  timer=setTimeout(async()=>{
   timer=null;if(!active||version!==generation||!isActive())return;
   running=true;dirty=false;
   try{await refresh();}catch(error){if(active&&version===generation)onError(error);}
   finally{if(active&&version===generation){running=false;if(dirty)requestRefresh();}}
  },delay);
 }
 function stop(){
  generation++;active=false;dirty=false;running=false;
  if(timer!==null){clearTimeout(timer);timer=null;}
  const old=channel;channel=null;
  if(old){try{Promise.resolve(client.removeChannel(old)).catch(()=>{});}catch{}}
  onConnection(false);
 }
 function start(){
  stop();active=true;const version=generation;
  if(typeof client.channel!=='function')return;
  const changed=()=>{if(active&&version===generation)requestRefresh();};
  try{
   channel=client.channel('seps-records-'+version)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'seps_scan_events'},changed)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'seps_sessions'},changed)
    .on('postgres_changes',{event:'*',schema:'public',table:'seps_staff'},changed);
   channel.subscribe(status=>{
    if(!active||version!==generation)return;
    if(status==='SUBSCRIBED'){onConnection(true);requestRefresh(0);}
    else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){onConnection(false);}
   });
  }catch(error){onConnection(false);onError(error);}
 }
 return {start,stop,requestRefresh};
};
