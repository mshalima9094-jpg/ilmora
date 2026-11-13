/* ILMORA SaaS লেয়ার — Firebase Authentication + Firestore (REST), মাল্টি-মাদরাসা, অফলাইন-ফার্স্ট
   Spark Plan-এ চলে: Cloud Functions বা Billing লাগে না।
   মূল অ্যাপের (index.html) গ্লোবাল ভ্যারিয়েবল ও ফাংশন ব্যবহার করে; index.html-এর শেষে লোড হয়। */
(function () {
'use strict';
const W = window;
const GMAIL_ONLY = true;                       // false করলে যেকোনো বৈধ ইমেইল চলবে
const emKey = s => String(s || '').trim().toLowerCase();
const emOk = e => GMAIL_ONLY ? /^[a-z0-9][a-z0-9._+-]{2,63}@gmail\.com$/.test(e) : /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(e);
const EMMSG = GMAIL_ONLY ? 'সঠিক Gmail ঠিকানা দিন (যেমন name@gmail.com)' : 'সঠিক ইমেইল ঠিকানা দিন';
const REGK = 'ilmora-reg';                      // নিবন্ধনের তথ্য (Gmail যাচাইয়ের পর মাদরাসা তৈরি হবে)
const CF_URL = '';                              // Cloudflare Worker-এর ঠিকানা (README দেখুন); ফাঁকা থাকলে ফাইল স্টোরেজ বন্ধ
const RC = { admin: 'অ্যাডমিন', accountant: 'হিসাবরক্ষক', teacher: 'শিক্ষক', student: 'শিক্ষার্থী' };
const RCI = { 'অ্যাডমিন': 'admin', 'হিসাবরক্ষক': 'accountant', 'শিক্ষক': 'teacher', 'শিক্ষার্থী': 'student' };
const RECC = ['students', 'teachers', 'tx', 'notices', 'exams', 'hifz', 'leaves', 'smsq', 'routine', 'examRt'];
const CNK = ['prod', 'sales', 'buys', 'exp', 'cust', 'led', 'cash', 'ret'];
const MONEYC = ['tx'].concat(CNK.map(k => 'cn.' + k));   // আর্থিক রেকর্ড: firestore.rules-এর isMoney(t) সীমার সাথে মিলিয়ে রাখা
const MAPK = ['att', 'tatt', 'tattT'];
const LOCALK = ['fs'];                          // ডিভাইসভিত্তিক সেটিং: সিঙ্ক হয় না
const UNS = ['notices', 'leaves', 'smsq'];      // নতুনটি আগে দেখানো হয় (unshift)
const CKEY = 'ilmora-ctx2', OFFL = 'ilmora-offl', MIGK = 'ilmora-mig';
const DAY = 864e8;                              // ১ দিন, মাইক্রোসেকেন্ডে

/* ---------- ছোট সহায়ক ---------- */
const jp = (s, d) => { try { const v = JSON.parse(s); return v == null ? d : v } catch (e) { return d } };
const ls = { g: k => { try { return localStorage.getItem(k) } catch (e) { return null } }, s: (k, v) => { try { localStorage.setItem(k, v); return true } catch (e) { return false } }, r: k => { try { localStorage.removeItem(k) } catch (e) { } } };
const hs = s => { let a = 0xdeadbeef, b = 0x41c6ce57; for (let i = 0, c; i < s.length; i++) { c = s.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677) } a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909); b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909); return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36) };
const AL = 'abcdefghjkmnpqrstuvwxyz23456789';
const rnd = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, x => AL[x % AL.length]).join('') };
const phKey = s => { let p = en(String(s || '')).replace(/\D/g, ''); if (/^8801\d{9}$/.test(p)) p = p.slice(2); return p };
const phOk = p => /^\d{6,15}$/.test(p);
const safeId = s => /^[\w\-]{1,60}$/.test(String(s));
const now = () => Date.now();
const ro = s => new Promise(r => setTimeout(r, s));

/* ---------- Firestore / Auth REST ---------- */
const FS = () => 'https://firestore.googleapis.com/v1/projects/' + CC.pid + '/databases/(default)/documents';
const IDT = 'https://identitytoolkit.googleapis.com/v1/accounts:';
const F = v => typeof v === 'string' ? { stringValue: v } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : v == null ? { nullValue: null } : Array.isArray(v) ? { arrayValue: { values: v.map(F) } } : { mapValue: { fields: toF(v) } };
const toF = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, F(v)]));
const U = f => f == null ? null : 'stringValue' in f ? f.stringValue : 'integerValue' in f ? Number(f.integerValue) : 'doubleValue' in f ? f.doubleValue : 'booleanValue' in f ? f.booleanValue : 'arrayValue' in f ? (f.arrayValue.values || []).map(U) : 'mapValue' in f ? fromF(f.mapValue.fields || {}) : null;
const fromF = fs => Object.fromEntries(Object.entries(fs || {}).map(([k, v]) => [k, U(v)]));
const dd = d => d ? Object.assign(fromF(d.fields), { _id: decodeURIComponent(d.name.split('/').pop()) }) : null;

async function fr(u, o) { const r = await fetch(u, o); const j = await r.json().catch(() => ({})); return { ok: r.ok, s: r.status, j } }
function ferr(r) { const e = (r.j && r.j.error) || {}; const x = new Error(e.status || e.message || ('HTTP ' + r.s)); x.http = r.s; x.fs = e.status || ''; x.msg = e.message || ''; return x }
async function api(method, path, body, qs) {
  const t = await token();
  const r = await fr(FS() + (path[0] === ':' ? path : '/' + path) + (qs || ''), { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined });
  if (r.s == 404) return null;
  if (!r.ok) throw ferr(r);
  return r.j;
}
const getDoc = async p => dd(await api('GET', p));
async function pubGet(p) { const r = await fr(FS() + '/' + p); if (r.s == 404) return null; if (!r.ok) throw ferr(r); return dd(r.j) }
const setDoc = (p, o, mask, qs) => api('PATCH', p, { fields: toF(o) }, (mask ? '?' + mask.map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&') : '') + (qs ? (mask ? '&' : '?') + qs : ''));
const createDoc = (p, o) => api('PATCH', p, { fields: toF(o) }, '?currentDocument.exists=false');
const delDoc = p => api('DELETE', p);
async function listDocs(path, max) {
  const out = []; let tok = '';
  do { const j = await api('GET', path, null, '?pageSize=300' + (tok ? '&pageToken=' + encodeURIComponent(tok) : '')); if (!j) break; (j.documents || []).forEach(d => out.push(dd(d))); tok = j.nextPageToken || ''; if (max && out.length >= max) break } while (tok);
  return out;
}
async function runQuery(parent, sq) { const j = await api('POST', parent + ':runQuery', { structuredQuery: sq }); return j || [] }
const docName = p => 'projects/' + CC.pid + '/databases/(default)/documents/' + p;
const commit = ws => api('POST', ':commit', { writes: ws });

async function rawSignUp(em, pw) {
  const r = await fr(IDT + 'signUp?key=' + CC.key, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em, password: pw, returnSecureToken: true }) });
  if (!r.ok) throw new Error((r.j.error && r.j.error.message) || 'HTTP ' + r.s);
  return { uid: r.j.localId, tok: r.j.idToken, rt: r.j.refreshToken };
}
async function rawSignIn(em, pw) {
  const r = await fr(IDT + 'signInWithPassword?key=' + CC.key, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em, password: pw, returnSecureToken: true }) });
  if (!r.ok) throw new Error((r.j.error && r.j.error.message) || 'HTTP ' + r.s);
  return { uid: r.j.localId, tok: r.j.idToken };
}
async function rawDelete(tok) { await fr(IDT + 'delete?key=' + CC.key, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: tok }) }) }
async function oob(type, o) {       // ইমেইল যাচাই / পাসওয়ার্ড রিসেটের মেইল পাঠানো (Firebase নিজেই পাঠায়)
  const r = await fr(IDT + 'sendOobCode?key=' + CC.key, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ requestType: type }, o)) });
  if (!r.ok) throw new Error((r.j.error && r.j.error.message) || 'HTTP ' + r.s);
}
async function lookupEv(tok) {      // ইমেইল যাচাই হয়েছে কি না
  const r = await fr(IDT + 'lookup?key=' + CC.key, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: tok }) });
  if (!r.ok) throw new Error((r.j.error && r.j.error.message) || 'HTTP ' + r.s);
  return !!((r.j.users || [])[0] || {}).emailVerified;
}
const isBad = x => /INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND|INVALID_EMAIL|MISSING_PASSWORD/.test(String(x && x.message));
const isNet = x => /Failed to fetch|NetworkError|Load failed|network/i.test(String(x && x.message));
const msgOf = x => { const m = String(x && x.message || x); return /TOO_MANY_ATTEMPTS/.test(m) ? 'অনেকবার ভুল চেষ্টা হয়েছে; কিছুক্ষণ পরে আবার চেষ্টা করুন' : /EMAIL_EXISTS/.test(m) ? 'এই Gmail দিয়ে আগেই অ্যাকাউন্ট আছে; লগইন করুন' : /INVALID_EMAIL/.test(m) ? 'ইমেইল ঠিকানা সঠিক নয়' : /WEAK_PASSWORD/.test(m) ? 'পাসওয়ার্ড দুর্বল' : isNet(x) ? 'ইন্টারনেট সংযোগ নেই' : /PERMISSION_DENIED|insufficient/i.test(m) ? 'অনুমতি নেই (Firestore Rules)' : /OPERATION_NOT_ALLOWED/.test(m) ? 'Firebase Console-এ Email/Password লগইন চালু করুন' : m };

/* ---------- সেশন / কনটেক্সট ---------- */
let CTX = null;     // {uid,em,ph,name,sa,tid,role,sid,mc,none,tn}
let TM = null;      // মাদরাসার তথ্য {id,name,st,plan,exp,own}
let PLANS = null;   // প্যাকেজ (ক্যাশ)
let MEM = null;     // সদস্য তালিকা (অ্যাডমিন)
let PORTAL = null;  // শিক্ষার্থী পোর্টালের ফলাফল
let SESSPW = '';    // শুধু মেমরিতে (পেজ রিলোডে মুছে যায়)
const kFor = () => !TN ? tKey('') : (CTX && CTX.role === 'student' && !CTX.sa) ? tKey(TN) + ':stu:' + CTX.uid : tKey(TN);
const ctxSave = () => { if (CTX) ls.s(CKEY, JSON.stringify({ CTX, TM })); else ls.r(CKEY) };
const staff = () => CTX && !CTX.none && (CTX.sa || ['admin', 'accountant', 'teacher'].includes(CTX.role));
const isExp = () => !!(TM && TM.exp > 0 && now() > TM.exp && !(CTX && CTX.sa));
const DEFPLANS = [
  { id: 'basic', name: 'বেসিক', price: 150, maxStudents: 100, maxUsers: 3, portal: false, lock: ['canteen', 'report'], order: 1, note: 'ছোট মাদরাসা / মক্তবের জন্য',
    perks: ['শিক্ষার্থী ১০০ জন পর্যন্ত', 'স্টাফ ইউজার ৩ জন (অ্যাডমিন + ২)', 'শিক্ষার্থী, শিক্ষক, হাজিরা, ফি, আয়-ব্যয়, নোটিশ, রুটিন', 'পরীক্ষা ও রেজাল্ট', 'অফলাইনে কাজ + ক্লাউড ব্যাকআপ ও সিঙ্ক'] },
  { id: 'medium', name: 'মিডিয়াম', price: 250, maxStudents: 300, maxUsers: 10, portal: true, lock: ['canteen'], order: 2, note: 'মাঝারি আকারের মাদরাসার জন্য',
    perks: ['শিক্ষার্থী ৩০০ জন পর্যন্ত', 'স্টাফ ইউজার ১০ জন', 'বেসিকের সব সুবিধা', 'রিপোর্ট ও হিসাব', 'শিক্ষার্থী পোর্টাল (শিক্ষার্থী নিজের ফলাফল/তথ্য দেখবে)'] },
  { id: 'super', name: 'সুপার', price: 350, maxStudents: 0, maxUsers: 0, portal: true, lock: [], order: 3, note: 'বড় প্রতিষ্ঠানের জন্য — সীমাহীন',
    perks: ['শিক্ষার্থী ও ইউজার সীমাহীন', 'মিডিয়ামের সব সুবিধা', 'ক্যান্টিন ব্যবস্থাপনা', 'অগ্রাধিকার সাপোর্ট'] }
];
const NOPLAN = { id: 'none', name: 'নেই', price: 0, maxStudents: 0, maxUsers: 0, portal: false, lock: [], order: 0, note: '', perks: [] };
const planOf = id => (!id || id === 'none') ? NOPLAN : ((PLANS || DEFPLANS).find(p => p.id === id)) || NOPLAN;
async function plansLoad(force) {
  if (PLANS && !force) return PLANS;
  try { const l = await listDocs('plans'); PLANS = l.length ? l.map(p => Object.assign(p, { id: p._id, lock: Array.isArray(p.lock) ? p.lock : [], perks: Array.isArray(p.perks) ? p.perks : [], portal: !!p.portal })).sort((a, b) => (a.order || 0) - (b.order || 0)) : DEFPLANS.slice() } catch (e) { PLANS = PLANS || DEFPLANS.slice() }
  return PLANS;
}

