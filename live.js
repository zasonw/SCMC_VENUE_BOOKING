'use strict';
// Only the browser-safe publishable key belongs here. Never use a service-role key.
const SUPABASE_URL='https://lftsgwzokyzbfnejeoqn.supabase.co';
const SUPABASE_KEY='sb_publishable_kXYq3rmWANHanFLvxIlqpA_Yrl43OQB';
let db, session=null, liveReady=false, refreshInFlight=false, mutationInFlight=false;
Object.assign(translations,{
 'Sign in':'登录','Sign out':'退出','Register':'注册','Email':'邮箱','Password':'密码','Name':'姓名','Users':'用户','Member':'会员','Admin':'管理员','Guest':'访客',
 'Refresh':'刷新','Connecting…':'连接中…','Updated':'已更新','Connection failed. Please retry.':'连接失败 请重试',
 'Shared calendar':'共享日历','Sign in to book.':'登录后预约','Save':'保存','Make admin':'设为管理员','Remove admin':'移除管理员',
 'Forgot password':'忘记密码','Send reset email':'发送重设邮件','Reset password':'重设密码','New password':'新密码',
 'Check your email to confirm your account, then sign in.':'请通过邮件验证账号 然后登录',
 'Check your email for the password reset link.':'请查看密码重设邮件','Password updated.':'密码已更新',
 'Please sign in first.':'请先登录','Keep at least one admin.':'必须保留至少一位管理员','Admin access required.':'需要管理员权限',
 'Verify your email before signing in.':'请先验证邮箱','Access updated.':'权限已更新','This room is already held or booked during that time. Choose another time or venue.':'该时段已被预约 请更换时间或场地',
 'Booking access denied.':'无权访问此预约','This booking cannot be edited.':'此预约无法修改',
 'Choose a future time between 06:00 and 23:00.':'请选择未来日期 06:00 至 23:00 的时段',
 'Confirmed bookings need an admin to cancel.':'已确认的预约须由管理员取消',
 'Please provide a reason.':'请填写原因','This request is no longer pending or has already started.':'此预约已处理或已开始',
 'Unable to load accounts.':'无法载入用户','Email service unavailable. Ask an admin to check email settings.':'邮件服务无法使用 请联系管理员检查设置',
 'Use at least 8 characters.':'请使用至少 8 个字符','Please wait for the calendar to connect.':'请等待日历连接','Saving…':'保存中…'
});
const liveText=s=>translateText(s);
let lastSyncText='Connecting…',lastSyncError=false;
function liveStatus(text,error=false){lastSyncText=text;lastSyncError=error;const e=document.getElementById('sync-status');e.textContent=liveText(text);e.style.color=error?'#a22':'';}
function friendlyError(error){const message=error?.message||'Connection failed. Please retry.';if(/email address not authorized|email rate limit|error sending|smtp/i.test(message))return 'Email service unavailable. Ask an admin to check email settings.';return message;}
async function api(action,payload={}){if(!db)throw Error('Connection failed. Please retry.');const {data,error}=await db.rpc('venue_api',{action,payload});if(error)throw error;return data;}
// Demo state must never be used as a production data source.
save=()=>{};processApprovals=()=>false;seed=()=>{};load=()=>{};changeRole=()=>{};
advanceClock=()=>{};resetDemo=()=>{};resetPrompt=()=>{};openDemo=()=>{};
const calendarRender=render;
render=function(){
 calendarRender();
 document.getElementById('user-name').textContent=session?me:liveText('Guest');
 document.getElementById('avatar').textContent=(me||'G').slice(0,2).toUpperCase();
 document.getElementById('user-role').textContent=liveText(session?(role==='admin'?'Admin':'Member'):'Guest');
 document.getElementById('account-controls').innerHTML=session?'<span class="account-name">'+esc(me)+'</span>'+(role==='admin'?'<button class="secondary" onclick="manageUsers()">'+liveText('Users')+'</button>':'')+'<button class="secondary" onclick="signOut()">'+liveText('Sign out')+'</button>':'<button class="secondary" onclick="authForm()">'+liveText('Sign in')+'</button>';
};
async function refreshLive(){
 if(refreshInFlight||!db)return;
 refreshInFlight=true;
 try{
  const {data:{session:current},error}=await db.auth.getSession();if(error)throw error;
  session=current;
  const data=await api('state');
  rooms=data.rooms;bookings=data.bookings.map(b=>({...b,attendance:b.attendance??''}));
  role=session&&data.admin?'admin':'member';me=data.name||'';liveReady=true;
  if(view==='admin'&&role!=='admin')view='schedule';render();liveStatus('Shared calendar');
 }catch(error){liveReady=false;liveStatus(friendlyError(error),true);}
 finally{refreshInFlight=false;}
}
const bookingFormBase=openForm;
openForm=function(...args){if(!session)return authForm();if(!liveReady)return toast('Please wait for the calendar to connect.');bookingFormBase(...args);const field=document.querySelector('#booking-form [name="pic"]');if(field&&!args[1])field.value=me;};
const proceedBase=proceedSlots;
proceedSlots=function(){if(!session)return authForm();if(!liveReady)return toast('Please wait for the calendar to connect.');proceedBase();};
function authForm(mode='signin'){
 const signup=mode==='signup',forgot=mode==='forgot',reset=mode==='reset';
 const title=signup?'Register':forgot?'Forgot password':reset?'Reset password':'Sign in';
 showModal(modalHead(title)+'<form onsubmit="submitAuth(event,\''+mode+'\')"><div class="modal-body"><div class="form-grid">'+
 (signup?'<label class="field wide"><span>Name</span><input name="name" required maxlength="120" autocomplete="name"></label>':'')+
 (!reset?'<label class="field wide"><span>Email</span><input name="email" type="email" required autocomplete="email"></label>':'')+
 (!forgot?'<label class="field wide"><span>'+(reset?'New password':'Password')+'</span><input name="password" type="password" '+(signup||reset?'minlength="8"':'')+' required autocomplete="'+(signup||reset?'new-password':'current-password')+'"></label>':'')+
 '</div><p id="auth-message" role="status"></p></div><div class="modal-footer">'+(!reset?'<button type="button" class="secondary" onclick="authForm(\''+(signup||forgot?'signin':'signup')+'\')">'+(signup||forgot?'Sign in':'Register')+'</button>':'')+
 (!signup&&!forgot&&!reset?'<button type="button" class="secondary" onclick="authForm(\'forgot\')">Forgot password</button>':'')+
 '<button class="primary" type="submit">'+(forgot?'Send reset email':reset?'Save':title)+'</button></div></form>');
}
async function submitAuth(event,mode){
 event.preventDefault();if(!db)return;const form=event.target,f=new FormData(form),button=form.querySelector('[type="submit"]'),message=document.getElementById('auth-message');button.disabled=true;
 try{
  const email=String(f.get('email')||'').trim(),password=String(f.get('password')||'');let response;
  if(mode==='signup')response=await db.auth.signUp({email,password,options:{data:{name:String(f.get('name')).trim()},emailRedirectTo:location.origin+'/'}});
  else if(mode==='forgot')response=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/'});
  else if(mode==='reset')response=await db.auth.updateUser({password});
  else response=await db.auth.signInWithPassword({email,password});
  if(response.error)throw response.error;
  if(mode==='signup'&&!response.data.session){message.textContent=liveText('Check your email to confirm your account, then sign in.');return;}
  if(mode==='forgot'){message.textContent=liveText('Check your email for the password reset link.');return;}
  closeModal();await refreshLive();if(mode==='reset')toast('Password updated.');
 }catch(error){message.textContent=liveText(friendlyError(error));}
 finally{button.disabled=false;}
}
async function signOut(){const {error}=await db.auth.signOut();if(error)return toast(friendlyError(error));session=null;role='member';me='';bookings=[];view='schedule';closeModal();render();await refreshLive();}
async function mutate(action,payload,success,errorElement='form-error'){
 if(mutationInFlight)return false;mutationInFlight=true;
 const buttons=[...document.querySelectorAll('#modal button')];buttons.forEach(b=>b.disabled=true);
 try{await api(action,payload);closeModal();await refreshLive();toast(success);return true;}
 catch(error){const msg=liveText(friendlyError(error)),el=document.getElementById(errorElement);if(el){el.textContent=msg;el.style.display='block';}else toast(msg);return false;}
 finally{mutationInFlight=false;buttons.forEach(b=>b.disabled=false);}
}
submitBooking=async function(event,id,block){event.preventDefault();const values=Object.fromEntries(new FormData(event.target));if(!session)return authForm();const ok=await mutate('save',{...values,id,block},id?'Booking updated':'Request submitted. Your slot is held.');if(ok){selected=values.date;month=selected.slice(0,7);slotSelection=null;render();}};
approve=id=>mutate('approve',{id},'Booking confirmed.');
rejectBooking=(id,reason)=>mutate('reject',{id,reason},'Request rejected. The slot is available again.');
cancelBooking=id=>mutate('cancel',{id},'Booking cancelled. The slot is available again.');
saveRooms=function(event){event.preventDefault();const f=new FormData(event.target);return mutate('rooms',{rooms:rooms.map(r=>({id:r.id,name:String(f.get('room'+r.id)).trim(),enabled:f.get('enabled'+r.id)==='yes'}))},'Venues updated.','room-error');};
async function manageUsers(){
 if(role!=='admin')return;
 try{const users=await api('users');showModal(modalHead('Users')+'<div class="modal-body"><div class="user-list">'+users.map(u=>'<div class="user-row"><div><strong>'+esc(u.name)+'</strong><small>'+esc(u.email)+'</small><span>'+liveText(u.is_admin?'Admin':'Member')+'</span></div><button class="secondary" onclick="setAdmin(\''+u.id+'\','+!u.is_admin+')">'+liveText(u.is_admin?'Remove admin':'Make admin')+'</button></div>').join('')+'</div><div class="form-error" id="access-error" role="alert"></div></div>');}
 catch(error){toast(friendlyError(error));}
}
async function setAdmin(id,admin){if(!confirm(language==='zh'?(admin?'授予此用户管理员权限？':'移除此用户的管理员权限？'):(admin?'Give this user admin access?':'Remove admin access for this user?')))return;const ok=await mutate('set_admin',{id,admin},'Access updated.','access-error');if(ok&&role==='admin')await manageUsers();}
async function startLive(){
 rooms=['圣堂','副堂','新会议室','旧会议室','Cafe','厨房','亲子室','喜乐1','喜乐2'].map((name,i)=>({id:i+1,name,enabled:true}));bookings=[];offset=0;selected=dayKey();month=selected.slice(0,7);me='';
 document.getElementById('brand-icon').innerHTML='';document.getElementById('plus-icon').innerHTML='';render();
 try{if(!window.supabase)throw Error('Connection failed. Please retry.');db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
 db.auth.onAuthStateChange(event=>{setTimeout(()=>{if(event==='PASSWORD_RECOVERY')authForm('reset');refreshLive();},0);});
 await refreshLive();
 setInterval(()=>{if(!document.hidden&&!document.getElementById('modal').open)refreshLive();},30000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshLive();});
 }catch(error){liveStatus(friendlyError(error),true);}
}
// Startup runs after recurring.js installs its form and directory controls.
