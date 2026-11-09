'use strict';
window.SEPS_AUTH = (() => {
 const client=window.sepsClient;
 const status=document.getElementById('auth-status');
 function message(text){if(status)status.textContent=text;}
 const callbackUrl=()=>new URL('auth.html',window.location.href).href;
 async function membership(){
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user)throw new Error('Please sign in again.');
  const {data,error:profileError}=await client.from('seps_staff').select('user_id,email,role,active').eq('user_id',user.id).maybeSingle();
  if(profileError)throw new Error('Staff database is not ready. Ask your administrator to complete Supabase setup.');
  if(!data?.active)throw new Error('Your staff access is not active. Contact your administrator.');
  return data;
 }
 async function signOut(){
  // Supabase may be offline: always clear this device's session, and never leave records visible.
  window.dispatchEvent(new CustomEvent('seps:locked'));
  const {error}=await client.auth.signOut({scope:'local'});
  if(error){message('Records hidden. Sign-out could not complete; reconnect and try again.');return false;}
  message('Signed out.');return true;
 }
 document.getElementById('login-form')?.addEventListener('submit',async event=>{
  event.preventDefault();const button=document.getElementById('enter');button.disabled=true;message('Signing in…');
  try{
   const {error}=await client.auth.signInWithPassword({email:document.getElementById('email').value.trim(),password:document.getElementById('password').value});
   if(error)throw error;
   const profile=await membership();document.getElementById('password').value='';
   window.dispatchEvent(new CustomEvent('seps:authenticated',{detail:profile}));
  }catch(error){message(error.message);window.dispatchEvent(new CustomEvent('seps:locked'));}
  finally{button.disabled=false;}
 });
 document.getElementById('forgot')?.addEventListener('click',async()=>{
  const email=document.getElementById('email');if(!email.value.trim()||!email.checkValidity()){message('Enter your work email above first.');email.focus();return;}
  const button=document.getElementById('forgot');button.disabled=true;
  try{const {error}=await client.auth.resetPasswordForEmail(email.value.trim(),{redirectTo:callbackUrl()});if(error)throw error;message('If that address has an account, a password reset link will arrive shortly.');}
  catch(error){message(error.message);}finally{button.disabled=false;}
 });
 return {client,membership,signOut,message,callbackUrl};
})();
