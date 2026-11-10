'use strict';
// Request IDs keep retries from recording a package twice. No weak-random fallback.
globalThis.sepsRequestId = function sepsRequestId() {
 const source=globalThis.crypto;
 if(typeof source?.randomUUID==='function')return source.randomUUID();
 if(typeof source?.getRandomValues!=='function')throw new Error('Secure request IDs are unavailable. Open the HTTPS staff portal in an up-to-date browser.');
 const bytes=new Uint8Array(16);source.getRandomValues(bytes);
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
};
