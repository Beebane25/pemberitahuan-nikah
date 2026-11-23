(() => {
  const status=document.getElementById('wishStatus'), list=document.getElementById('wishList'), form=document.getElementById('wishForm'), send=document.getElementById('wishSend');
  if(!window.supabase){status.textContent='Buku tamu belum terhubung. Muat ulang halaman untuk mencoba lagi.';send.disabled=true;return;}
  const db=window.supabase.createClient('https://vzfoxgxpifbypccpcacn.supabase.co','sb_publishable_b99-gKJgxTZDU9Hm1d55Xg_mDH7ra6g',{auth:{persistSession:false,autoRefreshToken:false}});
  let loading=false, again=false;
  async function load(){
    if(loading){again=true;return;} loading=true;
    try{
      const {data,error}=await db.from('wedding_wishes').select('id,name,message,created_at').order('created_at',{ascending:false}).limit(100);
      if(error) throw error;
      list.replaceChildren();
      for(const row of data){
        const article=document.createElement('article');article.className='wish-entry';
        const name=document.createElement('strong');name.textContent=row.name;
        const message=document.createElement('p');message.textContent=row.message;
        const time=document.createElement('time');time.dateTime=row.created_at;time.textContent=new Date(row.created_at).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'});
        article.append(name,message,time);list.append(article);
      }
      status.textContent=data.length?'Menampilkan '+data.length+' ucapan terbaru.':'Belum ada ucapan. Jadilah yang pertama memberi doa ♡';
    }catch{status.textContent='Ucapan belum dapat dimuat. Tekan Muat ulang ucapan untuk mencoba kembali.';}
    finally{loading=false;if(again){again=false;load();}}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(send.disabled)return;
    const name=document.getElementById('wishName').value.trim(),message=document.getElementById('wishMessage').value.trim();
    if(name.length<2||message.length<3){status.textContent='Isi nama minimal 2 karakter dan ucapan minimal 3 karakter.';return;}
    send.disabled=true;status.textContent='Mengirim ucapan…';
    try{
      const token=form.querySelector('[name="cf-turnstile-response"]')?.value;
      if(!token)throw new Error('Selesaikan verifikasi keamanan terlebih dahulu.');
      const response=await fetch('/api/wishes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,message,token})});
      const result=await response.json();if(!response.ok)throw new Error(result.message||'Ucapan belum tersimpan.');
      form.reset();await load();status.textContent='Terima kasih, ucapan Anda sudah tersimpan ♡';
    }catch(error){status.textContent=error.message||'Ucapan belum tersimpan. Periksa koneksi lalu coba lagi.';}
    finally{send.disabled=false;if(window.turnstile)window.turnstile.reset();}
  });
  document.getElementById('wishRefresh').addEventListener('click',load);
  db.channel('public-wishes').on('postgres_changes',{event:'*',schema:'public',table:'wedding_wishes'},load).subscribe(state=>{if(state==='SUBSCRIBED')load();});
  // Reconcile on reconnect and periodically if websocket is unavailable.
  window.addEventListener('online',load);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
  setInterval(()=>{if(!document.hidden)load();},30000);
  load();
})();

// uji-auto-deploy: penanda sementara
