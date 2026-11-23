const reply=(status,message)=>Response.json({message},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const ALLOWED_HOST=/^(?:pemberitahuan-nikah\.zulfajrisurya30\.workers\.dev|pemberitahuan-nikah\.pages\.dev|[a-z0-9-]+\.pemberitahuan-nikah\.pages\.dev)$/;
const isAllowed=h=>ALLOWED_HOST.test(h||'');
const hostOf=v=>{try{return new URL(v).host}catch{return ''}};
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname!='/api/wishes') return env.ASSETS.fetch(request);
 if(request.method!=='POST')return reply(405,'Metode tidak diizinkan.');
 if(!isAllowed(hostOf(request.headers.get('Origin')||'')))return reply(403,'Asal permintaan tidak diizinkan.');
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY||!env.TURNSTILE_SECRET_KEY)return reply(503,'Konfigurasi layanan belum lengkap.');
 try{
 if(!request.headers.get('Content-Type')?.includes('application/json'))return reply(415,'Gunakan JSON.');
 const reader=request.body?.getReader();if(!reader)return reply(400,'Data kosong.');let size=0,chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();return reply(413,'Data terlalu besar.');}chunks.push(value);}
 const all=new Uint8Array(size);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length;}
 let body;try{body=JSON.parse(new TextDecoder().decode(all));}catch{return reply(400,'Data tidak valid.');}
 const {name,message,token}=body||{};
 if(typeof name!=='string'||typeof message!=='string'||typeof token!=='string'||token.length>2048||!token||name.trim().length<2||name.trim().length>60||message.trim().length<3||message.trim().length>1000)return reply(400,'Periksa nama, ucapan, dan verifikasi keamanan.');
 const ip=request.headers.get('CF-Connecting-IP');if(!ip)return reply(403,'Koneksi tidak valid.');
 const check=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token,remoteip:ip}),signal:AbortSignal.timeout(10000)});
 const verified=await check.json();
 if(!check.ok||!verified.success||!isAllowed(verified.hostname)||verified.action!=='wedding_wish')return reply(403,'Verifikasi keamanan gagal. Silakan coba kembali.');
 const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
 const ipHash=await hash(env.TURNSTILE_SECRET_KEY+'|'+ip);
 const contentHash=await hash(name.trim().toLowerCase()+'|'+message.trim().toLowerCase());
 const res=await fetch(env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/rpc/submit_wedding_wish',{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_name:name.trim(),p_message:message.trim(),p_ip_hash:ipHash,p_content_hash:contentHash}),signal:AbortSignal.timeout(10000)});
 if(!res.ok){const text=await res.text();if(text.includes('RATE_LIMIT'))return reply(429,'Tunggu 60 detik. Maksimal 5 ucapan per jam per koneksi.');if(text.includes('DUPLICATE'))return reply(409,'Ucapan yang sama sudah terkirim.');return reply(503,'Ucapan belum tersimpan. Silakan coba lagi.');}
 return reply(201,'Terima kasih, ucapan Anda sudah tersimpan ♡');
 }catch{return reply(503,'Layanan sedang tidak tersedia. Silakan coba lagi.');}
}};
