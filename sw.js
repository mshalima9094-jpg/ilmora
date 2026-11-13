const C='ilmora-v50';
const A=['./','index.html','saas.js','ui.css','ui.js','manifest.json','icon.svg','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png','designs/adm_seal.png','designs/adm1.png','designs/adm2.png','designs/adm3.png','designs/adm4.png','designs/adm5.png','fonts/SolaimanLipi.ttf','fonts/nf1.woff','fonts/nf2.woff','fonts/nf3.woff','fonts/nf4.woff','fonts/nf5.woff','fonts/nf6.woff','fonts/nf7.woff','fonts/nf8.woff','fonts/nf9.woff','fonts/nf10.woff','fonts/nf11.woff','fonts/nf12.woff','fonts/nf13.woff'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>Promise.all(A.map(u=>c.add(new Request(u,{cache:'reload'})).catch(()=>0)))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!=C).map(x=>caches.delete(x)))).then(()=>clients.claim())));
/* আগে ক্যাশ (সাথে সাথে খোলে, অফলাইনেও চলে), পেছনে নেটওয়ার্ক থেকে নতুন কপি এনে ক্যাশ হালনাগাদ */
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!='GET')return;
if(u.origin!=location.origin&&!/^(fonts\.|cdnjs\.cloudflare\.com$)/.test(u.hostname))return;
const nav=r.mode=='navigate',root=u.pathname==new URL('./',location).pathname,key=nav&&root?'./':r;
e.respondWith(caches.match(r,{ignoreSearch:nav}).then(hit=>{
const net=fetch(r,u.origin==location.origin?{cache:'no-cache'}:undefined).then(x=>{if(x.ok||x.type=='opaque'){const k=x.clone();caches.open(C).then(c=>c.put(key,k))}return x}).catch(()=>null);
if(hit){e.waitUntil(net);return hit}
return net.then(x=>x||caches.match('./')||new Response('',{status:504}))}))});
