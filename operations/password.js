'use strict';
(async()=>{
 const client=window.sepsClient,message=document.getElementById('message'),form=document.getElementById('password-form');
 const url=new URL(window.location.href),hash=new URLSearchParams(url.hash.slice(1));
 // Read once, then remove credentials from the address bar before loading anything else.
 window.history.replaceState(null,'',window.location.pathname);
 try{
  const linkError=hash.get('error_description')||url.searchParams.get('error_description');if(linkError)throw new Error(linkError);
  let error;
  if(url.searchParams.has('code'))({error}=await client.auth.exchangeCodeForSession(url.searchParams.get('code')));
  else if(url.searchParams.has('token_hash')){
   const type=url.searchParams.get('type');if(!['invite','recovery'].includes(type))throw new Error('Unsupported invitation link.');
   ({error}=await client.auth.verifyOtp({token_hash:url.searchParams.get('token_hash'),type}));
  }else if(hash.has('access_token')&&hash.has('refresh_token')){
   ({error}=await client.auth.setSession({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token')}));
  }
  if(error)throw error;
  const {data:{user},error:userError}=await client.auth.getUser();if(userError||!user)throw new Error('This link is invalid or expired. Ask for another invitation or password reset.');
  const {data:profile,error:profileError}=await client.from('seps_staff').select('active').eq('user_id',user.id).maybeSingle();
  if(profileError||!profile?.active)throw new Error('Your staff access is not active yet. Ask your administrator to complete account setup.');
  message.textContent='Set a password for '+user.email+'.';form.hidden=false;
 }catch(error){message.textContent=error.message;}
 form.addEventListener('submit',async event=>{
  event.preventDefault();const password=document.getElementById('new-password').value,confirm=document.getElementById('confirm-password').value;
  if(password.length<12||password!==confirm){message.textContent='Use at least 12 characters and enter the same password twice.';return;}
  const button=document.getElementById('save-password');button.disabled=true;
  try{const {error}=await client.auth.updateUser({password});if(error)throw error;message.textContent='Password saved. Opening your workspace…';window.location.replace('./');}
  catch(error){message.textContent=error.message;button.disabled=false;}
 });
})();
