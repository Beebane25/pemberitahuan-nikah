import {mkdirSync,copyFileSync,rmSync} from 'node:fs';
rmSync('public',{recursive:true,force:true});mkdirSync('public');
for(const file of ['index.html','guestbook.js','cover depan buku.jpg','foto favorit.jpg','profil cewek.jpg','profil cowok.jpg','payung teduh - akad.mp3'])copyFileSync(file,'public/'+file);
