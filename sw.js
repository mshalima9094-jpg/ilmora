const C='ilmora-v31';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','saas.js','manifest.json','icon.svg','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png','designs/adm_border.jpg','designs/adm_seal.png','designs/d1.png','designs/d2.png','designs/d3.png'])).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!=C).map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!='GET')return;if(u.origin!=location.origin&&!/^fonts\./.test(u.hostname))return;
e.respondWith(fetch(r).then(x=>{if(x.ok||x.type=='opaque')caches.open(C).then(c=>c.put(r,x.clone()));return x}).catch(()=>caches.match(r)))});