function applyCtx() {
  if (!CTX || CTX.none) { TN = ''; SAF = 0; K = tKey(''); S = JSON.parse(SDEF); syReset(); return }
  SAF = CTX.sa ? 1 : 0; TN = CTX.sa ? (CTX.tn || '') : CTX.tid; K = kFor(); loadS(); syLoad();
}
async function loadCtx() {
  const uid_ = CC.uid, em = CC.email;
  let ev = false;
  try { ev = await lookupEv(await token()) } catch (e) { if (isNet(e)) throw e; ev = false }
  if (!ev) { CTX = { uid: uid_, em, none: 1, unv: 1 }; TM = null; return }    // Gmail যাচাই না হওয়া পর্যন্ত কিছুই খোলে না
  CC.exp = 0; ccSave(); await token();                                         // যাচাইয়ের পর নতুন টোকেন (email_verified দাবিসহ)
  const sa = await getDoc('superAdmins/' + uid_);
  if (sa) { CTX = { uid: uid_, em, sa: 1, name: sa.name || 'সুপার এডমিন', tn: '' }; TM = null; return }
  let ut = await getDoc('utn/' + uid_);
  if (!ut || !safeId(ut.t)) {
    const pr = jp(ls.g(REGK), null);                                            // যাচাইয়ের আগে দেওয়া নিবন্ধনের তথ্য থাকলে মাদরাসা এখন তৈরি হবে
    if (pr && pr.uid === uid_) { try { await regFinish(pr); ut = await getDoc('utn/' + uid_) } catch (x) { } }
  }
  if (!ut || !safeId(ut.t)) { CTX = { uid: uid_, em, none: 1 }; TM = null; return }
  const [t, m] = await Promise.all([getDoc('tenants/' + ut.t), getDoc('tenants/' + ut.t + '/members/' + uid_)]);
  if (!t || !m || m.st !== 'active' || !RC[m.role]) { CTX = { uid: uid_, em, none: 1, off: m && m.st !== 'active' ? 1 : 0 }; TM = null; return }
  CTX = { uid: uid_, em, tid: ut.t, role: m.role, name: m.name || '', sid: m.sid || '', mc: !!m.mc };
  TM = { id: ut.t, name: t.name, st: t.status, plan: t.plan || 'none', exp: t.expiresAt || 0, own: t.ownerUid };
}
async function refreshTM() {
  if (!CTX || CTX.sa || CTX.none || !navigator.onLine || !CC.rt) return;
  try {
    const [t, m] = await Promise.all([getDoc('tenants/' + CTX.tid), getDoc('tenants/' + CTX.tid + '/members/' + CTX.uid)]);
    if (!t || !m || m.st !== 'active') { toast('আপনার অ্যাকাউন্ট বন্ধ বা সরানো হয়েছে'); return logout() }
    const wasP = TM && TM.st !== 'active';
    TM = { id: CTX.tid, name: t.name, st: t.status, plan: t.plan || 'none', exp: t.expiresAt || 0, own: t.ownerUid };
    if (m.role !== CTX.role || m.sid !== CTX.sid) { CTX.role = m.role; CTX.sid = m.sid || '' }
    CTX.mc = !!m.mc; CTX.name = m.name || CTX.name; ctxSave();
    if (wasP && t.status === 'active') { applyCtx(); }
  } catch (e) { if (/PERMISSION/.test(String(e.message))) { /* সদস্যপদ বাতিল */ } }
}
async function afterAuth(pw, em) {
  await loadCtx();
  if (pw && em && !CTX.unv) { try { const h = await hashPw(pw); const o = jp(ls.g(OFFL), {}); o[CTX.uid] = { em, h, ctx: CTX, tm: TM }; ls.s(OFFL, JSON.stringify(o)) } catch (e) { } }
  SESSPW = pw || '';
  ctxSave(); applyCtx(); page = CTX.sa ? 'sa' : 'dash';
  try { history.replaceState(history.state, '', '#' + page) } catch (e) { }
  render(); setTimeout(connect, 200);
}

/* ---------- লগইন (Gmail + পাসওয়ার্ড) ---------- */
async function offlineLogin(em, pw) {
  const o = jp(ls.g(OFFL), {});
  for (const k of Object.keys(o)) {
    const e = o[k];
    if (e.em === em && await verifyPw(pw, e.h)) { CTX = e.ctx; TM = e.tm; SESSPW = ''; ctxSave(); applyCtx(); page = CTX.sa ? 'sa' : 'dash'; render(); toast('অফলাইন মোডে লগইন (ইন্টারনেট এলে সিঙ্ক হবে)'); return true }
  }
  return false;
}
async function doLogin(raw, pw) {
  const em = emKey(raw);
  if (!emOk(em)) { toast(EMMSG); const q = new Error('q'); q.quiet = 1; throw q }
  if (!navigator.onLine) { if (await offlineLogin(em, pw)) return; const e = new Error('bad'); e.bad = 1; throw e }
  try { await auth('signInWithPassword', em, pw) }
  catch (x) { if (!isBad(x)) throw x; const e = new Error('bad'); e.bad = 1; throw e }
  await afterAuth(pw, em);
}
async function login(e) {
  e.preventDefault();
  const w = lkWait(); if (w > 0) { toast('অনেকবার ভুল হয়েছে; ' + w + ' সেকেন্ড পরে চেষ্টা করুন'); return false }
  const d = Object.fromEntries(new FormData(e.target)), b = e.target.querySelector('button'); if (b) b.disabled = true;
  try { await doLogin(d.em, String(d.pw || '')); lkOk() }
  catch (x) { if (x.bad) { lkFail(); toast('Gmail বা পাসওয়ার্ড ভুল') } else if (x.quiet) { } else toast(msgOf(x)) }
  if (b) b.disabled = false;
  return false;
}
async function forgot() {
  const f = document.querySelector('form input[name=em]');
  let em = emKey(f && f.value);
  if (!emOk(em)) em = emKey(prompt('আপনার Gmail ঠিকানা দিন'));
  if (!em) return;
  if (!emOk(em)) return toast(EMMSG);
  if (!navigator.onLine) return toast('ইন্টারনেট দরকার');
  try { await oob('PASSWORD_RESET', { email: em }) } catch (x) { if (!/EMAIL_NOT_FOUND/.test(String(x.message))) return toast(msgOf(x)) }
  toast('এই Gmail-এ অ্যাকাউন্ট থাকলে পাসওয়ার্ড রিসেটের লিংক পাঠানো হয়েছে (স্প্যাম ফোল্ডারও দেখুন)');
}
async function verResend() {
  if (!navigator.onLine) return toast('ইন্টারনেট দরকার');
  try { await oob('VERIFY_EMAIL', { idToken: await token() }); toast('যাচাইকরণ ইমেইল পাঠানো হয়েছে') } catch (x) { toast(msgOf(x)) }
}
async function verCheck() {
  if (!navigator.onLine) return toast('ইন্টারনেট দরকার');
  try { await afterAuth(SESSPW, CTX && CTX.em); if (CTX && CTX.unv) toast('এখনো যাচাই হয়নি — ইমেইলের লিংকে ক্লিক করে আবার চেষ্টা করুন') } catch (x) { toast(msgOf(x)) }
}


/* ---------- নতুন মাদরাসা নিবন্ধন ---------- */
function regUI() {
  const hasLeg = !REG.sa && (() => { const o = jp(ls.g(K0), null); return o && ((o.students || []).length || (o.teachers || []).length || (o.tx || []).length) })();
  const o = document.createElement('div'); o.className = 'md';
  o.innerHTML = `<div class="tb"><b style="font-size:18px">🏫 নতুন মাদরাসা নিবন্ধন</b><button class="btn s o" onclick="this.parentNode.parentNode.remove()">✕ বন্ধ</button></div>
  <p class="em" style="text-align:left">Gmail দিয়ে নিবন্ধন করুন। Gmail যাচাই করার পর মাসিক প্যাকেজের পেমেন্ট পাতা আসবে; পেমেন্ট নিশ্চিত হলে অ্যাপ চালু হবে। ${hasLeg ? '<b>এই ফোনের পুরোনো তথ্য নিরাপদে সাথে যাবে; কিছু মুছবে না।</b>' : ''}</p>
  <form onsubmit="return FBX.register(event)">${inp('মাদরাসার নাম', 'name', 'required')}${inp('অ্যাডমিনের নাম', 'an', 'required')}${inp('Gmail ঠিকানা (লগইন আইডি)', 'em', 'required type="email" inputmode="email" autocomplete="username"')}
  <label>পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)<input type="password" name="pw" required minlength="8" autocomplete="new-password"></label>
  ${hasLeg ? '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="leg" value="1" checked style="width:auto"> এই ফোনের পুরোনো তথ্য সাথে নিন</label>' : ''}
  <button class="btn">নিবন্ধন করুন</button></form>`;
  document.body.append(o);
}
async function register(e) {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target)), b = e.target.querySelector('button.btn'), em = emKey(d.em), pw = String(d.pw || '');
  if (!emOk(em)) { toast(EMMSG); return false }
  if (pw.length < 8 || pwWeak(pw)) { toast(PWMSG); return false }
  if (!navigator.onLine) { toast('নিবন্ধনের জন্য ইন্টারনেট দরকার'); return false }
  if (b) b.disabled = true;
  try {
    await auth('signUp', em, pw);
    try { await oob('VERIFY_EMAIL', { idToken: await token() }) } catch (y) { }       // না গেলে যাচাই-পাতা থেকে আবার পাঠানো যাবে
    ls.s(REGK, JSON.stringify({ uid: CC.uid, name: String(d.name).trim(), an: String(d.an).trim(), leg: d.leg ? '1' : '' }));
    document.querySelectorAll('.md').forEach(x => x.remove());
    toast('নিবন্ধন সম্পন্ন — এখন Gmail যাচাই করুন');
    await afterAuth(pw, em);
  } catch (x) { toast(msgOf(x)); if (b) b.disabled = false }
  return false;
}
async function regFinish(o) {            // Gmail যাচাইয়ের পর মাদরাসা + অ্যাডমিন সদস্য তৈরি (pending = পেমেন্টের অপেক্ষায়)
  const u = CC.uid, tid = 'm' + uid(), t0 = now();
  try {
    await setDoc('tenants/' + tid, { name: String(o.name).trim(), status: 'pending', plan: 'none', expiresAt: 0, ownerUid: u, createdAt: t0 });
    await setDoc('tenants/' + tid + '/members/' + u, { role: 'admin', name: String(o.an).trim(), em: CC.email, st: 'active', sid: '', mc: false, at: t0 });
    await setDoc('utn/' + u, { t: tid });
  } catch (x) { try { await delDoc('tenants/' + tid + '/members/' + u); await delDoc('utn/' + u); await delDoc('tenants/' + tid) } catch (y) { } throw x }
  if (o.leg) { const raw = ls.g(K0); if (raw) ls.s(tKey(tid), raw) }     // পুরোনো লোকাল ডেটা কপি (মূল কপি অক্ষত)
  ls.r(REGK);
}
async function regComplete(e) {
  e.preventDefault(); const d = Object.fromEntries(new FormData(e.target));
  if (!navigator.onLine) { toast('ইন্টারনেট দরকার'); return false }
  try { await regFinish({ name: d.name, an: d.an, leg: '' }); await afterAuth(SESSPW, CTX.em) } catch (x) { toast(msgOf(x)) }
  return false;
}

/* ---------- লগআউট / পাসওয়ার্ড ---------- */
function logout() {
  clearTimeout(SY.t); CTX = null; TM = null; MEM = null; PORTAL = null; SESSPW = ''; ctxSave();
  CC = { key: CC.key, pid: CC.pid }; ccSave();
  TN = ''; SAF = 0; SE = ''; K = tKey(''); S = JSON.parse(SDEF); syReset();
  document.body.classList.remove('nav'); render();
}
async function cpw(p0) {
  if (!CTX || !CC.rt) return toast('অনলাইনে লগইন করা নেই');
  const p = typeof p0 === 'string' ? p0 : prompt('নতুন পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)'); if (!p) return;
  if (p.length < 8 || pwWeak(p)) return toast(PWMSG);
  try {
    const j = await jf(IDT + 'update?key=' + CC.key, { method: 'POST', body: JSON.stringify({ idToken: await token(), password: p, returnSecureToken: true }) });
    Object.assign(CC, { rt: j.refreshToken, tok: j.idToken, exp: now() + (+j.expiresIn - 60) * 1000 }); ccSave();
    const ph = CTX.em;
    if (ph) { const o = jp(ls.g(OFFL), {}); o[CTX.uid] = Object.assign(o[CTX.uid] || { em: ph, ctx: CTX, tm: TM }, { h: await hashPw(p) }); ls.s(OFFL, JSON.stringify(o)) }
    if (CTX.mc && !CTX.sa) { await setDoc('tenants/' + CTX.tid + '/members/' + CTX.uid, { mc: false }, ['mc']); CTX.mc = false; ctxSave() }
    toast('পাসওয়ার্ড বদলেছে'); render();
  } catch (e) { toast(/CREDENTIAL_TOO_OLD|TOKEN_EXPIRED/.test(String(e.message)) ? 'নিরাপত্তার জন্য লগআউট করে আবার লগইন করে চেষ্টা করুন' : msgOf(e)) }
}
async function reauth() {
  const p = prompt('অনলাইন সিঙ্ক চালু করতে পাসওয়ার্ড দিন'); if (!p) return;
  try { const em = CTX.em; await auth('signInWithPassword', em, p); SESSPW = p; toast('সংযুক্ত হয়েছে'); connect() } catch (e) { toast(isBad(e) ? 'পাসওয়ার্ড ভুল' : msgOf(e)) }
}

/* ======================================================================
   সিঙ্ক ইঞ্জিন: রেকর্ড-ভিত্তিক, অফলাইন-ফার্স্ট, সংঘর্ষ-নিরাপদ
   - S (অ্যাপের ডেটা) ভেঙে প্রতিটি রেকর্ড আলাদা Firestore ডকুমেন্ট (tenants/{t}/records)
   - save() হলেই কোন রেকর্ড বদলেছে তা শনাক্ত হয় (শেষ সিঙ্কের হ্যাশের সাথে তুলনা)
   - প্রতিটি পরিবর্তনে সম্পাদনার সময় (u) বসে; সংঘর্ষে নতুনটি জেতে, হেরে যাওয়াটি সংরক্ষিত থাকে
   - অন্য ডিভাইসে পুরোনো থাকা কপি নতুন ডেটা মুছতে পারে না (শুধু বদলানো রেকর্ডই push হয়)
   ====================================================================== */
