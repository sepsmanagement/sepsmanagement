'use strict';
(() => {
 const config=window.SEPS_CONFIG;
 if(!config || !window.supabase) throw new Error('Sign-in could not load. Reload this page.');
 // Remove sessions saved by earlier portal versions; leave other website data untouched.
 for(const key of ['seps-staff-auth','seps-staff-auth-user']){try{window.localStorage?.removeItem(key);}catch{}}
 window.sepsClient=window.supabase.createClient(config.url,config.publishableKey,{
  auth:{persistSession:false,autoRefreshToken:true,detectSessionInUrl:false,flowType:'implicit',storageKey:'seps-staff-memory-auth'},
 });
})();
