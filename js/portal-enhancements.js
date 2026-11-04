(()=>{'use strict';
const KEY='ztrend_workforce_v3',portal=document.body.dataset.portal,$=s=>document.querySelector(s);
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{users:[],companies:[],attendance:[],projects:[]}}catch{return {users:[],companies:[],attendance:[],projects:[]}}};
const save=d=>localStorage.setItem(KEY,JSON.stringify(d));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function userLogin(){
 const label=$('label[for="email"]'),field=$('#email');
 if(label)label.textContent='Email / Employee ID / Mobile';
 if(field){field.type='text';field.placeholder='Enter email, Employee ID or mobile number';field.autocomplete='username'}
}
function addProfileTools(){
 const content=$('#content');
 if(portal!=='user'||!content||$('.title')?.textContent!=='My Profile'||$('#extraAccountTools'))return;
 const id=localStorage.getItem('ztrend_user_device_session')||sessionStorage.getItem('ztrend_session_user');
 const d=read(),u=d.users.find(x=>x.id===id);
 if(!u)return;
 const wrap=document.createElement('section');
 wrap.id='extraAccountTools';
 wrap.className='panel';
 wrap.innerHTML='<div class="panelhead"><h2>Change Password</h2></div><form id="changePass" class="formgrid"><div class="field"><label>New Password</label><input name="next" type="password" minlength="8" autocomplete="new-password" required></div><div class="field"><label>Confirm New Password</label><input name="confirm" type="password" minlength="8" autocomplete="new-password" required></div><div class="field full"><button class="btn primary">Update Password</button><p class="hint" id="changePassMessage" role="status">Password is updated securely in your Supabase account.</p></div></form>';
 content.appendChild(wrap);
 $('#changePass').onsubmit=async e=>{
  e.preventDefault();
  const form=e.currentTarget,fd=new FormData(form),next=String(fd.get('next')||''),confirm=String(fd.get('confirm')||''),message=$('#changePassMessage'),button=form.querySelector('button'),client=window.ZTrendBackend?.client;
  if(next.length<8){message.textContent='Use at least 8 characters.';return}
  if(next!==confirm){message.textContent='Passwords do not match.';return}
  if(!client){message.textContent='Secure account connection unavailable. Reload and try again.';return}
  button.disabled=true;button.textContent='Updating…';message.textContent='';
  try{
   const {data,error:sessionError}=await client.auth.getSession();
   if(sessionError||!data?.session||data.session.user.id!==id)throw new Error('Your secure login session has expired. Sign in again.');
   const {error}=await client.auth.updateUser({password:next});
   if(error)throw error;
   form.reset();message.textContent='Password updated successfully in Supabase.';
  }catch(error){message.textContent=error?.message||'Password update failed.'}
  finally{button.disabled=false;button.textContent='Update Password'}
 };
}
function bottomNav(){
 if(portal!=='user'||!$('#appview')||$('#appview').classList.contains('hidden')||$('#userBottomNav'))return;
 const nav=document.createElement('nav');nav.id='userBottomNav';nav.className='user-bottom-nav';nav.innerHTML='<button data-user-page="Attendance History"><span>▤</span><small>History</small></button><button class="home" data-user-page="Overview"><span>⌂</span><small>Attendance</small></button><button data-user-page="My Profile"><span>◉</span><small>Profile</small></button>';
 nav.querySelectorAll('button').forEach(b=>b.onclick=()=>{const target=document.querySelector('[data-page="'+b.dataset.userPage+'"]');if(target)target.click();nav.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));window.scrollTo({top:0,behavior:'smooth'})});
 $('#appview').appendChild(nav);nav.querySelector('[data-user-page="Overview"]').classList.add('active');
}
function devDashboard(){
 if(portal!=='developer')return;
 const title=$('.title');if(!title)return;
 if(title.textContent==='Platform Overview')title.textContent='Dashboard';
 document.querySelectorAll('[data-page="Platform Overview"]').forEach(b=>{if(!b.dataset.labelFixed){b.dataset.labelFixed='1';b.childNodes[b.childNodes.length-1].textContent='Dashboard'}});
 const content=$('#content');if(!content||!title.textContent.includes('Dashboard')||$('#proDashSearch'))return;
 const d=read(),companies=d.companies||[],users=d.users||[],attendance=d.attendance||[],employees=users.filter(x=>x.role==='user'),active=employees.filter(x=>x.status!=='Inactive').length;
 const search=document.createElement('section');search.className='panel pro-dash-search';search.innerHTML='<div class="dash-search"><span>⌕</span><input id="proDashSearch" placeholder="Search companies, employees, admins…"></div><div id="proDashResults"></div>';
 content.prepend(search);
 const cards=[['COMPANIES',companies.length],['ADMINS',users.filter(x=>x.role==='admin').length],['EMPLOYEES',employees.length],['ATTENDANCE',attendance.length]];
 const metrics=document.createElement('div');metrics.className='metrics pro-metrics';metrics.innerHTML=cards.map(([a,n])=>'<div class="metric"><small>'+a+'</small><strong data-count="'+n+'">0</strong><em>Live workspace total</em></div>').join('');
 content.prepend(metrics);
 const days=Array.from({length:7},(_,i)=>{let dt=new Date();dt.setDate(dt.getDate()-6+i);let k=dt.toISOString().slice(0,10);return {label:dt.toLocaleDateString(undefined,{weekday:'short'}),n:attendance.filter(x=>x.date===k).length}});
 const max=Math.max(1,...days.map(x=>x.n));
 const charts=document.createElement('div');charts.className='dash-grid';charts.innerHTML='<section class="panel"><div class="panelhead"><h2>Attendance Activity · 7 Days</h2><span class="dash-tag">WEEKLY</span></div><div class="chart dash-bars">'+days.map(x=>'<div class="barcol"><b>'+x.n+'</b><div class="bar" style="height:'+Math.max(5,x.n/max*130)+'px"></div><small>'+x.label+'</small></div>').join('')+'</div></section><section class="panel"><div class="panelhead"><h2>Employee Status</h2><span class="dash-tag">LIVE</span></div><div class="status-donut" style="--active:'+(employees.length?active/employees.length*100:0)+'%"><div><b>'+employees.length+'</b><small>Employees</small></div></div><div class="donut-legend"><span>● Active '+active+'</span><span>● Inactive '+(employees.length-active)+'</span></div></section>';
 metrics.after(charts);
 const shortcuts=document.createElement('section');shortcuts.className='panel';shortcuts.innerHTML='<div class="panelhead"><h2>Quick Actions</h2></div><div class="quick-grid"><button class="quick-card" data-page="Companies"><b>＋</b><span>Add Company</span><small>Register organization</small></button><button class="quick-card" data-page="Admin Accounts"><b>♙</b><span>Manage Admins</span><small>Roles and access</small></button><button class="quick-card" data-page="All Users"><b>◎</b><span>View Employees</span><small>Workforce records</small></button><button class="quick-card" data-page="Global Attendance"><b>▤</b><span>Attendance</span><small>Global records</small></button></div>';
 charts.after(shortcuts);shortcuts.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>document.querySelector('[data-page="'+b.dataset.page+'"]')?.click());
 const results=$('#proDashResults'),input=$('#proDashSearch');input.oninput=()=>{let q=input.value.trim().toLowerCase(),rows=[...companies.map(x=>({kind:'Company',name:x.name,detail:x.code,target:'Companies'})),...users.filter(x=>x.role!=='developer').map(x=>({kind:x.role,name:x.name,detail:x.id+' · '+x.email,target:x.role==='admin'?'Admin Accounts':'All Users'}))].filter(x=>(x.kind+' '+x.name+' '+x.detail).toLowerCase().includes(q)).slice(0,10);results.innerHTML=q?'<div class="search-results">'+rows.map(x=>'<button data-open="'+x.target+'"><b>'+esc(x.name)+'</b><small>'+esc(x.kind+' · '+x.detail)+'</small></button>').join('')+'</div>':'';results.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>document.querySelector('[data-page="'+b.dataset.open+'"]')?.click())};
}
function adminDashboard(){
 if(portal!=='admin'||$('.title')?.textContent!=='Company Dashboard'||$('#adminDashSearch'))return;
 const root=$('#content');if(!root)return;
 const search=document.createElement('section');search.className='panel';search.innerHTML='<div class="dash-search"><span>⌕</span><input id="adminDashSearch" placeholder="Search employees, projects and attendance…"></div><div id="adminDashResults"></div>';root.prepend(search);
 const db=read(),employees=db.users.filter(x=>x.role==='user'&&x.companyId===db.users.find(u=>u.id===sessionStorage.getItem('ztrend_session_admin'))?.companyId);
 $('#adminDashSearch').oninput=()=>{let q=$('#adminDashSearch').value.trim().toLowerCase(),rows=employees.filter(x=>(x.name+' '+x.id+' '+x.email).toLowerCase().includes(q));$('#adminDashResults').innerHTML=q?'<div class="search-results">'+rows.map(x=>'<div><b>'+esc(x.name)+'</b><small>'+esc(x.id+' · '+x.email)+'</small></div>').join('')+'</div>':''};
 const stats=document.createElement('div');stats.className='panel';stats.innerHTML='<div class="panelhead"><h2>Workforce Status</h2><span class="dash-tag">LIVE</span></div><div class="status-donut" style="--active:'+(employees.length?employees.filter(x=>x.status!=='Inactive').length/employees.length*100:0)+'%"><div><b>'+employees.length+'</b><small>Employees</small></div></div>';root.appendChild(stats);
}
function animate(){document.querySelectorAll('.metric strong[data-count]').forEach(el=>{if(el.dataset.animated)return;el.dataset.animated='1';let n=+el.dataset.count||0,start=performance.now();function frame(t){let p=Math.min(1,(t-start)/650);el.textContent=Math.round(n*(1-Math.pow(1-p,3))).toLocaleString();if(p<1)requestAnimationFrame(frame)}requestAnimationFrame(frame)})}
function observe(){
 const app=$('#appview');if(!app)return;
 const run=()=>{if(portal==='user'){bottomNav();addProfileTools()}if(portal==='developer')devDashboard();if(portal==='admin')adminDashboard();animate()};
 new MutationObserver(run).observe(app,{childList:true,subtree:true});run();
}
if(portal==='user')userLogin();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe);else observe();
document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){let x=$('#proDashSearch');if(x){e.preventDefault();x.focus()}}if(e.altKey&&e.key==='1'&&portal==='developer')document.querySelector('[data-page="Platform Overview"]')?.click();if(e.altKey&&e.key==='2'&&portal==='developer')document.querySelector('[data-page="Companies"]')?.click();if(e.altKey&&e.key==='3'&&portal==='developer')document.querySelector('[data-page="All Users"]')?.click()});
})();