const SY = { sh: {}, pn: {}, pt: 0, conf: [], hold: null, busy: 0, again: 0, t: 0, fail: 0, err: '', last: 0, skew: 0, lastU: 0, ph: {}, pubDirty: 1 };
const syK = s => K + ':' + s;
function syReset() { Object.assign(SY, { sh: {}, pn: {}, pt: 0, conf: [], hold: null, err: '', fail: 0, ph: {}, pubDirty: 1 }) }
function syLoad() {
  syReset(); if (!TN) return;
  SY.sh = jp(ls.g(syK('sh')), {}); SY.pn = jp(ls.g(syK('pn')), {}); SY.pt = +ls.g(syK('pt')) || 0;
  SY.conf = jp(ls.g(syK('cf')), []); SY.ph = jp(ls.g(syK('ph')), {}); SY.last = +ls.g(syK('ls')) || 0;
}
function syPersist() {
  if (!TN) return;
  ls.s(syK('sh'), JSON.stringify(SY.sh)); ls.s(syK('pn'), JSON.stringify(SY.pn)); ls.s(syK('pt'), String(SY.pt)); ls.s(syK('cf'), JSON.stringify(SY.conf));
}
const SU = () => { let t = (now() + SY.skew) * 1000; if (t <= SY.lastU) t = SY.lastU + 1; SY.lastU = t; return t };
const kc = k => k.slice(0, k.indexOf('~')), ki = k => k.slice(k.indexOf('~') + 1);
const idOk = x => x && typeof x === 'object' && !Array.isArray(x) && x.id != null && String(x.id).length <= 100 && !/[\/\u0000]/.test(String(x.id)) && String(x.id) !== '.' && String(x.id) !== '..';
const validC = c => c === 'cfg' || RECC.includes(c) || MAPK.includes(c) || /^cn\.(prod|sales|buys|exp|cust|led|cash|ret)$/.test(c);

function explode(s) {
  const m = new Map(), cfg = {};
  for (const k of Object.keys(s)) {
    const v = s[k];
    if (k === 'users' || k === '_meta' || k === '_portal' || LOCALK.includes(k)) continue;
    if (RECC.includes(k) && Array.isArray(v) && v.every(idOk)) { v.forEach((x, ix) => m.set(k + '~' + x.id, { c: k, i: String(x.id), v: x, o: ix })); continue }
    if (k === 'cn' && v && typeof v === 'object' && !Array.isArray(v)) {
      const rest = {};
      for (const sk of Object.keys(v)) { const a = v[sk]; if (CNK.includes(sk) && Array.isArray(a) && a.every(idOk)) a.forEach((x, ix) => m.set('cn.' + sk + '~' + x.id, { c: 'cn.' + sk, i: String(x.id), v: x, o: ix })); else rest[sk] = a }
      cfg.cn = rest; continue;
    }
    if (MAPK.includes(k) && v && typeof v === 'object' && !Array.isArray(v)) { for (const d of Object.keys(v)) if (d && !d.includes('/')) m.set(k + '~' + d, { c: k, i: d, v: v[d] }); continue }
    cfg[k] = v;
  }
  if (cfg.attCfg && typeof cfg.attCfg === 'object') { cfg.attCfg = Object.assign({}, cfg.attCfg); delete cfg.attCfg.waKey }
  m.set('cfg~main', { c: 'cfg', i: 'main', v: cfg });
  return m;
}
const loc = c => c.startsWith('cn.') ? (S.cn && S.cn[c.slice(3)]) : S[c];
function localGet(c, i) { if (c === 'cfg') return null; if (MAPK.includes(c)) return (S[c] || {})[i]; const a = loc(c); return Array.isArray(a) ? a.find(x => String(x.id) === i) : undefined }
function localSet(c, i, v, del) {
  if (c === 'cfg') {
    const wa = S.attCfg && S.attCfg.waKey;
    for (const k of Object.keys(v)) {
      if (LOCALK.includes(k) || k === 'users' || k === '_meta' || RECC.includes(k) && Array.isArray(v[k]) && v[k].length && v[k].every(idOk)) continue;
      if (k === 'cn') S.cn = Object.assign(S.cn || {}, v.cn); else if (k === 'attCfg') S.attCfg = Object.assign({}, v.attCfg, wa ? { waKey: wa } : {}); else S[k] = v[k];
    }
    return;
  }
  if (MAPK.includes(c)) { S[c] = S[c] && typeof S[c] === 'object' && !Array.isArray(S[c]) ? S[c] : {}; if (del) delete S[c][i]; else S[c][i] = v; return }
  let host = S, name = c; if (c.startsWith('cn.')) { S.cn = S.cn || {}; host = S.cn; name = c.slice(3) }
  if (!Array.isArray(host[name])) host[name] = [];
  const a = host[name], ix = a.findIndex(x => String(x.id) === i);
  if (del) { if (ix >= 0) a.splice(ix, 1) } else { if (v.id == null) v.id = i; if (ix >= 0) a[ix] = v; else a.push(v) }
}

/* স্থানীয় পরিবর্তন শনাক্ত (save()-এর সময় চলে) */
function scan(force) {
  if (!TN || !CTX || CTX.none || CTX.role === 'student') return 0;
  const cur = explode(S), pn = SY.pn, sh = SY.sh, fresh = !Object.keys(sh).length && !Object.keys(pn).length;
  let ch = 0; const dels = [];
  for (const [k, r] of cur) {
    const h = hs(JSON.stringify(r.v)), p = pn[k], s0 = sh[k];
    if (s0 && s0.h === h) { if (p) { delete pn[k]; ch++ } continue }
    if (p && !p.d && p.h === h) continue;
    const u = SU(), o = s0 && s0.o != null ? s0.o : (fresh && r.o != null ? r.o : (UNS.includes(r.c) ? -u : u));
    pn[k] = { u, h, o, c: r.c, i: r.i }; ch++;
  }
  for (const k of Object.keys(sh)) if (!cur.has(k) && !(pn[k] && pn[k].d)) dels.push(k);
  for (const k of Object.keys(pn)) if (!cur.has(k) && !pn[k].d && !sh[k]) { delete pn[k]; ch++ }
  if (dels.length) {
    const tot = Object.keys(sh).length;
    const wiped = tot > 1 && (cur.size <= 1 || dels.length >= tot * 0.9);    // লোডের পর S প্রায় খালি/অস্বাভাবিক কম অথচ আগে অনেক রেকর্ড ছিল — করাপশন/রেসের লক্ষণ; tombstone পুশ করা হবে না, force দিয়েও না
    if (wiped) SY.hold = dels;
    else if (!force && dels.length >= 10 && dels.length >= tot * 0.5) SY.hold = dels;    // একসাথে অনেক রেকর্ড মুছতে চাইলে আটকে নিশ্চিতকরণ চাই
    else { SY.hold = null; for (const k of dels) { const s0 = sh[k]; pn[k] = { u: SU(), d: 1, c: kc(k), i: ki(k), o: s0.o, h: 'del' }; ch++ } }
  } else SY.hold = null;
  return ch;
}
function onSave() {
  if (!CTX || !TN || CTX.none || CTX.role === 'student') return;
  scan(); ls.s(syK('pn'), JSON.stringify(SY.pn)); SY.pubDirty = 1;
  clearTimeout(SY.t); SY.t = setTimeout(() => sync('push'), 4000); netUI();
}

/* রিমোট থেকে আনা */
function applyRemote(d, touched) {
  const c = d.c, i = d.i;
  if (!validC(c) || typeof i !== 'string' || !i) return 0;
  const k = c + '~' + i, s0 = SY.sh[k], p = SY.pn[k], u = d.u || 0;
  if (s0 && (s0.u || 0) >= u) return 0;
  if (!s0 && d.d && !p) return 0;
  if (p && p.u >= u) return 0;                         // আমার পরিবর্তন নতুন: রাখব, পরে push হবে
  let v = null;
  if (!d.d) { v = safeParse(d.j); if (!v || typeof v !== 'object' || Array.isArray(v)) return 0 }
  if (p) { SY.conf.unshift({ k, c, i, u: p.u, at: now(), d: p.d ? 1 : 0, v: localGet(c, i) || null }); SY.conf.length = Math.min(SY.conf.length, 30); delete SY.pn[k] }
  if (d.d) { localSet(c, i, null, 1); delete SY.sh[k] }
  else { localSet(c, i, v, 0); SY.sh[k] = { h: c === 'cfg' ? '' : hs(JSON.stringify(localGet(c, i))), o: d.o, u } }
  touched.add(c); return 1;
}
function finishApply(touched) {
  for (const c of touched) {
    if (c === 'cfg') { const e = explode(S).get('cfg~main'); SY.sh['cfg~main'].h = hs(JSON.stringify(e.v)); continue }
    if (MAPK.includes(c)) continue;
    const host = c.startsWith('cn.') ? (S.cn || {}) : S, name = c.startsWith('cn.') ? c.slice(3) : c, a = host[name];
    if (Array.isArray(a) && a.length > 1) { const ox = x => { const e = SY.sh[c + '~' + x.id]; return e && e.o != null ? e.o : 1e18 }; a.sort((x, y) => ox(x) - ox(y)) }
  }
  if (!ls.s(K, JSON.stringify(S))) { toast('সংরক্ষণ ব্যর্থ (স্টোরেজ পূর্ণ?) — সিঙ্ক আটকে রাখা হলো', 1); return }
  syPersist(); SY.pubDirty = 1; uiRefresh();
}
function uiRefresh() {
  const a = document.activeElement, typing = a && /INPUT|TEXTAREA|SELECT/.test(a.tagName);
  if (document.querySelector('body>.md,body>.ov') || typing) { SY.stale = 1; toast('অন্য ডিভাইস থেকে নতুন তথ্য এসেছে — পাতা রিফ্রেশ করুন'); return }
  const y = scrollY; try { render() } catch (e) { } scrollTo(0, y);
}
async function pull(wide) {
  let cur = wide ? Math.max(0, SY.pt - DAY) : SY.pt, ch = 0; const touched = new Set();
  const excl = adminLike() ? null : MONEYC;   // শিক্ষকের কোয়েরি থেকেই tx/cn.* বাদ, নইলে রুলস পুরো পেজ কোয়েরি বাতিল করে দেবে
  for (let pg = 0; pg < 400; pg++) {
    const uf = { fieldFilter: { field: { fieldPath: 'u' }, op: 'GREATER_THAN', value: { integerValue: String(cur) } } };
    const where = excl ? { compositeFilter: { op: 'AND', filters: [uf, { fieldFilter: { field: { fieldPath: 'c' }, op: 'NOT_IN', value: { arrayValue: { values: excl.map(c => ({ stringValue: c })) } } } }] } } : uf;
    const rs = await runQuery('tenants/' + TN, { from: [{ collectionId: 'records' }], where, orderBy: [{ field: { fieldPath: 'u' }, direction: 'ASCENDING' }], limit: 200 });
    const rt = rs.find(x => x.readTime); if (rt) { const sk = Date.parse(rt.readTime) - now(); if (Math.abs(sk) < 7 * 864e5) SY.skew = sk }
    const docs = rs.filter(x => x.document).map(x => dd(x.document));
    for (const d of docs) { cur = Math.max(cur, d.u || 0); if (applyRemote(d, touched)) ch++ }
    if (docs.length < 200) break;
  }
  if (cur > SY.pt) SY.pt = cur;
  if (ch) finishApply(touched); else syPersist();
  return ch;
}
const rbytes = s => new TextEncoder().encode(s).length;
async function push() {
  const ks = Object.keys(SY.pn);
  if (!ks.length || isExp()) return;
  const cur = explode(S), items = []; SY.big = [];
  for (const k of ks) {
    const p = SY.pn[k], r = cur.get(k), del = !!(p.d || !r), c = p.c || kc(k), i = p.i != null ? p.i : ki(k), o = Number.isInteger(p.o) ? p.o : 0;
    const f = del ? { c, i, j: '', u: p.u, d: true, o } : { c, i, j: JSON.stringify(r.v), u: p.u, d: false, o };
    const sz = rbytes(f.j); if (sz > 950000) { SY.big.push(k); continue }
    items.push({ k, p, del, f, sz });
  }
  let batch = [], sz = 0;
  const flush = async () => {
    if (!batch.length) return; const b = batch; batch = []; sz = 0;
    await commit(b.map(x => ({ update: { name: docName('tenants/' + TN + '/records/' + x.f.c + '~' + x.f.i), fields: toF(x.f) } })));
    for (const x of b) { const q = SY.pn[x.k]; if (q && q.u === x.p.u) { delete SY.pn[x.k]; if (x.del) delete SY.sh[x.k]; else SY.sh[x.k] = { h: x.p.h, o: x.p.o, u: x.p.u } } }
    syPersist();
  };
  for (const it of items) { if (batch.length >= 40 || sz + it.sz > 3.5e6) await flush(); batch.push(it); sz += it.sz }
  await flush();
  if (SY.big.length) throw new Error('কিছু রেকর্ড খুব বড় (ছবি ছোট করুন): ' + SY.big.slice(0, 2).join(', '));
}

