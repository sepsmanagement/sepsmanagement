'use strict';
(() => {
 const config=window.SEPS_CONFIG;
 if(!config || !window.supabase) throw new Error('Sign-in could not load. Reload this page.');
 window.sepsClient=window.supabase.createClient(config.url,config.publishableKey,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:'implicit',storageKey:'seps-staff-auth'},
 });
})();
