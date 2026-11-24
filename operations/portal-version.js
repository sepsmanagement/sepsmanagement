/* Check cached HTML on entry and when restored from the browser back/forward cache. */
(()=>{
 const version='automatic-17';let checking=false;
 async function check(){
  if(checking)return;checking=true;
  try{
   const response=await fetch(new URL('portal-version.json',location.href),{cache:'no-store'});
   if(!response.ok)return;
   const latest=(await response.json()).version;
   if(typeof latest!=='string'||latest===version||!/^[a-z0-9-]+$/.test(latest))return;
   const url=new URL(location.href);
   if(url.searchParams.get('release')===latest)return;
   url.searchParams.set('release',latest);location.replace(url.href);
  }catch{/* An unavailable update check must not interrupt staff access. */}
  finally{checking=false;}
 }
 void check();window.addEventListener('pageshow',event=>{if(event.persisted)void check();});
})();
