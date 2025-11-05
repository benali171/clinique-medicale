/* app.js — frontend-only clinic demo using localStorage */

// ---------- Utilities ----------
const storage = {
  get(k){ try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch(e){ return null; } },
  set(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
};

function uid(prefix='id'){return prefix + '_' + Math.random().toString(36).slice(2,9);}

// Hijri approx (arithmetical)
function toHijri(d){
  var jd = Math.floor((1461*(d.getFullYear()+4800+Math.floor((d.getMonth()-9)/12)))/4)
         + Math.floor((367*(d.getMonth()+1-2*Math.floor((d.getMonth()+1)/13)))/12)
         - Math.floor((3*Math.floor((d.getFullYear()+4900+Math.floor((d.getMonth()-9)/12))/100))/4)
         + d.getDate() - 32075;
  var l = jd - 1948440 + 10632;
  var n = Math.floor((l-1)/10631);
  l = l - 10631*n + 354;
  var j = (Math.floor((10985-l)/5316))*(Math.floor((50*l)/17719)) + (Math.floor(l/5670))*(Math.floor((43*l)/15238));
  l = l - (Math.floor((30 - j)/15))*(Math.floor((17719*j)/50)) - (Math.floor(j/16))*(Math.floor((15238*j)/43)) + 29;
  var m = Math.floor((24*l)/709);
  var day = l - Math.floor((709*m)/24);
  var month = m;
  var year = 30*n + j - 30;
  return {y:year,m:month,d:day};
}

// Clock
function startClock(){
  const gEl = document.getElementById('gregorian');
  const hEl = document.getElementById('hijri');
  function pad(n){return n<10?'0'+n:n;}
  function tick(){
    const now = new Date();
    gEl && (gEl.innerText = now.getFullYear() + '-' + pad(now.getMonth()+1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds()));
    const h = toHijri(now);
    hEl && (hEl.innerText = h.y + '-' + pad(h.m) + '-' + pad(h.d));
  }
  tick(); setInterval(tick,1000);
}

// Age calc
function calcAgeFromDob(dobStr){
  if(!dobStr) return '';
  const dob = new Date(dobStr);
  if(isNaN(dob)) return '';
  const diff = Date.now() - dob.getTime();
  const ageDt = new Date(diff);
  const years = Math.abs(ageDt.getUTCFullYear() - 1970);
  return years;
}

// ---------- Data init ----------
if(!storage.get('clinic_users')){
  storage.set('clinic_users', [
    {id:'u_admin',name:'admin',pass:'admin',role:'admin'},
    {id:'u_doc',name:'doctor',pass:'doc123',role:'doctor'}
  ]);
}
if(!storage.get('clinic_patients')) storage.set('clinic_patients', []);
if(!storage.get('clinic_meds')) storage.set('clinic_meds', []);
if(!storage.get('clinic_appts')) storage.set('clinic_appts', []);
if(!storage.get('clinic_fin')) storage.set('clinic_fin', []);

// ---------- Auth (client-side simulation) ----------
let currentUser = null;
function login(user, pass){
  const users = storage.get('clinic_users')||[];
  const u = users.find(x => (x.name===user || x.name===user.toLowerCase()) && x.pass===pass);
  if(u){ currentUser = u; sessionStorage.setItem('clinic_user', JSON.stringify(u)); return true; }
  return false;
}
function logout(){
  currentUser = null;
  sessionStorage.removeItem('clinic_user');
}
function loadSession(){
  const s = sessionStorage.getItem('clinic_user');
  if(s){ currentUser = JSON.parse(s); }
}
loadSession();

// ---------- UI helpers ----------
function showView(name){
  document.querySelectorAll('.view').forEach(v => v.style.display='none');
  const el = document.getElementById('view-' + name);
  if(el) el.style.display='block';
  document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.menu-btn').forEach(b => { if(b.dataset.view===name) b.classList.add('active')});
}

// Update user panel
function refreshUserPanel(){
  const avatar = document.getElementById('userAvatar');
  const uname = document.getElementById('userName');
  const urole = document.getElementById('userRole');
  if(currentUser){
    avatar.innerText = (currentUser.name||'U').charAt(0).toUpperCase();
    uname.innerText = currentUser.name;
    urole.innerText = currentUser.role || 'user';
    document.getElementById('loginBox').style.display = 'none';
    document.getElementById('viewContainer').style.display = 'block';
    showView('home');
  } else {
    avatar.innerText = 'G';
    uname.innerText = 'Guest';
    urole.innerText = 'Not logged';
    document.getElementById('loginBox').style.display = 'block';
    document.getElementById('viewContainer').style.display = 'none';
  }
}

// ---------- Patients CRUD ----------
function renderPatients(filter=''){
  const tbody = document.querySelector('#patientsTable tbody');
  tbody.innerHTML = '';
  const list = (storage.get('clinic_patients')||[]).slice().reverse();
  list.forEach(p => {
    if(filter){
      const q = filter.toLowerCase();
      if(!(p.name.toLowerCase().includes(q) || (p.phone||'').toString().includes(q))) return;
    }
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="p-name">${p.name}</td><td class="p-phone">${p.phone}</td><td>${p.age||''}</td><td>${p.country||''}</td><td>${p.state||''}</td><td>${p.last_visit||''}</td>
      <td><button class="btn small" data-id="${p.id}" onclick="editPatient('${p.id}')">تعديل</button> <button class="btn muted small" onclick="deletePatient('${p.id}')">حذف</button></td>`;
    tbody.appendChild(tr);
  });
  // Update ap_patient select list
  const sel = document.getElementById('ap_patient');
  sel.innerHTML = '';
  (storage.get('clinic_patients')||[]).forEach(p => {
    const opt = document.createElement('option'); opt.value = p.id; opt.text = p.name + ' — ' + (p.phone||'');
    sel.appendChild(opt);
  });
}

// Add patient (prevent duplicates)
function addPatient(data){
  const list = storage.get('clinic_patients')||[];
  // duplicate by phone or exact name
  if(list.find(x => x.phone === data.phone || x.name.toLowerCase() === data.name.toLowerCase())){
    return {ok:false, msg:'يوجد مريض بنفس الاسم أو رقم الهاتف بالفعل'};
  }
  data.id = uid('p');
  data.date_premiere = new Date().toISOString();
  list.push(data);
  storage.set('clinic_patients', list);
  return {ok:true, id:data.id};
}
function deletePatient(id){
  if(!confirm('حذف المريض؟')) return;
  let list = storage.get('clinic_patients')||[];
  list = list.filter(x => x.id !== id);
  storage.set('clinic_patients', list);
  renderPatients(document.getElementById('patientSearch').value);
}

// edit (simple prompt)
function editPatient(id){
  const list = storage.get('clinic_patients')||[];
  const p = list.find(x => x.id===id); if(!p) return alert('not found');
  const newName = prompt('الاسم', p.name); if(!newName) return;
  p.name = newName;
  storage.set('clinic_patients', list);
  renderPatients();
}

// ---------- Appointments ----------
function renderAppts(){
  const tbody = document.querySelector('#apTable tbody'); tbody.innerHTML = '';
  const list = storage.get('clinic_appts')||[];
  list.forEach(a=>{
    const p = (storage.get('clinic_patients')||[]).find(x => x.id===a.patientId);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p?p.name:'-'} (${p?p.phone:''})</td><td>${a.doctor}</td><td>${a.datetime}</td><td>${a.status||'scheduled'}</td>
      <td><button class="btn small" onclick="cancelAppt('${a.id}')">إلغاء</button></td>`;
    tbody.appendChild(tr);
  });
}
function scheduleReminder(appt){
  // simple: if appointment within next 24h and page open, setTimeout until appointment time and alert
  const when = new Date(appt.datetime).getTime();
  const now = Date.now();
  const diff = when - now;
  if(diff > 0 && diff < 1000*60*60*24){
    setTimeout(()=> {
      // show notification (in-page)
      alert('تذكير: لديك موعد مع ' + appt.doctor + ' في ' + appt.datetime);
    }, diff);
  }
}
function bookAppt(patientId, datetime, doctor, reason){
  const list = storage.get('clinic_appts')||[];
  const ap = {id:uid('ap'), patientId, datetime, doctor, reason, status:'scheduled', created:new Date().toISOString()};
  list.push(ap); storage.set('clinic_appts', list);
  scheduleReminder(ap);
  return ap;
}
function cancelAppt(id){
  if(!confirm('إلغاء الموعد؟')) return;
  let list = storage.get('clinic_appts')||[]; list = list.filter(x=>x.id!==id); storage.set('clinic_appts', list); renderAppts();
}

// ---------- Pharmacy ----------
function renderMeds(){
  const tbody = document.querySelector('#medTable tbody'); tbody.innerHTML = '';
  (storage.get('clinic_meds')||[]).forEach(m=>{
    const tr=document.createElement('tr'); tr.innerHTML = `<td>${m.name}</td><td>${m.stock}</td><td>${m.exp||''}</td><td>${m.supplier||''}</td><td><button class="btn small" onclick="deleteMed('${m.id}')">حذف</button></td>`;
    tbody.appendChild(tr);
  });
}
function addMed(data){
  const list = storage.get('clinic_meds')||[];
  const existing = list.find(x=>x.name.toLowerCase()===data.name.toLowerCase());
  if(existing){ existing.stock = (parseInt(existing.stock)||0) + parseInt(data.stock||0); existing.exp = data.exp; existing.supplier = data.supplier; }
  else { data.id = uid('m'); list.push(data); }
  storage.set('clinic_meds', list);
}

// ---------- Finance ----------
function renderFin(){
  const tbody = document.querySelector('#financeTable tbody'); tbody.innerHTML = '';
  (storage.get('clinic_fin')||[]).forEach(f=>{
    const tr = document.createElement('tr'); tr.innerHTML = `<td>${f.desc}</td><td>${f.amount}</td><td>${f.type}</td><td>${new Date(f.when).toLocaleString()}</td>`;
    tbody.appendChild(tr);
  });
}
function addFin(desc, amount, type){
  const list = storage.get('clinic_fin')||[];
  list.push({id:uid('f'),desc,amount, type, when:new Date().toISOString()});
  storage.set('clinic_fin', list);
}

// ---------- Users (admin) ----------
function renderUsers(){
  const box = document.getElementById('usersList'); box.innerHTML = '';
  const list = storage.get('clinic_users')||[];
  list.forEach(u=>{
    const div = document.createElement('div'); div.className='small'; div.innerText = u.name + ' — ' + u.role + ' ';
    const del = document.createElement('button'); del.className='btn small muted'; del.innerText='حذف'; del.onclick = ()=>{ if(confirm('حذف المستخدم؟')){ storage.set('clinic_users', list.filter(x=>x.id!==u.id)); renderUsers(); } };
    div.appendChild(del); box.appendChild(div);
  });
}
function addUser(name, pass, role){
  const list = storage.get('clinic_users')||[];
  if(list.find(x=>x.name===name)) return false;
  list.push({id:uid('u'),name,pass,role}); storage.set('clinic_users', list); return true;
}

// ---------- Init UI & events ----------
document.addEventListener('DOMContentLoaded', ()=>{

  startClock();

  // language switch (client-side only: just adjust placeholders)
  const langSel = document.getElementById('langSelect');
  langSel.value = localStorage.getItem('clinic_lang') || 'ar';
  langSel.addEventListener('change', ()=>{ localStorage.setItem('clinic_lang', langSel.value); alert('Language switched (UI labels static in this demo).'); });

  // menu buttons
  document.querySelectorAll('.menu-btn').forEach(b => {
    b.addEventListener('click', ()=> showView(b.dataset.view));
  });

  // login
  document.getElementById('btnLogin').addEventListener('click', ()=>{
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    if(login(user, pass)){ document.getElementById('loginMsg').innerText=''; refreshUserPanel(); renderPatients(); renderAppts(); renderMeds(); renderFin(); renderUsers(); } else {
      document.getElementById('loginMsg').innerText='خطأ: بيانات الدخول غير صحيحة';
    }
  });

  document.getElementById('btnLogout').addEventListener('click', ()=>{ logout(); refreshUserPanel(); });

  // signup modal
  const signupModal = document.getElementById('signupModal');
  document.getElementById('btnOpenSignup').addEventListener('click', ()=>{ signupModal.style.display='block'; });
  document.getElementById('btnCloseSignup').addEventListener('click', ()=>{ signupModal.style.display='none'; });
  document.getElementById('btnSignup').addEventListener('click', ()=>{
    const name = document.getElementById('su_name').value.trim();
    const phone = document.getElementById('su_phone').value.trim();
    const pass = document.getElementById('su_pass').value.trim();
    if(!name || !phone || !pass) return alert('املأ الحقول');
    // create user in users + create patient
    if(!addUser(name, pass, 'patient')){ return alert('اسم المستخدم موجود'); }
    const res = addPatient({name, phone}); if(!res.ok) return alert(res.msg);
    document.getElementById('signupMsg').innerText = 'تم إنشاء الحساب. يمكنك الآن تسجيل الدخول.';
  });

  // add patient
  document.getElementById('p_dob').addEventListener('change', e=>{ document.getElementById('p_age').value = calcAgeFromDob(e.target.value); });
  document.getElementById('btnAddPatient').addEventListener('click', ()=>{
    const data = {
      name: document.getElementById('p_name').value.trim(),
      phone: document.getElementById('p_phone').value.trim(),
      date_naissance: document.getElementById('p_dob').value || '',
      age: document.getElementById('p_age').value || '',
      sex: document.getElementById('p_sex').value,
      country: document.getElementById('p_country').value,
      state: document.getElementById('p_state').value,
      last_visit: document.getElementById('p_lastvisit').value,
      adresse: document.getElementById('p_address').value || '',
      maladie: document.getElementById('p_notes').value || ''
    };
    if(!data.name || !data.phone) return alert('الاسم والهاتف مطلوبان');
    const res = addPatient(data);
    if(!res.ok){ document.getElementById('patientMsg').innerText = res.msg; document.getElementById('patientMsg').style.color='red'; }
    else { document.getElementById('patientMsg').innerText = 'تمت الإضافة'; document.getElementById('patientMsg').style.color='green'; renderPatients(); }
  });

  // live search
  document.getElementById('patientSearch').addEventListener('input', e=> renderPatients(e.target.value));

  // appointments
  document.getElementById('btnBook').addEventListener('click', ()=>{
    const pid = document.getElementById('ap_patient').value;
    const dt = document.getElementById('ap_datetime').value;
    const doctor = document.getElementById('ap_doctor').value;
    const reason = document.getElementById('ap_reason').value;
    if(!pid || !dt) return alert('اختر مريض وتاريخ');
    const ap = bookAppt(pid, dt, doctor, reason);
    document.getElementById('apMsg').innerText = 'تم الحجز';
    renderAppts(); scheduleReminder(ap);
  });

  // meds
  document.getElementById('btnAddMed').addEventListener('click', ()=>{
    const name = document.getElementById('med_name').value.trim();
    const stock = document.getElementById('med_stock').value||0;
    const exp = document.getElementById('med_exp').value;
    const supplier = document.getElementById('med_supplier').value;
    if(!name) return alert('اسم الدواء مطلوب');
    addMed({name,stock,exp,supplier}); document.getElementById('medMsg').innerText='تمت الإضافة/التحديث'; renderMeds();
  });

  // finance
  document.getElementById('btnAddFinance').addEventListener('click', ()=>{
    const desc = document.getElementById('f_desc').value;
    const amount = parseFloat(document.getElementById('f_amount').value||0);
    const type = document.getElementById('f_type').value;
    if(!desc || !amount) return alert('املأ البيان والمبلغ');
    addFin(desc, amount, type); document.getElementById('fMsg').innerText='تم التسجيل'; renderFin();
  });

  // users (admin)
  document.getElementById('btnAddUser').addEventListener('click', ()=>{
    const name = document.getElementById('u_name').value.trim();
    const pass = document.getElementById('u_pass').value.trim();
    const role = document.getElementById('u_role').value;
    if(!name || !pass) return alert('املأ الحقول');
    if(!currentUser || currentUser.role!=='admin'){ return alert('فقط Admin يمكنه إضافة مستخدمين'); }
    if(!addUser(name, pass, role)) return alert('المستخدم موجود');
    renderUsers();
  });

  document.getElementById('btnChangePass').addEventListener('click', ()=>{
    if(!currentUser) return alert('سجل الدخول'); 
    const oldP = document.getElementById('oldPass').value;
    const newP = document.getElementById('newPass').value;
    const conf = document.getElementById('confirmPass').value;
    const users = storage.get('clinic_users')||[];
    const me = users.find(u=>u.id===currentUser.id || u.name===currentUser.name);
    if(!me || me.pass!==oldP) return alert('كلمة المرور القديمة غير صحيحة');
    if(newP!==conf) return alert('تأكيد غير مطابق');
    me.pass = newP; storage.set('clinic_users', users); document.getElementById('passMsg').innerText='تم تغيير كلمة المرور';
  });

  // initial rendering
  refreshUserPanel(); renderPatients(); renderAppts(); renderMeds(); renderFin(); renderUsers();
});
