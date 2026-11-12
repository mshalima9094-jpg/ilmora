/* ILMORA — নতুন সবুজ UI (ui.js)
   ড্যাশবোর্ডের নকশা, নিচের নেভিগেশন, সাইডবারের আইকন ও লোগো এখানে। অ্যাপের হিসাব/ডেটার কোড অপরিবর্তিত। */
(()=>{
const L=(d,x='')=>`<svg class="i" viewBox="0 0 24 24" ${x} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

/* পাতা অনুযায়ী লাইন-আইকন (সাইডবার ও নিচের বার) */
const NI={
 sa:L('<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
 dash:L('<path d="M3 11.5L12 4l9 7.5"/><path d="M5.5 10v9.5h4.5v-5.5h4v5.5h4.5V10"/>'),
 inst:L('<path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M10 21v-5h4v5"/><path d="M12 5V2"/>'),
 students:L('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.6 2.7 3 6 3s6-1.4 6-3v-4.5"/><path d="M22 9v5"/>'),
 teachers:L('<rect x="3" y="3.5" width="18" height="11" rx="2"/><path d="M8 19.5l4-5 4 5"/><circle cx="12" cy="9" r="1.8"/>'),
 tatt:L('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M9 15l2 2 4-4"/>'),
 att:L('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
 exams:L('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h5"/>'),
 fees:L('<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>'),
 ie:L('<circle cx="12" cy="12" r="9"/><path d="M14.5 8.8c-.6-.8-1.5-1.1-2.5-1.1-1.5 0-2.5.8-2.5 1.9 0 2.7 5.2 1.4 5.2 4.1 0 1.2-1.1 2-2.7 2-1.1 0-2.1-.4-2.7-1.2M12 6v1.7M12 16.4V18"/>'),
 canteen:L('<path d="M7 3v8a2 2 0 002 2v8M11 3v6a2 2 0 01-2 2M5 3v6a2 2 0 002 2"/><path d="M17 21V3c-2.5 1.5-3.5 4.5-3.5 8H17"/>'),
 report:L('<path d="M5 20V11M12 20V4M19 20v-6"/>'),
 routine:L('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M5 3.5L2.5 6M19 3.5L21.5 6"/>'),
 notices:L('<path d="M4 10v4a1 1 0 001 1h2l7 4V5L7 9H5a1 1 0 00-1 1z"/><path d="M18 9c1.2 1 1.2 5 0 6"/>'),
 users:L('<circle cx="9" cy="8" r="3.3"/><path d="M2.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2"/><path d="M16 5a3.3 3.3 0 010 6.2M18 14c2 .7 3.5 2.6 3.5 5.5"/>'),
 setup:L('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>'),
 bell:L('<path d="M6 16.5V11a6 6 0 0112 0v5.5l1.8 2.2H4.2z"/><path d="M10 21a2.2 2.2 0 004 0"/>'),
 menu:L('<path d="M4 7h16M4 12h16M4 17h16"/>',''),
 arrow:L('<path d="M5 12h14M13 6l6 6-6 6"/>','stroke-width="2.6"'),
 pin:L('<path d="M12 21s7-6.2 7-11.2A7 7 0 005 9.8C5 14.8 12 21 12 21z"/><circle cx="12" cy="10" r="2.6" fill="currentColor"/>'),
 phone:L('<path d="M5 3.5h3.5l1.8 4.5-2.2 1.4a11 11 0 005.5 5.5L15 12.700l4.5 1.800V18a2 2 0 01-2 2C9.700 20 4 14.300 4 6.500a2 2 0 011-3z"/>'),
 cal:L('<rect x="3.5" y="5" width="17" height="15.500" rx="2.500"/><path d="M3.500 10h17M8 3v4M16 3v4"/><path d="M8 14h2M12 14h2M16 14h.01M8 17.500h2M12 17.500h2"/>')
};

/* রঙিন কার্ড-আইকন (SVG, defs নিচে #uiDefs) */
const IC={
 stu:`<i class="pic stu"></i>`,
 tch:`<i class="pic tch"></i>`,
 coin:`<svg viewBox="0 0 64 64" aria-hidden="true"><g stroke="#8a5a00" stroke-width="1.600"><path d="M8 44v7c0 3 8 5.500 18 5.500s18-2.500 18-5.500v-7z" fill="url(#gY)"/><ellipse cx="26" cy="44" rx="18" ry="5.500" fill="url(#gY2)"/><path d="M8 35v7c0 3 8 5.500 18 5.500s18-2.500 18-5.500v-7z" fill="url(#gY)" transform="translate(0 -3)"/><ellipse cx="26" cy="32" rx="18" ry="5.500" fill="url(#gY2)"/><path d="M30 24v7c0 3 8 5.500 15 5.500s15-2.500 15-5.500v-7z" fill="url(#gY)"/><ellipse cx="45" cy="24" rx="15" ry="5" fill="url(#gY2)"/></g></svg>`,
 wal:`<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 20l36-9 4 9z" fill="#c99a1c" stroke="#7a5600" stroke-width="1.600" stroke-linejoin="round"/><rect x="6" y="18" width="50" height="34" rx="6" fill="url(#gG)" stroke="#044d22" stroke-width="2"/><path d="M6 26h50" stroke="#065a2a" stroke-width="2"/><rect x="38" y="31" width="20" height="14" rx="5" fill="#0b7a38" stroke="#044d22" stroke-width="2"/><circle cx="46" cy="38" r="3" fill="url(#gY2)" stroke="#8a5a00" stroke-width="1.200"/></svg>`,
 hand:`<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="34" cy="17" r="12" fill="url(#gY2)" stroke="#8a5a00" stroke-width="2"/><text x="34" y="23" text-anchor="middle" font-size="16" font-weight="800" fill="#7a5200" font-family="Arial,sans-serif">$</text><path d="M3 44l9-6 14 2 12 2c3 .5 3 5 0 5.500H27l15 1 14-9c3-2 6 1 3.500 3.500L44 58c-3 2-7 2.500-11 1.500L16 56 3 56z" fill="url(#gG)" stroke="#044d22" stroke-width="2" stroke-linejoin="round"/></svg>`,
 chart:`<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="38" width="12" height="20" rx="2" fill="url(#gG)"/><rect x="22" y="30" width="12" height="28" rx="2" fill="url(#gG)"/><rect x="38" y="22" width="12" height="36" rx="2" fill="url(#gG)"/><path d="M6 30L22 18l10 7 20-17" fill="none" stroke="#0b7a38" stroke-width="4.500" stroke-linecap="round" stroke-linejoin="round"/><path d="M42 7h12v12" fill="none" stroke="#0b7a38" stroke-width="4.500" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 quran:`<i class="pic qr"></i>`
};

/* অদৃশ্য গ্রেডিয়েন্ট-সংজ্ঞা, একবারই বসে */
if(!document.getElementById('uiDefs'))document.body.insertAdjacentHTML('afterbegin',`<svg id="uiDefs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<linearGradient id="gG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--pl)"/><stop offset="1" style="stop-color:var(--pm)"/></linearGradient>
<linearGradient id="gY" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6d56a"/><stop offset="1" stop-color="#d49a12"/></linearGradient>
<linearGradient id="gY2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset="1" stop-color="#e2a916"/></linearGradient></defs></svg>`);

/* উপরের বারের ☰ ও 🔔 */
const top=document.querySelector('.top');
if(top&&!top.querySelector('.bell')){
 const mb=top.querySelector('button');if(mb){mb.setAttribute('aria-label','মেনু');mb.innerHTML=NI.menu}
 const bl=document.createElement('button');bl.className='bell';bl.setAttribute('aria-label','নোটিশ');bl.innerHTML=NI.bell;bl.onclick=()=>{try{nav('notices')}catch(e){}};
 top.insertBefore(bl,document.getElementById('net'));
}

/* ---------- ড্যাশবোর্ড (প্রতিষ্ঠান-প্রধান) ---------- */
const hand=n=>String(n).replace('ফান্ড','ফান্ড');
PG.dash=function(){
 const td=today(),mo=td.slice(0,7),yr=td.slice(0,4),f=(ty,p)=>sum(S.tx.filter(t=>t.type==ty&&t.date.startsWith(p)));
 const mv=(i,ty)=>f(ty,yr+'-'+String(i+1).padStart(2,'0')),mx=Math.max(1,...Array.from({length:12},(_,i)=>Math.max(mv(i,'in'),mv(i,'out'))));
 const bars=Array.from({length:12},(_,i)=>`<div class="bc"><i class="a" style="height:${mv(i,'in')/mx*100}%"></i><i class="b" style="height:${mv(i,'out')/mx*100}%"></i></div>`).join('');
 const FPL={td:'আজ',mo:'চলতি মাস',yr:'চলতি বছর',all:'সব সময়'},okd=d=>dp=='td'?d==td:dp=='mo'?d.startsWith(mo):dp=='yr'?d.startsWith(yr):true,cev=cEv().filter(e=>okd(e.d)),
 fr=[...FU.map(n=>{const a=S.tx.filter(t=>okd(t.date)&&(t.fund||FU[0])==n);return[n,sum(a.filter(t=>t.type=='in')),sum(a.filter(t=>t.type=='out'))]}),['ক্যান্টিন ফান্ড',sm(cev.filter(e=>['cs','cc'].includes(e.g)),e=>e.a),sm(cev.filter(e=>['ex','bc','sp','rf'].includes(e.g)),e=>e.a)]];
 const inf=S.info||{},ed=canW('inst');
 const logo=inf.logo?`<img src="${esc(inf.logo)}" alt="">`:IC.quran;
 const img=inf.bn?`<img src="${esc(inf.bn)}" alt="${esc(S.inst)}">`:`<${ed?'button type="button" onclick="nav(\'inst\')"':'div'} class="dh-ph">${ed?'<small>ছবি যোগ করুন: প্রতিষ্ঠান তথ্য → প্রতিষ্ঠানের ছবি</small>':''}</${ed?'button':'div'}>`;
 const fix=`<div class="dh-fix"><div class="dh-scene" role="img" aria-label="মাদরাসা"></div><div class="dh-pill"><b>${esc(S.inst)}</b></div></div>`;
 const hdr=`<section class="dh" aria-label="প্রতিষ্ঠান">
<div class="dh-info"><div class="tl"><div class="dh-logo">${logo}</div><h2 class="dh-name">${esc(S.inst)}</h2></div>
<div class="dh-ct">${inf.addr?`<span>${NI.pin}<b>${esc(String(inf.addr).replace(/\s+/g,' '))}</b></span>`:''}${inf.ph?`<span>${NI.phone}<b>মোবাইল ${esc(inf.ph)}</b></span>`:''}</div></div>
<div class="dh-img">${img}</div></section>`;
 const sc=(l,v,c,ic,x='')=>`<div class="sc ${x}"><i class="ic${ic=='stu'?' wide':''}">${IC[ic]}</i><div class="sv"><small>${l}</small><b class="${c}">${v}</b></div></div>`;
 const plus=(fn,t)=>`<button class="pl2" type="button" aria-label="${t}" onclick="${fn}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>`;
 const scp=(l,v,ic,id,items,lab,go)=>{const inc=ic=='stu',pb=`<button class="go" aria-label="${lab}" onclick="${go||`pmt(event,'${jx(id)}')`}">${inc?'':'<i class="mn">−</i>'}<span>${lab}</span>${inc?NI.arrow:''}</button>`,pl=inc?plus(`pmt(event,'${jx(id)}')`,'আয়'):plus("event.stopPropagation();go2('out')",'ব্যয়');return `<div class="sc big"><i class="ic${ic=='stu'?' wide':''}">${IC[ic]}</i><div class="sv"><small>${l}</small><b>${v}</b></div><div class="bt">${inc?pb+pl:pl+pb}</div><div class="pm" id="${id}" hidden>${items}</div></div>`};
 const cards=`<div class="sg">${scp('মোট শিক্ষার্থী',bn(S.students.length)+' জন','stu','pm1',`<button onclick="nav('fees')">💳 ফি ও বেতন</button><button onclick="go2('in','দান')">📥 আয় (দান)</button>`,'আয়')}${scp('মোট শিক্ষক',bn(S.teachers.length)+' জন','tch','pm2',`<button onclick="go2('out')">📤 ব্যয়</button>`,'ব্যয়',"event.stopPropagation();go2('out')")}${sc('আজকের আয়',tk(f('in',td)),'g','coin')}${sc('আজকের ব্যয়',tk(f('out',td)),'rd','wal')}${sc('চলতি মাসের আয়',tk(f('in',mo)),'g','hand')}${sc('চলতি মাসের ব্যয়',tk(f('out',mo)),'rd','hand')}${sc('চলতি বছরের আয়',tk(f('in',yr)),'g','chart')}${sc('চলতি বছরের ব্যয়',tk(f('out',yr)),'rd','chart')}${sc('সর্বমোট আয়',tk(f('in','')),'g','coin','tot')}${sc('সর্বমোট ব্যয়',tk(f('out','')),'rd','wal','tot')}</div>`;
 const fund=`<div class="ft"><div class="fh">${NI.cal}<b>ফান্ডভিত্তিক আয়-ব্যয়</b><select aria-label="সময়" onchange="dp=this.value;render()">${Object.entries(FPL).map(([k,v])=>`<option value="${k}" ${k==dp?'selected':''}>${v}</option>`).join('')}</select></div><div class="fw"><table class="ftb"><tr><th>ফান্ড</th><th>আয়</th><th>ব্যয়</th><th>হিসাব</th></tr>${fr.map(r=>`<tr><td>${esc(hand(r[0]))}</td><td class="g">${tk(r2(r[1]))}</td><td class="${r[2]?'rd':''}">${r[2]?tk(r2(r[2])):bn(0)}</td><td class="bl">${tk(r2(r[1]-r[2]))}</td></tr>`).join('')}<tr class="tt"><td>মোট</td><td class="g">${tk(r2(sm(fr,r=>r[1])))}</td><td class="rd">${tk(r2(sm(fr,r=>r[2])))}</td><td class="bl">${tk(r2(sm(fr,r=>r[1]-r[2])))}</td></tr></table></div><small class="fn">ক্যান্টিন ফান্ড ক্যান্টিন সেকশন থেকে নিজে হিসাব হয় (নগদ বিক্রি + বাকি আদায় − খরচ, নগদ ক্রয়, বাকি পরিশোধ, রিফান্ড)</small></div>`;
 return `${fix}${hdr}${cards}${fund}<div class="sg tot2">${sc('সর্বমোট আয়',tk(f('in','')),'g','coin')}${sc('সর্বমোট ব্যয়',tk(f('out','')),'rd','wal')}</div>
<div class="card"><b>বছরের নিট স্থিতি (${bd(yr)})</b><div style="font-size:24px;font-weight:700">${tk(f('in',yr)-f('out',yr))}</div></div>
<div class="card"><b>মাসভিত্তিক আয় (সবুজ) ও ব্যয় (লাল)</b><div class="bars" style="margin-top:10px">${bars}</div><div class="lg"><span>জানু</span><span>ডিসে</span></div></div>
<div class="card"><b>সাম্প্রতিক লেনদেন</b>${txl(list(()=>1).slice(0,5))}</div>`;
};

/* ---------- প্রতিটি রেন্ডারের পর: সাইডবার, নিচের বার, বেল ---------- */
const BN=[['dash','হোম'],['students','শিক্ষার্থী'],['report','রিপোর্ট'],['setup','সেটিংস']];
function uiAfter(){
 const side=document.getElementById('side');if(!side)return;
 const h=side.querySelector('h3');
 if(h&&!h.classList.contains('sh')){h.classList.add('sh');const inf=(typeof S!=='undefined'&&S.info)||{};h.insertAdjacentHTML('afterbegin',`<div class="sl">${inf.logo?`<img src="${esc(inf.logo)}" alt="">`:IC.quran}</div>`)}
 side.querySelectorAll('a[href^="#"]').forEach(a=>{const id=a.getAttribute('href').slice(1),s=a.querySelector('span');if(s&&NI[id]&&!s.dataset.ui){s.innerHTML=NI[id];s.dataset.ui=1}});
 let nb=document.getElementById('bnav');
 if(!nb){nb=document.createElement('nav');nb.id='bnav';nb.setAttribute('aria-label','প্রধান মেনু');document.body.appendChild(nb)}
 const logged=!!side.innerHTML.trim();
 const items=BN.filter(x=>{try{return canV(x[0])}catch(e){return false}});
 nb.classList.toggle('on',logged&&items.length>1);
 nb.innerHTML=items.map((x,i)=>`${i&&i<items.length?'':''}<button type="button" class="${page==x[0]?'ft2b cur':''}" onclick="nav('${x[0]}')" aria-label="${x[1]}">${NI[x[0]]}<span>${x[1]}</span></button>`).join('');
 document.body.classList.toggle('on-dash',page=='dash'&&logged);
 const tc=document.querySelector('meta[name=theme-color]');if(tc)tc.content=getComputedStyle(document.documentElement).getPropertyValue('--p').trim()||'#0a7a38';
 const tp=document.querySelector('.top');if(tp)document.documentElement.style.setProperty('--toph',tp.offsetHeight+'px');
 fitName();
 const bl=document.querySelector('.top .bell');if(bl)bl.classList.toggle('dot',!!(S.notices&&S.notices.length)&&logged);
}
window.uiAdd=function(p){nav(p);requestAnimationFrame(()=>{const d=document.querySelector('main details');if(d){d.open=true;d.scrollIntoView({block:'center',behavior:'smooth'})}})};
function fitName(){const b=document.querySelector('.dh-pill b');if(!b)return;b.style.fontSize='';let s=parseFloat(getComputedStyle(b).fontSize);while(b.scrollWidth>b.clientWidth+1&&s>10){s-=.5;b.style.fontSize=s+'px'}}
addEventListener('resize',()=>{try{fitName()}catch(e){}});
const R0=render;
render=function(){R0.apply(this,arguments);try{uiAfter()}catch(e){console.error(e)}};
try{uiAfter()}catch(e){}
})();
