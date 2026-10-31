(()=>{'use strict';
const KEY='ztrend_workforce_v3';
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{users:[],projects:[],attendance:[]}}catch{return {users:[],projects:[],attendance:[]}}};
const uid=p=>p+'-'+Math.random().toString(36).slice(2,8).toUpperCase();
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const distance=(a,b,c,d)=>{const r=Math.PI/180,x=Math.sin((c-a)*r/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin((d-b)*r/2)**2;return 12742000*Math.asin(Math.sqrt(x))};
const say=s=>{const el=document.querySelector('#gpsmsg');if(el)el.textContent=s};
const position=opts=>new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,opts));
async function getPosition(){let first;try{return await position({enableHighAccuracy:true,timeout:20000,maximumAge:0})}catch(e){first=e}try{return await position({enableHighAccuracy:false,timeout:25000,maximumAge:0})}catch(e){throw e||first}}
async function gps(kind){
 const db=read(),id=localStorage.getItem('ztrend_user_device_session')||sessionStorage.getItem('ztrend_session_user');
 const me=db.users.find(u=>u.id===id&&u.role==='user'&&u.status!=='Inactive');
 if(!me){say('Login session missing. Sign in again.');return}
 const p=db.projects.find(x=>x.id===me.projectId&&x.companyId===me.companyId);
 if(!p||p.lat===''||p.lng===''||!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lng))){say('Assigned project latitude/longitude missing. Ask Admin to check the assigned project.');return}
 if(!navigator.geolocation||!window.isSecureContext){say('Location needs a supported browser and secure HTTPS page.');return}
 say('Checking device location. Please wait…');
 try{
  const pos=await getPosition(),{latitude,longitude,accuracy}=pos.coords;
  if(!Number.isFinite(accuracy)){say('Device did not return GPS accuracy. Enable Windows Location Services or use a GPS-enabled phone.');return}
  if(accuracy>1000){say('PC location is approximate (accuracy ±'+Math.round(accuracy/1000)+' km), not GPS. Windows/Chrome cannot verify the site from this device. Use your GPS-enabled phone at the project site, or connect a GPS receiver. Attendance has NOT been recorded.');return}
  const dist=distance(latitude,longitude,Number(p.lat),Number(p.lng)),radius=Math.max(20,Number(p.radius)||150);
  if(dist>radius+accuracy){say('Outside site boundary: '+Math.round(dist)+'m from project; allowed radius '+radius+'m. Accuracy ±'+Math.round(accuracy)+'m. Attendance not recorded.');return}
  let a=db.attendance.find(x=>x.userId===me.id&&x.date===today());
  if(kind==='in'){if(a?.checkInAt){say('Already checked in today.');return}a={id:uid('ATT'),userId:me.id,companyId:me.companyId,projectId:p.id,date:today(),checkInAt:new Date().toISOString(),checkOutAt:null,checkInGPS:{latitude,longitude,accuracy,distance:Math.round(dist)}};db.attendance.push(a)}
  else{if(!a?.checkInAt||a.checkOutAt){say('No open check-in session. Check in first.');return}a.checkOutAt=new Date().toISOString();a.checkOutGPS={latitude,longitude,accuracy,distance:Math.round(dist)}}
  localStorage.setItem(KEY,JSON.stringify(db));say('GPS verified. '+(kind==='in'?'Check In':'Check Out')+' successful.');location.reload();
 }catch(e){const msg={1:'Location permission denied. Chrome site settings → Location → Allow; also enable Windows Location Services.',2:'Location unavailable. Enable Windows Location Services and Wi-Fi, or use a GPS-enabled phone.',3:'Location request timed out. Retry with Wi-Fi and Location Services enabled.'};say(msg[e.code]||('Location error: '+(e.message||'Unknown error')))}
}
document.addEventListener('click',e=>{const b=e.target.closest('#cin,#cout');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();gps(b.id==='cin'?'in':'out')},true);
})();