/* শিক্ষার্থী-পোর্টাল: অ্যাডমিন/হিসাবরক্ষক নিরাপদ আলাদা কপি প্রকাশ করেন; শিক্ষার্থী শুধু নিজেরটা পড়ে */
const portalOf = s => ({
  s: { id: s.id, name: s.name, cls: s.cls, roll: s.roll || '', sno: s.sno || '', fee: s.fee || 0 },
  fees: (S.tx || []).filter(t => t.kind == 'fee' && t.sid == s.id),
  results: (S.exams || []).filter(e => e.cls == s.cls).map(e => {
    let r = null; try { r = calc(e).find(x => x.s.id == s.id) } catch (x) { }
    if (!r || !r.has) return { name: e.name, year: e.year || '', pub: 0 };
    return { name: e.name, year: e.year || '', pub: 1, subs: e.subs.map((b, i) => ({ n: b.n, m: b.m, raw: String(exRaw(e, s.id, i) || '') })), tot: r.tot, full: r.full, p: r.p, g: r.g, fail: !!r.fail, pos: r.pos };
  })
});
const adminLike = () => CTX && (CTX.sa || ['admin', 'accountant'].includes(CTX.role));
async function pubSync() {
  if (!adminLike() || isExp() || !TN) return;
  const docs = {};
  docs.notices = JSON.stringify((S.notices || []).filter(x => x.to !== 'শিক্ষক').slice(0, 60));
  docs.cfg = JSON.stringify({ inst: S.inst, info: S.info || {}, theme: S.theme || '' });
  const ms = MEM || await memLoad().catch(() => null) || [];
  for (const m of ms) { if (m.role !== 'student' || !m.sid || m.st !== 'active') continue; const s = (S.students || []).find(x => x.id == m.sid); if (s && safeId(m.sid)) docs['p_' + m.sid] = JSON.stringify(portalOf(s)) }
  for (const [id, j] of Object.entries(docs)) {
    const h = hs(j); if (SY.ph[id] === h || rbytes(j) > 950000) continue;
    await setDoc('tenants/' + TN + '/pub/' + id, { j, u: now() }); SY.ph[id] = h; ls.s(syK('ph'), JSON.stringify(SY.ph));
  }
  SY.pubDirty = 0;
}
async function stuPull() {
  const b = 'tenants/' + TN + '/pub/';
  const [n, c, p] = await Promise.all([getDoc(b + 'notices'), getDoc(b + 'cfg'), CTX.sid && safeId(CTX.sid) ? getDoc(b + 'p_' + CTX.sid) : null]);
  const cj = c ? safeParse(c.j) || {} : {}, pj = p ? safeParse(p.j) : null, nj = n ? safeParse(n.j) : [];
  S = Object.assign(JSON.parse(SDEF), { inst: cj.inst || 'আমার প্রতিষ্ঠান', info: cj.info || {}, theme: cj.theme || '', notices: Array.isArray(nj) ? nj : [], students: pj && pj.s ? [pj.s] : [], tx: pj && Array.isArray(pj.fees) ? pj.fees : [], _portal: pj && Array.isArray(pj.results) ? pj.results : [] });
  if (!ls.s(K, JSON.stringify(S))) toast('সংরক্ষণ ব্যর্থ (স্টোরেজ পূর্ণ?) — তথ্য এই সেশনেই শুধু দেখা যাচ্ছে', 1);
  render();
}

/* সিঙ্কের মূল ফাংশন */
async function sync(mode) {
  if (!CTX || CTX.none || !TN) return;
  if (!navigator.onLine) return netUI();
  if (!CC.rt) { SY.err = 'reauth'; return netUI() }
  if (TM && TM.st !== 'active' && !CTX.sa) return;
  if (SY.busy) { SY.again = 1; return }
  SY.busy = 1; netUI();
  try {
    if (CTX.role === 'student' && !CTX.sa) await stuPull();
    else {
      await pull(mode === 'connect');
      if (mode === 'connect') { scan(); syPersist() }
      await push();
      if (SY.pubDirty || mode === 'connect') await pubSync();
    }
    SY.err = ''; SY.fail = 0; SY.last = now(); ls.s(syK('ls'), String(SY.last));
  } catch (e) {
    SY.fail++; SY.err = msgOf(e);
    if (/PERMISSION_DENIED/.test(String(e.message))) refreshTM();
    if (/INVALID_REFRESH_TOKEN|TOKEN_EXPIRED|USER_NOT_FOUND|USER_DISABLED|INVALID_GRANT/.test(String(e.message))) { CC.rt = ''; ccSave(); SY.err = 'reauth' }
  } finally { SY.busy = 0; netUI(); if (SY.again) { SY.again = 0; setTimeout(() => sync('push'), 800) } }
}
async function connect() {
  if (!CTX || CTX.none) return;
  if (!navigator.onLine) return netUI();
  if (!CC.rt) { SY.err = 'reauth'; netUI(); return CTX.sa && !TN ? 0 : 0 }
  if (!CTX.sa) await refreshTM();
  plansLoad();
  if (CTX.sa && !TN) { await saLoad(); return }
  render();
  if (TM && TM.st !== 'active' && !CTX.sa) return;
  await sync('connect');
  if (CTX && (CTX.sa || CTX.role === 'admin')) memLoad().then(() => { if (page === 'users') render() }).catch(() => { });
}
setInterval(() => {
  if (!CTX || CTX.none || !TN || document.hidden || !navigator.onLine) return;
  if (Date.now() - _act > 6e5) return;
  if (SY.fail >= 3 && now() - SY.last < 6e5) return;
  sync('poll');
}, 120000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && CTX && TN && !CTX.none && navigator.onLine) sync('poll') });
function netUI0() {
  const n = $('#net'); if (!n) return;
  const p = Object.keys(SY.pn).length;
  n.textContent = (navigator.onLine ? '🟢' : '⚪') + (CTX && TN && !CTX.none ? (SY.busy ? ' ⟳' : SY.err ? ' ⚠' : p || SY.hold ? ' ☁⏳' + (p ? bn(p) : '') : ' ☁✓') : '');
}
W.netUI = netUI0;
const conflictsKeep = () => {
  let n = 0; for (const c of SY.conf) { if (c.v && !c.d) { localSet(c.c, c.i, c.v, 0); n++ } }
  SY.conf = []; ls.s(K, JSON.stringify(S)); scan(true); syPersist(); render(); sync('push'); toast(n + 'টি পরিবর্তন ফিরিয়ে আনা হয়েছে')
};
const holdOk = () => { scan(true); syPersist(); sync('push'); render() };
const holdNo = () => { for (const k of (SY.hold || [])) delete SY.sh[k]; SY.hold = null; SY.pt = 0; syPersist(); sync('connect'); toast('ক্লাউড থেকে রেকর্ড ফিরিয়ে আনা হচ্ছে') };

/* ======================================================================
   ইউজার / রোল ব্যবস্থাপনা (Firebase Auth + members)
   ====================================================================== */
const canAdm = () => CTX && (CTX.sa || CTX.role === 'admin');
async function memLoad(tid) {
  tid = tid || TN; if (!tid) return [];
  const l = (await listDocs('tenants/' + tid + '/members')).map(x => Object.assign(x, { uid: x._id }));
  if (tid === TN) MEM = l; return l;
}
function within(kind) {
  if (!TM || (CTX && CTX.sa)) return true;
  const p = planOf(TM.plan), lim = kind === 'students' ? p.maxStudents : p.maxUsers;
  if (!lim) return true;
  const n = kind === 'students' ? (S.students || []).length : (MEM || []).filter(m => m.role !== 'student').length;
  if (n >= lim) { toast('এই প্যাকেজে সর্বোচ্চ ' + bn(lim) + ' জন; প্যাকেজ আপগ্রেড করুন'); return false }
  return true;
}
const pageOk = p => !TM || (CTX && CTX.sa) || !(planOf(TM.plan).lock || []).includes(p);
const mPath = (t, u) => 'tenants/' + t + '/members/' + u;
async function makeUser(tid, o) {      // Auth অ্যাকাউন্ট (আসল Gmail) + member + utn; ব্যর্থ হলে রোলব্যাক
  const em = emKey(o.em); if (!emOk(em)) throw new Error(EMMSG);
  const a = await rawSignUp(em, o.pw);
  try {
    await setDoc(mPath(tid, a.uid), { role: o.role, name: o.name, em, st: o.st || 'active', sid: o.role === 'student' ? (o.sid || '') : '', mc: o.mc !== false, at: now() });
    await setDoc('utn/' + a.uid, { t: tid });
  } catch (x) { try { await delDoc(mPath(tid, a.uid)); await delDoc('utn/' + a.uid) } catch (y) { } await rawDelete(a.tok); throw x }
  try { await fr(IDT + 'sendOobCode?key=' + CC.key, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestType: 'VERIFY_EMAIL', idToken: a.tok }) }) } catch (y) { }
  return { uid: a.uid, em };
}
async function memAdd(e) {
  e.preventDefault(); if (!canAdm()) { toast('অনুমতি নেই'); return false }
  const d = Object.fromEntries(new FormData(e.target)), role = RCI[d.role], pw = String(d.pw || ''), em = emKey(d.em), b = e.target.querySelector('button.btn');
  if (!role) return toast('ভূমিকা বেছে নিন'), false;
  if (!emOk(em)) return toast(EMMSG), false;
  if (role === 'student' && !d.sid) return toast('শিক্ষার্থী বেছে নিন'), false;
  if (pw.length < 8 || pwWeak(pw)) return toast(PWMSG), false;
  if (!navigator.onLine) return toast('ইউজার যোগ করতে ইন্টারনেট দরকার'), false;
  if (role === 'student' && !(CTX.sa || planOf(TM && TM.plan).portal)) return toast('শিক্ষার্থী পোর্টাল মিডিয়াম বা সুপার প্যাকেজে পাওয়া যায়'), false;
  if (!MEM) await memLoad().catch(() => { });
  if (role !== 'student' && !within('users')) return false;
  if (b) b.disabled = true;
  try { await makeUser(TN, { em, name: String(d.name).trim(), role, sid: d.sid, pw, st: d.st === 'নিষ্ক্রিয়' ? 'disabled' : 'active' }); await memLoad(); SY.pubDirty = 1; toast('ইউজার যোগ হয়েছে — তার Gmail-এ যাচাইকরণ মেইল গেছে; প্রথম লগইনে পাসওয়ার্ড বদলাতে হবে'); e.target.reset(); render() }
  catch (x) { toast(msgOf(x)) }
  if (b) b.disabled = false; return false;
}
function showPw(title, rows) {
  mdl(title, `<p class="em" style="text-align:left">নিচের অস্থায়ী পাসওয়ার্ডগুলো <b>শুধু এখন</b> দেখানো হচ্ছে। ব্যবহারকারীকে নিরাপদে জানান; প্রথম লগইনে তাদের নতুন পাসওয়ার্ড দিতে হবে।</p>${rows.map(r => `<div class="row"><div><b>${esc(r[0])}</b><small>${esc(r[1])}</small></div><b style="font-size:20px;letter-spacing:1px;user-select:all">${esc(r[2])}</b></div>`).join('')}`);
}
async function memReset(uid_, tid) {      // পাসওয়ার্ড রিসেট: ইউজারের Gmail-এ Firebase-এর রিসেট লিংক যায়
  tid = tid || TN; if (!canAdm()) return toast('অনুমতি নেই');
  const l = tid === TN ? (MEM || []) : await memLoad(tid), m = l.find(x => x.uid === uid_); if (!m) return;
  if (uid_ === CTX.uid) return toast('নিজের পাসওয়ার্ড "পাসওয়ার্ড বদলান" বাটন থেকে বদলান');
  if (!m.em) return toast('এই ইউজারের Gmail সংরক্ষিত নেই');
  if (!navigator.onLine) return toast('ইন্টারনেট দরকার');
  if (!confirm(m.name + '-এর ' + m.em + ' ঠিকানায় পাসওয়ার্ড রিসেটের লিংক পাঠানো হবে। এগিয়ে যাবেন?')) return;
  try { await oob('PASSWORD_RESET', { email: m.em }); toast('রিসেট লিংক পাঠানো হয়েছে') } catch (x) { toast(msgOf(x)) }
}
async function memToggle(u) {
  const m = (MEM || []).find(x => x.uid === u); if (!m || !canAdm()) return;
  if (u === CTX.uid) return toast('নিজের অ্যাকাউন্ট নিষ্ক্রিয় করা যাবে না');
  try { await setDoc(mPath(TN, u), { st: m.st === 'active' ? 'disabled' : 'active' }, ['st']); await memLoad(); render() } catch (x) { toast(msgOf(x)) }
}
async function memDel(u) {
  const m = (MEM || []).find(x => x.uid === u); if (!m || !canAdm()) return;
  if (u === CTX.uid) return toast('নিজের অ্যাকাউন্ট মুছা যাবে না');
  if (m.role === 'admin' && (MEM || []).filter(x => x.role === 'admin' && x.st === 'active').length < 2) return toast('অন্তত একজন সক্রিয় অ্যাডমিন রাখতে হবে');
  if (!confirm(m.name + ' কে মুছে ফেলবেন?')) return;
  try { await delDoc(mPath(TN, u)); await delDoc('utn/' + u); await memLoad(); render(); toast('ইউজার মুছে ফেলা হয়েছে') } catch (x) { toast(msgOf(x)) }
}
function memEdit(u) {
  const m = (MEM || []).find(x => x.uid === u); if (!m || !canAdm()) return;
  const o = document.createElement('div'); o.className = 'md';
  o.innerHTML = `<div class="tb"><b style="font-size:18px">ইউজার সম্পাদনা</b><button class="btn s o" onclick="this.parentNode.parentNode.remove()">✕ বন্ধ</button></div>
  <form onsubmit="return FBX.memSave(event,'${jx(u)}')">${inp('নাম', 'name', `required value="${esc(m.name)}"`)}${sel('ভূমিকা', 'role', ROLES, RC[m.role])}
  <label>শিক্ষার্থী (শুধু "শিক্ষার্থী" ভূমিকার জন্য)<select name="sid"><option value="">— নেই —</option>${S.students.map(s => `<option value="${esc(s.id)}" ${s.id == m.sid ? 'selected' : ''}>${esc(s.name)} (${esc(s.cls)})</option>`).join('')}</select></label><button class="btn">সংরক্ষণ</button></form>`;
  document.body.append(o);
}
async function memSave(e, u) {
  e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)), m = (MEM || []).find(x => x.uid === u), role = RCI[d.role];
  if (!m || !role) return false;
  if (role === 'student' && !d.sid) return toast('শিক্ষার্থী বেছে নিন'), false;
  if (m.role === 'admin' && role !== 'admin' && (MEM || []).filter(x => x.role === 'admin' && x.st === 'active').length < 2) return toast('অন্তত একজন সক্রিয় অ্যাডমিন রাখতে হবে'), false;
  try { await setDoc(mPath(TN, u), { role, name: String(d.name).trim(), sid: role === 'student' ? d.sid : '' }, ['role', 'name', 'sid']); document.querySelectorAll('.md').forEach(x => x.remove()); await memLoad(); SY.pubDirty = 1; render() } catch (x) { toast(msgOf(x)) }
  return false;
}
PG.users = () => {
  if (!MEM && navigator.onLine && CTX && !CTX.none && !PG._ml) { PG._ml = 1; memLoad().then(() => { PG._ml = 0; if (page === 'users') render() }).catch(() => { PG._ml = 0 }) }
  if (!canAdm()) return '<div class="card"><p class="em">শুধু অ্যাডমিন ইউজার ব্যবস্থাপনা করতে পারেন</p></div>';
  const L = MEM || [], nm = id => (S.students.find(s => s.id == id) || {}).name, p = planOf(TM && TM.plan);
  return `<div class="card"><details><summary>＋ নতুন ইউজার</summary><form onsubmit="return FBX.memAdd(event)">${inp('নাম', 'name', 'required')}${inp('Gmail ঠিকানা (লগইন আইডি)', 'em', 'required type="email" inputmode="email"')}<label>অস্থায়ী পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)<input type="password" name="pw" required minlength="8" autocomplete="new-password"></label>${sel('ভূমিকা', 'role', ROLES)}<label>শিক্ষার্থী (শুধু "শিক্ষার্থী" ভূমিকার জন্য)<select name="sid"><option value="">— নেই —</option>${S.students.map(s => `<option value="${esc(s.id)}">${esc(s.name)} (${esc(s.cls)})</option>`).join('')}</select></label>${sel('অবস্থা', 'st', ['সক্রিয়', 'নিষ্ক্রিয়'])}<button class="btn">সংরক্ষণ করুন</button></form></details>${p.maxUsers ? `<small style="color:var(--m)">প্যাকেজ সীমা: ${bn(L.length)}/${bn(p.maxUsers)} জন</small>` : ''}</div>
  <div class="card">${MEM ? '' : '<p class="em">লোড হচ্ছে… (ইন্টারনেট দরকার)</p>'}${L.map(u => `<div class="row" style="flex-wrap:wrap"><div style="flex:1;min-width:160px"><b>${esc(u.name)}</b><small>${esc(RC[u.role] || u.role)} · ${u.st === 'active' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}${u.em ? ' · ' + esc(u.em) : ''}${u.sid && nm(u.sid) ? ' · ' + esc(nm(u.sid)) : ''}${u.mc ? ' · পাসওয়ার্ড বদলানো বাকি' : ''}</small></div><div class="r" style="gap:6px;flex-wrap:wrap"><button class="btn s o" onclick="FBX.memEdit('${jx(u.uid)}')">সম্পাদনা</button><button class="btn s o" onclick="FBX.memReset('${jx(u.uid)}')">পাসওয়ার্ড রিসেট</button><button class="btn s o" onclick="FBX.memToggle('${jx(u.uid)}')">${u.st === 'active' ? 'নিষ্ক্রিয়' : 'সক্রিয়'}</button><button class="x" onclick="FBX.memDel('${jx(u.uid)}')">মুছুন</button></div></div>`).join('') || (MEM ? '<p class="em">কোনো ইউজার নেই</p>' : '')}</div>
  <div class="card"><b>ভূমিকা অনুযায়ী অনুমতি</b><div class="row"><div><b>অ্যাডমিন</b><small>সবকিছু দেখা, করা ও ইউজার ব্যবস্থাপনা</small></div></div><div class="row"><div><b>হিসাবরক্ষক</b><small>সবকিছু দেখা ও করা (ইউজার ব্যবস্থাপনা ছাড়া)</small></div></div><div class="row"><div><b>শিক্ষক</b><small>নোটিশ, রুটিন ও পরীক্ষা/রেজাল্ট তৈরি ও সম্পাদনা; বাকি সব শুধু দেখা</small></div></div><div class="row"><div><b>শিক্ষার্থী</b><small>শুধু নিজের রেজাল্ট, নোটিশ, মাসিক ফি ও প্রতিষ্ঠানের তথ্য দেখা</small></div></div><p class="em" style="text-align:left">এই অনুমতিগুলো Firebase সার্ভারের Security Rules দিয়ে প্রয়োগ হয়; ব্রাউজারের ডেটা বদলে কেউ অন্য মাদরাসা বা ভূমিকার ডেটা পাবে না।</p></div>`;
};

