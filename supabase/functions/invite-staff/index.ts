// Deploy with: supabase functions deploy invite-staff --no-verify-jwt
// Publishable-key sessions are validated below with auth.getUser(token).
import { createClient } from 'npm:@supabase/supabase-js@2.49.8';

const siteUrl = Deno.env.get('SCANNER_SITE_URL') || 'https://sepsmanagement.com';
const extraOrigins = (Deno.env.get('SCANNER_ALLOWED_ORIGINS') || '').split(',').filter(Boolean);
const allowedOrigins = new Set([siteUrl, 'https://sepsmanagement.com', 'https://www.sepsmanagement.com',
 'https://seps-scanner-review.glossyhatch.chatgpt.site', ...extraOrigins]);
function respond(request: Request, status: number, body: unknown) {
 const origin = request.headers.get('Origin') || '';
 return new Response(JSON.stringify(body), {status, headers: {
  'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary':'Origin',
  ...(allowedOrigins.has(origin) ? {'Access-Control-Allow-Origin': origin} : {}),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
 }});
}
Deno.serve(async (request: Request) => {
 const origin=request.headers.get('Origin');
 if(origin && !allowedOrigins.has(origin)) return respond(request,403,{error:'Origin is not allowed'});
 if(request.method==='OPTIONS') return respond(request,200,{});
 if(request.method!=='POST') return respond(request,405,{error:'Use POST'});
 const token=request.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
 if(!token) return respond(request,401,{error:'Sign in first'});
 const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 const supabaseUrl=Deno.env.get('SUPABASE_URL');
 if(!serviceKey || !supabaseUrl) return respond(request,503,{error:'Invitation service is not configured'});
 const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:identity,error:authError}=await admin.auth.getUser(token);
 if(authError || !identity.user) return respond(request,401,{error:'Session expired. Sign in again.'});
 const {data:staff,error:staffError}=await admin.from('seps_staff').select('role,active').eq('user_id',identity.user.id).maybeSingle();
 if(staffError || !staff?.active || staff.role!=='admin') return respond(request,403,{error:'Administrator access required'});
 let email: string;
 try {const body=await request.json();email=String(body.email||'').trim().toLowerCase();}
 catch {return respond(request,400,{error:'Invalid request'});}
 if(email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond(request,400,{error:'Enter a valid staff email'});
 // Never accept role, redirect URL, membership ID, or service credentials from the browser.
 const appUrl = new URL('/operations/auth.html', origin && allowedOrigins.has(origin) ? origin : siteUrl).href;
 const {data,error}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo:appUrl});
 if(error) return respond(request,400,{error:error.message});
 // The auth.users invitation trigger creates an ordinary staff membership.
 return respond(request,200,{email:data.user?.email||email,message:'Invitation sent. Staff access is active after the invitation is accepted.'});
});
