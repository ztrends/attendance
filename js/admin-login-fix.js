(()=>{'use strict';
if(document.body.dataset.portal!=='admin')return;
const KEY='ztrend_workforce_v3';
const field=document.querySelector('#email');
const label=document.querySelector('label[for="email"]');
if(label)label.textContent='Admin ID or Email';
if(field)field.placeholder='Enter Admin ID or Email';
document.addEventListener('click',e=>{
 if(!e.target.closest('#signin')||!field)return;
 const value=field.value.trim();
 if(!value||value.includes('@'))return;
 try{
  const db=JSON.parse(localStorage.getItem(KEY)||'{}');
  const admin=(db.users||[]).find(u=>u.role==='admin'&&String(u.id).toLowerCase()===value.toLowerCase());
  if(admin)field.value=admin.email;
 }catch{}
},true);
})();