/* ======================================================================
   Super Admin প্যানেল: মাদরাসা অনুমোদন, প্যাকেজ, মেয়াদ, পেমেন্ট
   ====================================================================== */
const SAD = { T: [], pay: [], ok: 0, err: '' };
let PLAT = null, PAYS = null;
const bdPlat = () => Object.assign({ bkash: '', nagad: '', rocket: '' }, Object.fromEntries(Object.entries(PLAT || {}).filter(e => e[1])));
const pnum = n => n ? esc(n) : '<i class="em">সুপার এডমিন এখনো সেট করেননি</i>';   // সোর্সে কোনো ব্যক্তিগত নম্বর হার্ডকোড নেই; শুধু platform/settings থেকে
const saOk = () => { if (!(CTX && CTX.sa)) { toast('অনুমতি নেই'); return false } return true };
async function saLoad() {
  if (!CTX || !CTX.sa) return;
  try {
    SAD.err = '';
    const [t, pr] = await Promise.all([listDocs('tenants'), runQuery('', { from: [{ collectionId: 'payments' }], where: { fieldFilter: { field: { fieldPath: 'st' }, op: 'EQUAL', value: { stringValue: 'pending' } } }, limit: 100 })]);
    SAD.T = t.map(x => Object.assign(x, { id: x._id })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    SAD.pay = pr.filter(x => x.document).map(x => { const d = dd(x.document); d.id = d._id; return d });
    await plansLoad(true); PLAT = await getDoc('platform/settings').catch(() => null); SAD.ok = 1;
  } catch (e) { SAD.err = msgOf(e) }
  if (page === 'sa' && !TN) render();
}
const stBadge = s => s === 'pending' ? '<span class="rd">পেমেন্টের অপেক্ষায়</span>' : s === 'suspended' ? '<span class="rd">বন্ধ</span>' : 'সক্রিয়';
async function saSet(id, o, mask) { if (!saOk()) return; try { await setDoc('tenants/' + id, o, mask || Object.keys(o)); await saLoad() } catch (e) { toast(msgOf(e)) } }
const saApprove = id => { const t = SAD.T.find(x => x.id === id); saSet(id, { status: 'active', plan: t && t.plan && t.plan !== 'none' ? t.plan : 'basic', expiresAt: now() + 30 * 864e5 }) };
const saTog = id => { const t = SAD.T.find(x => x.id === id); if (t) saSet(id, { status: t.status === 'suspended' ? 'active' : 'suspended' }) };
const saPlan = (id, v) => saSet(id, { plan: v });
function saExt(id, days) { const t = SAD.T.find(x => x.id === id); if (!t) return; const base = Math.max(now(), t.expiresAt || 0); saSet(id, { expiresAt: days ? base + days * 864e5 : 0 }) }
async function listNames(path) {          // ডকুমেন্টের পুরো নামসহ তালিকা (আইডিতে বিশেষ অক্ষর থাকলেও মোছা যায়)
  const out = []; let tok = '';
  do { const j = await api('GET', path, null, '?pageSize=300' + (tok ? '&pageToken=' + encodeURIComponent(tok) : '')); if (!j) break; (j.documents || []).forEach(d => out.push(d)); tok = j.nextPageToken || '' } while (tok);
  return out;
}
async function delMany(docs) { for (let i = 0; i < docs.length; i += 100) await commit(docs.slice(i, i + 100).map(d => ({ delete: d.name }))) }
async function tenantPurge(tid) {          // যেকোনো মাদরাসা (সক্রিয়/বন্ধ/পেন্ডিং/অর্ধেক-মোছা) পুরোপুরি মোছে
  if (!safeId(tid)) throw new Error('মাদরাসার আইডি সঠিক নয়');
  await delMany(await listNames('tenants/' + tid + '/records'));
  await delMany(await listNames('tenants/' + tid + '/pub'));
  try {                                    // অপেক্ষমাণ পেমেন্ট বাতিল (অনুমোদিত/বাতিল পেমেন্ট হিসাবের জন্য থাকে; TrxID পুনর্ব্যবহার ঠেকাতে মোছা হয় না)
    const pr = await runQuery('', { from: [{ collectionId: 'payments' }], where: { fieldFilter: { field: { fieldPath: 't' }, op: 'EQUAL', value: { stringValue: tid } } }, limit: 200 });
    for (const x of pr) { if (!x.document) continue; const d = dd(x.document); if (d.st === 'pending') await setDoc('payments/' + d._id, { st: 'rejected' }, ['st']) }
  } catch (e) { }
  const ms = await listNames('tenants/' + tid + '/members');
  for (const m of ms) { const u = decodeURIComponent(m.name.split('/').pop()); try { const x = await getDoc('utn/' + u); if (x && x.t === tid) await delDoc('utn/' + u) } catch (e) { } }
  await delMany(ms);
  await delDoc('tenants/' + tid);          // সবার শেষে; মাঝপথে থামলে আবার চেষ্টা করা যাবে
}
async function saDel(id) {
  if (!saOk()) return;
  try { await tenantPurge(id); toast('মাদরাসা ক্লাউড থেকে মুছে ফেলা হয়েছে'); await saLoad() } catch (e) { toast('মোছা যায়নি: ' + msgOf(e)); await saLoad() }
}
const saUnpaid = () => { const paid = new Set(SAD.pay.map(p => p.t)); return SAD.T.filter(t => t.status === 'pending' && !paid.has(t.id)) };   // পেমেন্ট জমা না দেওয়া নিবন্ধন
async function saClean() {
  if (!saOk()) return; const L = saUnpaid(); if (!L.length) return;
  if (!confirm(bn(L.length) + 'টি পেমেন্টহীন অসম্পূর্ণ নিবন্ধন মুছে ফেলবেন? (এদের কেউ পেমেন্ট জমা দেয়নি)')) return;
  let n = 0;
  for (const t of L) {
    try {
      const r = await runQuery('', { from: [{ collectionId: 'payments' }], where: { fieldFilter: { field: { fieldPath: 't' }, op: 'EQUAL', value: { stringValue: t.id } } }, limit: 1 });
      if (r.some(x => x.document)) continue;                       // যেকোনো পেমেন্ট থাকলে মোছা হবে না
      await tenantPurge(t.id); n++;
    } catch (e) { }
  }
  toast(bn(n) + 'টি মুছে ফেলা হয়েছে'); await saLoad();
}
async function saEnter(id) {
  if (!saOk()) return;
  let t = null; try { t = await getDoc('tenants/' + id) } catch (e) { }
  TM = { id, name: t ? t.name : id, st: t ? t.status : 'active', plan: t ? t.plan || 'none' : 'none', exp: t ? t.expiresAt || 0 : 0, own: t && t.ownerUid };
  CTX.tn = id; TN = id; MEM = null; K = kFor(); loadS(); syLoad(); ctxSave(); page = 'dash';
  try { history.replaceState(history.state, '', '#dash') } catch (e) { }
  render(); setTimeout(() => sync('connect'), 100); memLoad(id).catch(() => { });
}
function saHome() { if (!CTX) return; CTX.tn = ''; TN = ''; TM = null; MEM = null; K = tKey(''); S = JSON.parse(SDEF); syReset(); ctxSave(); page = 'sa'; try { history.replaceState(history.state, '', '#sa') } catch (e) { } render(); saLoad() }
async function saNew(e) {
  e.preventDefault(); if (!saOk()) return false;
  const d = Object.fromEntries(new FormData(e.target)), pw = String(d.pw || ''), em = emKey(d.em), b = e.target.querySelector('button.btn');
  if (!emOk(em)) return toast(EMMSG), false;
  if (pw.length < 8 || pwWeak(pw)) return toast(PWMSG), false;
  if (b) b.disabled = true; const tid = 'm' + uid();
  try {
    await setDoc('tenants/' + tid, { name: String(d.name).trim(), status: 'active', plan: d.plan || 'basic', expiresAt: now() + 30 * 864e5, ownerUid: CTX.uid, createdAt: now() });
    try { await makeUser(tid, { em, name: String(d.an).trim(), role: 'admin', pw, mc: true }) } catch (x) { await delDoc('tenants/' + tid); throw x }
    toast('মাদরাসার একাউন্ট তৈরি হয়েছে (৩০ দিন চালু)'); e.target.reset(); await saLoad();
  } catch (x) { toast(msgOf(x)) }
  if (b) b.disabled = false; return false;
}
async function saReset(id) {
  if (!saOk()) return; const l = await memLoad(id).catch(x => { toast(msgOf(x)); return [] }), a = l.find(m => m.role === 'admin' && m.st === 'active') || l.find(m => m.role === 'admin');
  if (!a) return toast('এই মাদরাসায় কোনো অ্যাডমিন নেই'); memReset(a.uid, id);
}
async function payOk(id, yes) {
  if (!saOk()) return; const p = SAD.pay.find(x => x.id === id), t = p && SAD.T.find(x => x.id === p.t); if (!p) return;
  if (p.st && p.st !== 'pending') return toast('এই অনুরোধ আগেই প্রসেস হয়েছে');    // রিট্রাই/ডাবল-ক্লিকে দ্বিতীয়বার মেয়াদ যোগ হওয়া ঠেকানো
  if (yes && !t) return toast('এই মাদরাসাটি আর নেই; অনুমোদন করা যাবে না — বাতিল করুন');
  if (yes && t) {
    const pr = planOf(p.plan).price;
    if (pr && +p.amt !== +pr && !confirm('পাঠানো টাকা (' + p.amt + ') প্যাকেজের বর্তমান মূল্যের (' + pr + ') সাথে মিলছে না। তবুও অনুমোদন করবেন?')) return;
  }
  try {
    const writes = [];
    if (yes && t) {
      const o = { plan: p.plan, expiresAt: Math.max(now(), t.expiresAt || 0) + 30 * 864e5 };
      if (t.status === 'pending') o.status = 'active';          // প্রথম পেমেন্ট নিশ্চিত হলে অ্যাপ চালু
      writes.push({ update: { name: docName('tenants/' + t.id), fields: toF(o) }, updateMask: { fieldPaths: Object.keys(o) } });
    }
    writes.push({ update: { name: docName('payments/' + id), fields: toF({ st: yes ? 'approved' : 'rejected' }) }, updateMask: { fieldPaths: ['st'] } });
    await commit(writes);     // মেয়াদ বাড়ানো ও স্ট্যাটাস বদল — একই ব্যাচে, তাই আংশিক প্রয়োগ/ডাবল-অ্যাড হবে না
    toast(yes ? 'পেমেন্ট অনুমোদিত — ৩০ দিন যুক্ত হয়েছে' : 'প্রত্যাখ্যাত'); await saLoad();
  } catch (e) { toast(msgOf(e)) }
}
const LOCKABLE = () => NAV.filter(n => !['sa', 'dash', 'setup'].includes(n[0]));   // প্যাকেজে চালু/বন্ধ করা যায় এমন পাতা
async function planSave(e) {
  e.preventDefault(); if (!saOk()) return false;
  const f = e.target, d = Object.fromEntries(new FormData(f)), id = String(d.id || '').trim().toLowerCase();
  if (!/^[a-z0-9_]{2,20}$/.test(id) || id === 'none') return toast('আইডি: ইংরেজি ছোট হাতের অক্ষর/সংখ্যা (none নয়)'), false;
  const price = Math.round(+en(d.price)); if (!(price >= 0) || price > 100000) return toast('মূল্য ০ থেকে ১,০০,০০০ টাকার মধ্যে দিন'), false;
  const on = new Set([...f.querySelectorAll('input[name=pg]:checked')].map(x => x.value));
  const lock = LOCKABLE().map(n => n[0]).filter(x => !on.has(x));
  try { await setDoc('plans/' + id, { name: String(d.name || '').trim() || id, price, maxStudents: Math.max(0, Math.round(+en(d.ms)) || 0), maxUsers: Math.max(0, Math.round(+en(d.mu)) || 0), portal: d.portal === '1', lock, perks: lines(String(d.perks || '')), order: +en(d.ord) || 9, note: String(d.note || '') }); toast('প্যাকেজ সংরক্ষিত'); await saLoad() } catch (x) { toast(msgOf(x)) }
  return false;
}
async function planDel(id) {
  if (!saOk()) return; const n = SAD.T.filter(t => t.plan === id).length;
  if (n) return toast('এই প্যাকেজে ' + bn(n) + 'টি মাদরাসা আছে; আগে তাদের অন্য প্যাকেজে সরান');
  if (!confirm('এই প্যাকেজ মুছে ফেলবেন?')) return;
  try { await delDoc('plans/' + id); toast('প্যাকেজ মুছে ফেলা হয়েছে'); await saLoad() } catch (x) { toast(msgOf(x)) }
}
async function platSave(e) {
  e.preventDefault(); if (!saOk()) return false; const d = Object.fromEntries(new FormData(e.target)), o = {};
  for (const k of ['bkash', 'nagad', 'rocket']) { o[k] = en(d[k]).replace(/[^\d]/g, ''); if (!/^\d{10,15}$/.test(o[k])) return toast('নম্বরটি সঠিক নয় (১০–১৫ সংখ্যা): ' + { bkash: 'বিকাশ', nagad: 'নগদ', rocket: 'রকেট' }[k]), false }
  try { await setDoc('platform/settings', o); PLAT = o; toast('পেমেন্ট নম্বর সংরক্ষিত — সব মাদরাসার পেমেন্ট পাতায় এখন থেকে এই নম্বর দেখাবে'); await saLoad() } catch (x) { toast(msgOf(x)) }
  return false;
}
const planForm = p => {
  const isNew = !p.id, lk = p.lock || [];
  return `<form onsubmit="return FBX.planSave(event)" style="border-top:1px solid var(--b);padding-top:10px;margin-top:10px">${isNew ? '' : `<div class="row"><b style="font-size:17px">${esc(p.name)}</b><b>${tk(p.price)}/মাস</b></div>`}<div class="fg">${inp('আইডি (ইংরেজি)', 'id', `required value="${esc(p.id || '')}" ${p.id ? 'readonly' : ''}`)}${inp('নাম', 'name', `required value="${esc(p.name || '')}"`)}${inp('মাসিক মূল্য (৳)', 'price', `required inputmode="numeric" value="${p.price || 0}"`)}${inp('সর্বোচ্চ শিক্ষার্থী (০=সীমাহীন)', 'ms', `inputmode="numeric" value="${p.maxStudents || 0}"`)}${inp('সর্বোচ্চ ইউজার (০=সীমাহীন)', 'mu', `inputmode="numeric" value="${p.maxUsers || 0}"`)}${inp('ক্রম', 'ord', `inputmode="numeric" value="${p.order || 9}"`)}</div>
  <div style="margin-top:8px"><b style="font-size:14px">✅ চালু ফিচার <small style="font-weight:400;color:var(--m)">(টিক দেওয়া পাতা এই প্যাকেজে পাওয়া যাবে)</small></b>${LOCKABLE().map(n => `<label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" name="pg" value="${esc(n[0])}" ${isNew || !lk.includes(n[0]) ? 'checked' : ''} style="width:auto;margin:0"> ${esc(n[2])} ${esc(n[1])}</label>`).join('')}</div>
  <label>শিক্ষার্থী পোর্টাল<select name="portal"><option value="1" ${p.portal ? 'selected' : ''}>আছে</option><option value="0" ${p.portal ? '' : 'selected'}>নেই</option></select></label>
  <label>সুবিধার তালিকা — পেমেন্ট পাতায় যা দেখাবে (প্রতি লাইনে একটি)<textarea name="perks" rows="5">${esc((p.perks || []).join('\n'))}</textarea></label>${inp('মন্তব্য (প্যাকেজের নিচে ছোট লেখা)', 'note', `value="${esc(p.note || '')}"`)}
  <div class="f2" style="margin-top:6px"><button class="btn s">${isNew ? 'প্যাকেজ যোগ করুন' : 'সংরক্ষণ'}</button>${isNew ? '' : `<button type="button" class="x" onclick="FBX.planDel('${jx(p.id)}')">প্যাকেজ মুছুন</button>`}</div></form>`;
};
let SAT = '';
const saTab = t => { SAT = t; render() };
PG.sa = () => {
  if (ROLE() != 'সুপার এডমিন') return '';
  const T = SAD.T, pl = PLANS || DEFPLANS, un = new Set(saUnpaid().map(t => t.id)), vis = T.filter(t => !un.has(t.id)), hid = T.length - vis.length, pt = bdPlat();
  const tab = SAT || (SAD.pay.length ? 'req' : 'mad');
  const tb = (id, l) => `<button class="${tab === id ? 'on' : ''}" onclick="FBX.saTab('${id}')">${l}</button>`;
  const head = SAD.err ? `<div class="card"><b class="rd">লোড হয়নি:</b> ${esc(SAD.err)} <button class="btn s o" onclick="FBX.saLoad()">আবার</button></div>` : !SAD.ok ? '<div class="card"><p class="em">লোড হচ্ছে… (ইন্টারনেট দরকার)</p></div>' : '';
  let body = '';
  if (tab === 'req') {
    body = `<div class="card"${SAD.pay.length ? ' style="border:2px solid var(--p)"' : ''}><b>💳 পেমেন্ট অনুরোধ (${bn(SAD.pay.length)})</b><p class="em" style="text-align:left">শুধু যারা পেমেন্ট জমা দিয়েছেন তাদের অনুরোধই এখানে আসে। বিকাশ/নগদ/রকেটের অ্যাপে TrxID ও টাকা মিলিয়ে অনুমোদন দিন; অনুমোদনে ৩০ দিন যুক্ত হয়।</p>${SAD.pay.map(p => { const t = T.find(x => x.id === p.t), pr = planOf(p.plan).price; return `<div class="row" style="flex-wrap:wrap"><div style="flex:1;min-width:170px"><b>${esc(t ? t.name : 'মুছে ফেলা মাদরাসা')}</b><small>${esc(planOf(p.plan).name)} · ${tk(p.amt)} · ${esc(p.method)} · TrxID ${esc(p.trx)} · ${esc(p.from)} · ${dt(p.at)}</small>${pr && p.amt !== pr ? `<small class="rd">⚠ প্যাকেজের বর্তমান মূল্য ${tk(pr)}; পাঠানো টাকা মিলিয়ে দেখুন</small>` : ''}</div><div class="r" style="gap:6px">${t ? `<button class="btn s" onclick="FBX.payOk('${jx(p.id)}',1)">অনুমোদন</button>` : ''}<button class="x" onclick="FBX.payOk('${jx(p.id)}',0)">বাতিল</button></div></div>` }).join('') || '<p class="em">কোনো পেমেন্ট অনুরোধ নেই</p>'}</div>`;
  } else if (tab === 'mad') {
    body = `<div class="card"><details><summary>＋ নতুন মাদরাসার একাউন্ট তৈরি</summary><form onsubmit="return FBX.saNew(event)">${inp('মাদরাসার নাম', 'name', 'required')}${inp('অ্যাডমিনের নাম', 'an', 'required')}${inp('অ্যাডমিনের Gmail (লগইন আইডি)', 'em', 'required type="email" inputmode="email"')}<label>অস্থায়ী পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)<input type="password" name="pw" required minlength="8" autocomplete="new-password"></label><label>প্যাকেজ<select name="plan">${pl.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label><button class="btn">একাউন্ট তৈরি করুন</button></form></details></div>
  <div class="card"><b>🏫 মাদরাসার একাউন্টসমূহ (${bn(vis.length)})</b>${vis.map(t => `<div class="row" style="flex-wrap:wrap"><div style="flex:1;min-width:170px"><b>${esc(t.name)}</b><small>${stBadge(t.status)} · প্যাকেজ: ${esc(planOf(t.plan).name)} · মেয়াদ: ${t.expiresAt ? dt(t.expiresAt) + (t.expiresAt < now() ? ' <span class="rd">(শেষ)</span>' : '') : 'মেয়াদহীন'}</small></div><div class="r" style="gap:6px;flex-wrap:wrap"><button class="btn s" onclick="FBX.saEnter('${jx(t.id)}')">প্রবেশ</button><select onchange="FBX.saPlan('${jx(t.id)}',this.value)" style="width:auto">${pl.map(p => `<option value="${esc(p.id)}" ${p.id === t.plan ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select><button class="btn s o" onclick="FBX.saExt('${jx(t.id)}',30)">+১ মাস</button><button class="btn s o" onclick="FBX.saExt('${jx(t.id)}',365)">+১ বছর</button><button class="btn s o" onclick="FBX.saExt('${jx(t.id)}',0)">মেয়াদহীন</button>${t.status === 'pending' ? '' : `<button class="btn s o" onclick="FBX.saTog('${jx(t.id)}')">${t.status === 'suspended' ? 'চালু করুন' : 'বন্ধ করুন'}</button>`}<button class="btn s o" onclick="FBX.saReset('${jx(t.id)}')">অ্যাডমিন পাসওয়ার্ড রিসেট</button><button class="x" onclick="if(!this.dataset.s){this.dataset.s=1;this.textContent='নিশ্চিত? ক্লাউডের সব তথ্য মুছবে';return}FBX.saDel('${jx(t.id)}')">🗑 মুছুন</button></div></div>`).join('') || '<p class="em">কোনো একাউন্ট নেই</p>'}${hid ? `<p class="em" style="text-align:left">পেমেন্ট জমা না দেওয়া ${bn(hid)}টি অসম্পূর্ণ নিবন্ধন তালিকায় দেখানো হচ্ছে না। <button class="btn s o" onclick="FBX.saClean()">এগুলো মুছে ফেলুন</button></p>` : ''}</div>`;
  } else if (tab === 'pkg') {
    body = `<div class="card"><b>📦 প্যাকেজ — মূল্য ও সুবিধা</b><p class="em" style="text-align:left">মূল্য, সীমা, চালু ফিচার ও সুবিধার তালিকা যেকোনো সময় বদলানো যায়। সংরক্ষণ করলে সব মাদরাসার পেমেন্ট পাতায় নতুন মূল্য/সুবিধা দেখাবে; ফিচার বদল চালু মাদরাসাগুলোতেও কার্যকর হবে।</p>${pl.map(planForm).join('')}<details style="margin-top:12px"><summary>＋ নতুন প্যাকেজ</summary>${planForm({})}</details></div>`;
  } else {
    body = `<div class="card"><b>💳 পেমেন্ট নম্বর</b><p class="em" style="text-align:left">মাদরাসাগুলো এই নম্বরে Send Money করবে। বদলালে সব মাদরাসার পেমেন্ট পাতায় সাথে সাথে নতুন নম্বর দেখাবে।</p><form onsubmit="return FBX.platSave(event)"><div class="fg">${inp('বিকাশ', 'bkash', `required inputmode="tel" value="${esc(pt.bkash)}"`)}${inp('নগদ', 'nagad', `required inputmode="tel" value="${esc(pt.nagad)}"`)}${inp('রকেট', 'rocket', `required inputmode="tel" value="${esc(pt.rocket)}"`)}</div><button class="btn">সংরক্ষণ</button></form></div>
  <div class="card"><b>সুপার এডমিন: ${esc(CTX.name || '')}</b><small>UID: ${esc(CTX.uid)}</small><div class="f2" style="margin-top:8px"><button class="btn s o" onclick="FBX.cpw()">🔑 পাসওয়ার্ড বদলান</button><button class="btn s o" onclick="FBX.saLoad()">⟳ রিফ্রেশ</button></div></div>`;
  }
  return `${head}<div class="xt">${tb('req', '💳 পেমেন্ট' + (SAD.pay.length ? ' (' + bn(SAD.pay.length) + ')' : ''))}${tb('mad', '🏫 মাদরাসা')}${tb('pkg', '📦 প্যাকেজ')}${tb('set', '⚙️ পেমেন্ট নম্বর')}</div>${body}`;
};

/* ---------- সাবস্ক্রিপশন (মাদরাসার অ্যাডমিনের পাতা) ---------- */
async function payLoad() { try { const rs = await runQuery('', { from: [{ collectionId: 'payments' }], where: { fieldFilter: { field: { fieldPath: 't' }, op: 'EQUAL', value: { stringValue: TN } } }, limit: 20 }); PAYS = rs.filter(x => x.document).map(x => { const d = dd(x.document); d.id = d._id; return d }).sort((a, b) => b.at - a.at) } catch (e) { PAYS = PAYS || [] } if (page === 'setup' || (CTX && !CTX.sa && TM && (TM.st === 'pending' || isExp()))) render() }
async function payReq(e) {
  e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)), p = planOf(d.plan);
  if (!navigator.onLine) return toast('ইন্টারনেট দরকার'), false;
  const trx = String(en(d.trx)).replace(/[^A-Za-z0-9]/g, '').toUpperCase(), mk = { 'বিকাশ': 'b', 'নগদ': 'n', 'রকেট': 'r' }[d.method], from = en(d.from).trim();
  if (!mk || !/^[A-Z0-9]{6,30}$/.test(trx)) return toast('ট্রানজ্যাকশন আইডি সঠিক নয় (৬-৩০ অক্ষর/সংখ্যা)'), false;
  if (!p.price) return toast('প্যাকেজ বেছে নিন'), false;
  try { await createDoc('payments/tx_' + trx, { t: TN, plan: p.id, amt: p.price, method: d.method, mk, trx, from, st: 'pending', at: now() }); toast('পেমেন্ট জমা হয়েছে — যাচাইয়ের পর অ্যাপ চালু হবে'); e.target.reset(); PAYS = null; payLoad() }
  catch (x) { toast(/ALREADY_EXISTS|PERMISSION|already/i.test(String(x.message)) ? 'এই ট্রানজ্যাকশন আইডি আগেই জমা হয়েছে বা সঠিক নয়' : msgOf(x)) }
  return false;
}
function subCard() {
  if (!TM || !CTX || CTX.none || (CTX.sa && !TN) || CTX.role === 'student') return '';
  if (PAYS === null && CTX.role === 'admin' && navigator.onLine) { PAYS = []; payLoad() }
  const p = planOf(TM.plan), pt = bdPlat(), pl = (PLANS || DEFPLANS).filter(x => x.price > 0);
  return `<div class="card"><b>💎 সাবস্ক্রিপশন</b><div class="row"><span>প্যাকেজ</span><b>${esc(p.name)}${p.price ? ' · ' + tk(p.price) + '/মাস' : ''}</b></div><div class="row"><span>মেয়াদ</span><b class="${isExp() ? 'rd' : ''}">${TM.exp ? dt(TM.exp) + (isExp() ? ' (শেষ)' : '') : 'মেয়াদহীন'}</b></div><div class="row"><span>শিক্ষার্থী সীমা</span><b>${p.maxStudents ? bn((S.students || []).length) + '/' + bn(p.maxStudents) : 'সীমাহীন'}</b></div><div class="row"><span>ইউজার সীমা</span><b>${p.maxUsers ? bn((MEM || []).length) + '/' + bn(p.maxUsers) : 'সীমাহীন'}</b></div>
  ${CTX.role === 'admin' ? `<details style="margin-top:8px"><summary>প্যাকেজ নবায়ন / আপগ্রেড</summary><p class="em" style="text-align:left">বিকাশ ${pnum(pt.bkash)} · নগদ ${pnum(pt.nagad)} · রকেট ${pnum(pt.rocket)} (পার্সোনাল, Send Money)। টাকা পাঠিয়ে নিচের ফর্ম পূরণ করুন।</p><form onsubmit="return FBX.payReq(event)"><label>প্যাকেজ<select name="plan">${pl.map(x => `<option value="${esc(x.id)}">${esc(x.name)} — ${tk(x.price)}</option>`).join('')}</select></label>${sel('মাধ্যম', 'method', ['বিকাশ', 'নগদ', 'রকেট'])}${inp('ট্রানজ্যাকশন আইডি', 'trx', 'required')}${inp('যে নম্বর থেকে পাঠিয়েছেন', 'from', 'required inputmode="tel"')}<button class="btn">অনুরোধ পাঠান</button></form>${(PAYS || []).map(x => `<div class="row"><span>${dt(x.at)} · ${esc(planOf(x.plan).name)}</span><b>${x.st === 'approved' ? 'অনুমোদিত' : x.st === 'rejected' ? 'বাতিল' : 'অপেক্ষমাণ'}</b></div>`).join('')}</details>` : ''}</div>`;
}

/* ---------- ক্লাউড কার্ড, গেট স্ক্রিন, ব্যানার ---------- */
function cloudUI() {
  if (!CTX || CTX.none) return '';
  const p = Object.keys(SY.pn).length, stu = CTX.role === 'student' && !CTX.sa;
  return subCard() + `<div class="card"><b>☁ ক্লাউড সিঙ্ক ও অ্যাকাউন্ট</b><p class="em" style="text-align:left">ডেটা আপনার মাদরাসার আলাদা Firebase অংশে সংরক্ষিত হয়; ইন্টারনেট না থাকলে এই ডিভাইসে জমা থাকে ও পরে নিজে থেকে সিঙ্ক হয়। 🟢 অনলাইন · ⚪ অফলাইন · ☁✓ সিঙ্ক সম্পূর্ণ · ☁⏳ আপলোড বাকি।</p>
  <div class="row"><span>ব্যবহারকারী</span><b>${esc(CTX.name || CTX.em || '')} · ${esc(CTX.sa ? 'সুপার এডমিন' : RC[CTX.role] || '')}</b></div>
  <div class="row"><span>মাদরাসা</span><b>${esc(TM ? TM.name : '—')}</b></div>
  <div class="row"><span>অবস্থা</span><b>${navigator.onLine ? 'অনলাইন' : 'অফলাইন'} · ${SY.err && SY.err != 'reauth' ? '<span class="rd">' + esc(SY.err) + '</span>' : p ? 'আপলোড বাকি: ' + bn(p) : 'আপ-টু-ডেট'}</b></div>
  <div class="row"><span>সর্বশেষ সিঙ্ক</span><b>${SY.last ? new Date(SY.last).toLocaleString('bn-BD', { hour12: true }) : '—'}</b></div>
  <div class="f2" style="margin-top:10px"><button class="btn" onclick="FBX.sync('connect');toast('সিঙ্ক শুরু')">এখনই সিঙ্ক</button>${stu ? '' : '<button class="btn o" onclick="if(!this.dataset.s){this.dataset.s=1;this.textContent=\'নিশ্চিত?\';return}FBX.resync()">ক্লাউড থেকে নতুন করে মেলান</button>'}</div>
  <div class="f2" style="margin-top:10px"><button class="btn o" onclick="FBX.cpw()">🔑 পাসওয়ার্ড বদলান</button><button class="btn" style="background:var(--r)" onclick="logout()">লগআউট</button></div>
  ${stu || ls.g(K + ':pre') === null ? '' : '<div class="f2" style="margin-top:10px"><button class="btn o" onclick="FBX.undoRestore()">↶ শেষ রিস্টোর বাতিল করুন</button></div>'}
  ${stu || p ? '' : '<div style="margin-top:10px"><button class="btn s o" onclick="FBX.wipe()">এই ডিভাইস থেকে মাদরাসার ডেটা মুছুন (ক্লাউডে থাকবে)</button></div>'}</div>`;
}
const gcard = (t, h) => `<div class="card" style="max-width:520px;margin:24px auto"><h3 style="margin:0 0 8px">${t}</h3>${h}</div>`;
let PLATTRY = 0;
function payGate(kind) {
  const out = '<div class="f2" style="margin-top:12px"><button class="btn" style="background:var(--r)" onclick="logout()">লগআউট</button></div>';
  const title = kind === 'exp' ? '⏰ সাবস্ক্রিপশনের মেয়াদ শেষ' : '💳 মাসিক প্যাকেজ বেছে নিন';
  if (CTX.role !== 'admin') return gcard(title, `<p class="em" style="text-align:left"><b>${esc(TM.name)}</b>-এর সাবস্ক্রিপশন এখন চালু নেই। মাদরাসার অ্যাডমিনকে মাসিক পেমেন্ট সম্পন্ন করতে বলুন।</p><button class="btn" onclick="FBX.connect().then(()=>render())">⟳ আবার দেখুন</button>${out}`);
  if (navigator.onLine) {
    if (PLANS === null) plansLoad().then(() => render());
    if (PAYS === null) { PAYS = []; payLoad() }
    if (!PLAT && !PLATTRY) { PLATTRY = 1; getDoc('platform/settings').then(x => { PLAT = x; render() }).catch(() => { }) }
  }
  const pt = bdPlat(), pl = (PLANS || DEFPLANS).filter(x => x.price > 0), P = PAYS || [], pendP = P.some(x => x.st === 'pending');
  return `<div style="max-width:560px;margin:16px auto">
  <div class="card"><h3 style="margin:0 0 6px">${title}</h3><p class="em" style="text-align:left"><b>${esc(TM.name)}</b> চালু করতে একটি প্যাকেজ বেছে মাসিক পেমেন্ট করুন। পেমেন্ট যাচাই হলেই অ্যাপ চালু হবে।</p>${pendP ? '<p class="rd" style="text-align:left"><b>⏳ আপনার পেমেন্ট যাচাইয়ের অপেক্ষায় আছে।</b></p>' : ''}</div>
  ${pl.map(p => `<div class="card"><div class="row"><b style="font-size:18px">${esc(p.name)}</b><b style="font-size:18px">${tk(p.price)}/মাস</b></div>${p.note ? `<small style="color:var(--m)">${esc(p.note)}</small>` : ''}<div style="margin-top:6px">${(p.perks || []).map(x => `<div>✔ ${esc(x)}</div>`).join('')}</div></div>`).join('')}
  <div class="card"><b>পেমেন্ট নম্বর (Send Money — পার্সোনাল)</b><div class="row"><span>বিকাশ</span><b style="user-select:all">${pnum(pt.bkash)}</b></div><div class="row"><span>নগদ</span><b style="user-select:all">${pnum(pt.nagad)}</b></div><div class="row"><span>রকেট</span><b style="user-select:all">${pnum(pt.rocket)}</b></div></div>
  <div class="card"><b>টাকা পাঠানোর পর তথ্য দিন</b><form onsubmit="return FBX.payReq(event)"><label>প্যাকেজ<select name="plan">${pl.map(x => `<option value="${esc(x.id)}">${esc(x.name)} — ${tk(x.price)}</option>`).join('')}</select></label>${sel('মাধ্যম', 'method', ['বিকাশ', 'নগদ', 'রকেট'])}${inp('ট্রানজ্যাকশন আইডি (TrxID)', 'trx', 'required')}${inp('যে নম্বর থেকে পাঠিয়েছেন', 'from', 'required inputmode="tel"')}<button class="btn">পেমেন্ট জমা দিন</button></form></div>
  ${P.length ? `<div class="card"><b>পেমেন্টের অবস্থা</b>${P.map(x => `<div class="row"><span>${dt(x.at)} · ${esc(planOf(x.plan).name)} · ${esc(x.method)}</span><b class="${x.st === 'rejected' ? 'rd' : ''}">${x.st === 'approved' ? 'অনুমোদিত' : x.st === 'rejected' ? 'বাতিল' : 'অপেক্ষমাণ'}</b></div>`).join('')}</div>` : ''}
  <div class="card"><div class="f2"><button class="btn" onclick="FBX.connect().then(()=>render())">⟳ অনুমোদন হয়েছে কি দেখুন</button><button class="btn o" onclick="abFile()">↓ JSON ব্যাকআপ</button></div>${out}</div></div>`;
}
function gate() {
  if (!CTX) return '';
  const out = '<div class="f2" style="margin-top:12px"><button class="btn" style="background:var(--r)" onclick="logout()">লগআউট</button></div>';
  if (CTX.none) {
    if (CTX.unv) return gcard('✉️ Gmail যাচাই করুন', `<p class="em" style="text-align:left"><b>${esc(CTX.em)}</b>-এ একটি যাচাইকরণ ইমেইল পাঠানো হয়েছে। ইমেইলের লিংকে ক্লিক করুন (না পেলে স্প্যাম/প্রমোশন ফোল্ডার দেখুন), তারপর নিচের বাটন চাপুন।</p><div class="f2"><button class="btn" onclick="FBX.verCheck()">আমি যাচাই করেছি</button><button class="btn o" onclick="FBX.verResend()">আবার পাঠান</button></div>${out}`);
    if (CTX.off) return gcard('🚫 অ্যাকাউন্ট বন্ধ', `<p class="em" style="text-align:left">আপনার অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।</p>${out}`);
    return gcard('ℹ️ কোনো মাদরাসার সাথে যুক্ত নন', `<p class="em" style="text-align:left">নতুন মাদরাসার অ্যাডমিন হলে নিচে নিবন্ধন সম্পূর্ণ করুন। অন্য কারও দেওয়া অ্যাকাউন্ট হলে অ্যাডমিনের সাথে যোগাযোগ করুন।</p><form onsubmit="return FBX.regComplete(event)">${inp('মাদরাসার নাম', 'name', 'required')}${inp('অ্যাডমিনের নাম', 'an', 'required')}<button class="btn">নিবন্ধন সম্পূর্ণ করুন</button></form><details style="margin-top:10px"><summary>প্ল্যাটফর্ম মালিক (Super Admin)?</summary><p class="em" style="text-align:left">Firebase Console → Firestore → <b>superAdmins</b> কালেকশনে Document ID হিসেবে নিচের UID দিয়ে একটি ডকুমেন্ট বানান (ফিল্ড: name = আপনার নাম), তারপর লগআউট করে আবার লগইন করুন।</p><div style="font-weight:700;word-break:break-all;user-select:all;padding:10px;border:2px dashed var(--p);border-radius:10px">${esc(CTX.uid)}</div></details>${out}`);
  }
  if (CTX.sa) return '';
  if (!TM) return gcard('লোড হচ্ছে…', `<p class="em">মাদরাসার তথ্য আনা যায়নি। ইন্টারনেট চালু করে আবার চেষ্টা করুন।</p><button class="btn" onclick="FBX.connect()">আবার চেষ্টা</button>${out}`);
  if (TM.st === 'suspended') return gcard('🚫 মাদরাসা বন্ধ আছে', `<p class="em" style="text-align:left">এই মাদরাসার অ্যাক্সেস বন্ধ। Super Admin-এর সাথে যোগাযোগ করুন।</p>${out}`);
  if (TM.st === 'pending') return payGate('new');
  if (isExp()) return payGate('exp');
  if (CTX.mc) return gcard('🔑 নতুন পাসওয়ার্ড দিন', `<p class="em" style="text-align:left">আপনার পাসওয়ার্ড অস্থায়ী। চালিয়ে যেতে নিজের নতুন পাসওয়ার্ড দিন।</p><form onsubmit="event.preventDefault();FBX.cpw(this.p.value)"><label>নতুন পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)<input type="password" name="p" required minlength="8" autocomplete="new-password"></label><button class="btn">সংরক্ষণ</button></form>${out}`);
  return '';
}
function banners() {
  if (!CTX || CTX.none || !$('#main') || $('#fbn')) return;
  const h = [];
  if (isExp()) h.push('<b class="rd">⚠ সাবস্ক্রিপশনের মেয়াদ শেষ</b> — এখন শুধু দেখা ও ব্যাকআপ নেওয়া যাবে। সেটিং থেকে নবায়ন করুন।');
  if (SY.err === 'reauth' && CTX.role !== 'student' || SY.err === 'reauth') h.push('অনলাইন সিঙ্ক বন্ধ আছে। <a style="cursor:pointer;color:var(--p)" onclick="FBX.reauth()">পাসওয়ার্ড দিয়ে চালু করুন</a>');
  if (SY.hold) h.push(`<b class="rd">⚠ একসাথে ${bn(SY.hold.length)}টি রেকর্ড মুছে গেছে।</b> ভুলে হলে ক্লাউড থেকে ফিরিয়ে আনুন। <div class="f2" style="margin-top:6px"><button class="btn s o" onclick="FBX.holdNo()">ফিরিয়ে আনুন</button><button class="btn s" onclick="FBX.holdOk()">মোছা নিশ্চিত করুন</button></div>`);
  if (SY.conf.length) h.push(`অন্য ডিভাইসের নতুন পরিবর্তনের কারণে ${bn(SY.conf.length)}টি পরিবর্তন প্রতিস্থাপিত হয়েছে। <div class="f2" style="margin-top:6px"><button class="btn s o" onclick="FBX.confKeep()">আমারটা রাখুন</button><button class="btn s" onclick="FBX.confClear()">ঠিক আছে</button></div>`);
  if (SY.big && SY.big.length) h.push('<b class="rd">কিছু রেকর্ড (ছবিসহ) খুব বড়; ছবি ছোট করে আবার সংরক্ষণ করুন।</b>');
  if (h.length) $('#main').insertAdjacentHTML('afterbegin', `<div id="fbn" class="card" style="border:2px solid #dc2626">${h.join('<hr style="border:0;border-top:1px solid var(--b)">')}</div>`);
}
const render0w = W.render;
W.render = function () { render0w(); try { banners() } catch (e) { } };

/* ---------- ব্যাকআপ / রিস্টোর (মাদরাসাভিত্তিক) ---------- */
const bk = () => Object.assign(stripSec(S), { _meta: { app: 'ilmora', v: 2, tid: TN || 'main', inst: S.inst, ts: new Date().toISOString() } });
function restoreApp(o) {
  if (!canAdm()) return toast('শুধু অ্যাডমিন রিস্টোর করতে পারেন');
  if (isExp()) return toast('মেয়াদ শেষ; রিস্টোর বন্ধ');
  const meta = o._meta; if (meta && meta.tid && TN && meta.tid !== TN) return toast('এই ব্যাকআপ অন্য মাদরাসার ("' + (meta.inst || meta.tid) + '"); এখানে রিস্টোর করা যাবে না');
  ls.s(K + ':pre', JSON.stringify({ ts: now(), S: stripSec(S) }));
  const users = S.users; S = Object.assign(JSON.parse(SDEF), o); delete S._meta; S.users = users || [];
  ls.s(K, JSON.stringify(S)); scan(true); syPersist(); SY.pubDirty = 1; render(); toast('রিস্টোর হয়েছে; ক্লাউডে সিঙ্ক হচ্ছে'); sync('push');
}
function undoRestore() {
  const o = jp(ls.g(K + ':pre'), null); if (!o) return toast('আগের অবস্থা নেই');
  const users = S.users; S = Object.assign(JSON.parse(SDEF), o.S); S.users = users || []; ls.s(K, JSON.stringify(S)); scan(true); syPersist(); ls.r(K + ':pre'); render(); sync('push'); toast('আগের অবস্থায় ফেরানো হয়েছে')
}
function restoreFile(o) { if (!validAppData(o)) throw 0; restoreApp(o) }
function restoreText(txt) { try { const o = safeParse(txt); if (!validAppData(o)) throw 0; restoreApp(o) } catch (e) { toast('ব্যাকআপ সঠিক নয়') } }
function resync() { SY.pt = 0; syPersist(); sync('connect') }
function wipe() {
  if (Object.keys(SY.pn).length) return toast('আপলোড বাকি আছে; আগে সিঙ্ক করুন');
  if (!confirm('এই ডিভাইস থেকে মাদরাসার স্থানীয় ডেটা মুছে লগআউট হবে। ক্লাউডের ডেটা অক্ষত থাকবে। নিশ্চিত?')) return;
  ['', ':sh', ':pn', ':pt', ':cf', ':ph', ':ls', ':pre'].forEach(s => ls.r(K + s)); logout();
}

/* ---------- শিক্ষার্থী পোর্টালের ফলাফল ---------- */
SPG.exams = () => {
  const R = S._portal || [];
  return R.map(r => !r.pub ? `<div class="card"><b>${esc(r.name)}</b><p class="em">ফলাফল এখনো প্রকাশিত হয়নি</p></div>` : `<div class="card"><b>${esc(r.name)}</b>${r.year ? `<small>${esc(r.year)}</small>` : ''}${r.subs.map(b => `<div class="row"><span>${esc(b.n)}</span><b>${esc(b.raw || '—')} / ${bn(b.m)}</b></div>`).join('')}<div class="row"><span>মোট</span><b>${bn(r.tot)} / ${bn(r.full)}</b></div><div class="row"><span>গড়</span><b>${bn(Math.round(r.p * 100) / 100)}%</b></div><div class="row"><span>গ্রেড</span><b class="${r.fail ? 'rd' : 'g'}">${esc(r.g)}</b></div>${r.fail ? '' : `<div class="row"><span>মেধাক্রম</span><b>${bn(r.pos)}</b></div>`}</div>`).join('') || '<div class="card"><p class="em">কোনো পরীক্ষার ফলাফল নেই</p></div>';
};

/* ---------- লগইন পাতা ---------- */
W.loginUI = function () {
  $('#ttl').textContent = 'লগইন'; $('#side').innerHTML = '';
  $('#main').innerHTML = `<div class="card" style="max-width:420px;margin:24px auto"><h3 style="margin:0 0 4px">ILMORA</h3><small style="color:var(--m)">মাদরাসা ম্যানেজমেন্ট সিস্টেম</small>
  <form onsubmit="return login(event)" style="margin-top:10px">${inp('Gmail ঠিকানা', 'em', 'required type="email" inputmode="email" autocomplete="username"')}<label>পাসওয়ার্ড<input type="password" name="pw" required autocomplete="current-password"></label><button class="btn">লগইন</button></form>
  <p style="text-align:center;margin:12px 0 0"><a style="cursor:pointer;color:var(--p)" onclick="FBX.regUI()">🏫 নতুন মাদরাসা নিবন্ধন</a></p>
  <p style="text-align:center;margin:8px 0 0"><a style="cursor:pointer;color:var(--p)" onclick="FBX.forgot()">পাসওয়ার্ড ভুলে গেছেন?</a></p></div>`;
};
W.lockHelp = () => mdl('লগইন করতে পারছেন না?', '<p class="em" style="text-align:left"><b>পাসওয়ার্ড ভুলে গেলে:</b> লগইন পাতায় "পাসওয়ার্ড ভুলে গেছেন?" চাপুন; আপনার Gmail-এ রিসেট লিংক যাবে।<br><b>ইউজার/শিক্ষক/শিক্ষার্থী:</b> অ্যাডমিনও ইউজার পাতা থেকে রিসেট লিংক পাঠাতে পারেন।<br>ইন্টারনেট না থাকলে আগে একবার অনলাইনে লগইন করা ডিভাইসে অফলাইন লগইন চলে।</p>');

/* ---------- অনলাইন হলে ---------- */
function online() { netUI(); if (CTX && !CTX.none) { if (!CC.rt && SESSPW) { auth('signInWithPassword', CTX.em, SESSPW).then(connect).catch(() => { }) } else connect() } }
addEventListener('offline', netUI0);

/* ---------- মূল অ্যাপের সাথে সংযোগ ---------- */
const meF = () => {
  if (!CTX || CTX.none) return null;
  if (CTX.sa) return TN ? { id: CTX.uid, role: 'অ্যাডমিন', name: CTX.name || 'সুপার এডমিন', sa: 1 } : { id: CTX.uid, role: 'সুপার এডমিন', name: CTX.name, sa: 1 };
  const r = RC[CTX.role]; return r ? { id: CTX.uid, role: r, name: CTX.name, sid: CTX.sid || '', st: 'সক্রিয়' } : null;
};
function boot() {
  const o = jp(ls.g(CKEY), null);
  if (o && o.CTX) { CTX = o.CTX; TM = o.TM || null } else { CTX = null; CC = { key: CC.key, pid: CC.pid }; ccSave() }
  if (!ls.g(OFFL) && CTX && !CC.rt && !CTX.none) { /* অফলাইন যাচাই তথ্য নেই; অনলাইনে আবার লগইন লাগবে */ }
  applyCtx(); if (CTX && CTX.sa && !TN) page = 'sa';
  W.__BOOT();
  if (CTX && !CTX.none) setTimeout(connect, 300);
}

/* ---------- Cloudflare R2 ফাইল স্টোরেজ (ঐচ্ছিক; cloudflare-worker/ ফোল্ডার দেখুন) ---------- */
async function cf(method, name, blob) {
  if (!CF_URL) throw new Error('ফাইল স্টোরেজ চালু নেই');
  if (!TN || !safeId(TN) || !/^[A-Za-z0-9_.-]{1,80}$/.test(name)) throw new Error('ফাইলের নাম সঠিক নয়');
  const r = await fetch(CF_URL.replace(/\/$/, '') + '/f/' + TN + '/' + name, { method, headers: Object.assign({ Authorization: 'Bearer ' + await token() }, blob ? { 'Content-Type': blob.type } : {}), body: blob });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return method === 'GET' ? r.blob() : true;
}
W.login = login; W.logout = logout; W.saEnter = saEnter; W.saHome = saHome;
W.FBX = {
  me: meF, ro: isExp, gate, onSave, boot, login, register, regUI, cpw, reauth, cloudUI, within, pageOk, bk, restoreFile, restoreText, undoRestore, resync, wipe, sync, connect, online,
  memAdd, memEdit, memSave, memReset, memToggle, memDel, saLoad, saTab, saClean, planDel, saApprove, saTog, saPlan, saExt, saDel, saEnter, saNew, saReset, payOk, planSave, platSave, payReq, forgot, verCheck, verResend, regComplete, cfPut: (n, b) => cf('PUT', n, b), cfGet: n => cf('GET', n), cfDel: n => cf('DELETE', n),
  holdOk, holdNo, confKeep: conflictsKeep, confClear: () => { SY.conf = []; syPersist(); render() },
  _t: { pubSync, get MEM() { return MEM }, explode, scan, pull, push, SY, applyRemote, get CTX() { return CTX }, set CTX(v) { CTX = v }, get TM() { return TM }, set TM(v) { TM = v }, applyCtx, makeUser, phKey, hs }
};
boot();
})();
