(()=>{'use strict';
const KEY='ztrend_workforce_v3';
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{users:[],projects:[],attendance:[]}}catch{return {users:[],projects:[],attendance:[]}}};
const uid=p=>p+'-'+Math.random().toString(36).slice(2,8).toUpperCase();
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const distance=(a,b,c,d)=>{const r=Math.PI/180,x=Math.sin((c-a)*r/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin((d-b)*r/2)**2;return 12742000*Math.asin(Math.sqrt(x))};
function message(s){const el=document.querySelector('#gpsmsg');if(el)el.textContent=s}
function getPosition(options){return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,options))}
async function locate(){
 let first;
 try{return await getPosition({enableHighAccuracy:true,timeout:18000,maximumAge:10000})}
 catch(e){first=e}
 try{return await getPosition({enableHighAccuracy:false,timeout:25000,maximumAge:30000})}
 catch(e){throw e||first}
}
async function run(kind){
 const db=read(),userId=localStorage.getItem('ztrend_user_device_session')||sessionStorage.getItem('ztrend_session_user');
 const me=db.users.find(u=>u.id===userId&&u.role==='user'&&u.status!=='Inactive');
 if(!me){message('Login session not found. Please sign in again.');return}
 const p=db.projects.find(x=>x.id===me.projectId&&x.companyId===me.companyId);
 if(!p||!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lng))||p.lat===''||p.lng===''){message('Assigned project GPS coordinates missing. Admin: check assigned project Latitude and Longitude.');return}
 if(!navigator.geolocation){message('This browser/device does not support location. Use updated Chrome on HTTPS.');return}
 if(!window.isSecureContext){message('Location needs a secure HTTPS page. Open the official ZTREND HTTPS link.');return}
 message('Getting device location… Please wait. If prompted, choose Allow.');
 try{
  const pos=await locate(),{latitude,longitude,accuracy}=pos.coords;
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||!Number.isFinite(accuracy)){message('Browser returned invalid location. Check Windows Location Services and Chrome permission.');return}
  const dist=distance(latitude,longitude,Number(p.lat),Number(p.lng)),radius=Math.max(20,Number(p.radius)||150);
  if(accuracy>250){message('Location accuracy is too weak ('+Math.round(accuracy)+'m). On Windows turn Location Services ON, allow Chrome location, connect Wi-Fi, then retry.');return}
  if(dist>radius+accuracy){message('Outside project area: device is '+Math.round(dist)+'m away; site radius '+radius+'m; location uncertainty ±'+Math.round(accuracy)+'m.');return}
  let a=db.attendance.find(x=>x.userId===me.id&&x.date===today());
  if(kind==='in'){
   if(a?.checkInAt){message('Already checked in today.');return}
   a={id:uid('ATT'),userId:me.id,companyId:me.companyId,projectId:p.id,date:today(),checkInAt:new Date().toISOString(),checkOutAt:null,checkInGPS:{latitude,longitude,accuracy,distance:Math.round(dist),method:'browser-geolocation'}};db.attendance.push(a);
  }else{
   if(!a?.checkInAt||a.checkOutAt){message('No open check-in session found. Check in first.');return}
   a.checkOutAt=new Date().toISOString();a.checkOutGPS={latitude,longitude,accuracy,distance:Math.round(dist),method:'browser-geolocation'};
  }
  localStorage.setItem(KEY,JSON.stringify(db));
  message('Location verified ('+Math.round(dist)+'m from site, accuracy ±'+Math.round(accuracy)+'m). '+(kind==='in'?'Check-in':'Check-out')+' successful.');
  document.querySelector('#refreshBtn')?.click();
 }catch(e){
  const m={1:'Location permission denied. Chrome address-bar site settings → Location → Allow; also turn Windows Location Services ON.',2:'Position unavailable. Turn Windows Location Services ON and connect to Wi-Fi, then retry.',3:'Location request timed out. Keep Wi-Fi ON and retry.'};
  message(m[e.code]||('Location error: '+(e.message||'Unknown error')+'. Check Chrome and Windows location permissions.'));
 }
}
document.addEventListener('click',e=>{
 const b=e.target.closest('#cin,#cout');if(!b)return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
 run(b.id==='cin'?'in':'out');
},true);
})();