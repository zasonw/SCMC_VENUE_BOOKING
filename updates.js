'use strict';
Object.assign(translations,{
 'Notifications':'通知','No notifications yet.':'暂无通知','New booking':'新预约','Booking changed':'预约已修改','Mark shown as read':'将显示的通知标为已读',
 'Latest 100 updates. New updates appear here when the site refreshes.':'显示最近100条通知 网站刷新时会载入新通知',
 'Unable to load notifications.':'无法载入通知','Retry':'重试','Booking unavailable.':'无法查看此预约',
 'Agenda':'日程','This week':'本周','Previous':'上一段','Next':'下一段','No bookings in this period.':'此期间没有预约',
 'Selected dates':'指定日期','Before':'修改前','After':'修改后','Choose dates from this booking onward.':'从此预约起选择要修改的日期',
 'Choose dates below. Nothing is selected automatically.':'请在下方选择日期 不会自动选择任何日期'
});
let notificationState={items:[],unread:0},notificationOwner=null,notificationError=false,notificationRequest=0;
function notificationButton(){
 const box=document.getElementById('account-controls');if(!box)return;
 box.querySelector('.notification-button')?.remove();
 if(!session)return;
 if(notificationOwner!==session.user.id){notificationOwner=session.user.id;notificationState={items:[],unread:0};}
 const b=document.createElement('button');b.className='secondary notification-button';
 b.textContent=rt('Notifications')+(notificationState.unread?' ('+notificationState.unread+')':'');b.onclick=openNotifications;
 box.append(b);
}
async function loadNotifications(){
 if(!session||!db)return;
 const revision=sessionRevision,uid=session.user.id,request=++notificationRequest;
 try{
  const {data,error}=await db.rpc('venue_notifications',{action:'list',payload:{}});if(error)throw error;
  if(revision!==sessionRevision||uid!==session?.user?.id||request!==notificationRequest)return;
  notificationOwner=uid;notificationState=data;notificationError=false;notificationButton();
 }catch(error){if(revision===sessionRevision&&request===notificationRequest)notificationError=true;}
}
const updatesRefresh=refreshLive;
refreshLive=async function(){await updatesRefresh();await loadNotifications();};
const updatesClearAccount=clearAccountState;
clearAccountState=function(...args){notificationRequest++;notificationOwner=null;notificationState={items:[],unread:0};notificationError=false;return updatesClearAccount(...args);};
async function openNotifications(){
 if(!session)return authForm();
 showModal(modalHead(rt('Notifications'))+'<div class="modal-body" id="notification-inbox" aria-live="polite">'+rt('Loading…')+'</div>');
 const box=document.getElementById('notification-inbox'),revision=sessionRevision;
 await loadNotifications();if(revision!==sessionRevision||document.getElementById('notification-inbox')!==box)return;
 drawNotifications(box);
}
function drawNotifications(box){
 if(notificationError){box.innerHTML='<p>'+rt('Unable to load notifications.')+'</p><button class="secondary" onclick="openNotifications()">'+rt('Retry')+'</button>';return;}
 const kinds={created:'New booking',changed:'Booking changed',pending:'Pending',confirmed:'Confirmed',cancelled:'Cancelled',rejected:'Rejected',expired:'Expired',blocked:'Blocked'};
 box.innerHTML='<p class="section-note">'+rt('Latest 100 updates. New updates appear here when the site refreshes.')+'</p>'+
 (notificationState.items.some(n=>!n.read_at)?'<button class="secondary" onclick="readNotifications()">'+rt('Mark shown as read')+'</button>':'')+
 '<div class="notification-list">'+(notificationState.items.length?notificationState.items.map(n=>'<button class="notification-item '+(!n.read_at?'unread':'')+'" onclick="viewNotification(\''+n.id+'\')"><strong>'+(!n.read_at?'• ':'')+rt(kinds[n.kind]||'Booking changed')+'</strong><span>'+esc(n.title)+'</span><small>'+esc(n.date)+' · '+esc(n.start)+' · '+esc(roomName(n.room))+'</small></button>').join(''):'<p class="empty">'+rt('No notifications yet.')+'</p>')+'</div>';
}
async function readNotifications(ids=notificationState.items.filter(n=>!n.read_at).map(n=>n.id)){
 if(!session)return false;
 const revision=sessionRevision;
 try{const {data,error}=await db.rpc('venue_notifications',{action:'read',payload:{ids}});if(error)throw error;
  if(revision!==sessionRevision)return false;notificationState=data;notificationButton();
  const box=document.getElementById('notification-inbox');if(box)drawNotifications(box);return true;
 }catch(error){if(revision===sessionRevision)toast('Connection failed. Please retry.');return false;}
}
async function viewNotification(id){
 const n=notificationState.items.find(n=>n.id===id);if(!n)return;
 const box=document.getElementById('notification-inbox'),revision=sessionRevision;
 if(!await readNotifications([id]))return;
 if(revision!==sessionRevision||document.getElementById('notification-inbox')!==box)return;
 if(bookings.some(b=>b.id===n.booking_id))openDetail(n.booking_id);else toast('Booking unavailable.');
}
let adminAgendaDate=null,adminAgendaMode='today';
function agendaRange(){
 const anchor=adminAgendaDate||dayKey();
 if(adminAgendaMode==='today')return [anchor,anchor];
 const weekday=new Date(anchor+'T12:00:00+08:00').getUTCDay();
 const start=addDays(anchor,-((weekday+6)%7));return [start,addDays(start,6)];
}
function openAdminAgenda(mode=adminAgendaMode,shift=0){
 if(!session||role!=='admin')return;
 adminAgendaMode=mode;if(shift)adminAgendaDate=addDays(adminAgendaDate||dayKey(),shift*(mode==='today'?1:7));
 const [start,end]=agendaRange();
 const rows=bookings.filter(b=>active(b)&&b.date>=start&&b.date<=end).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start)||a.room-b.room);
 let last='',html='';for(const b of rows){
  if(last!==b.date){last=b.date;html+='<h3 class="agenda-date-heading">'+dateLabel(b.date,{weekday:'long',day:'numeric',month:'long'})+'</h3>';}
  html+='<button class="admin-agenda-item" onclick="openDetail(\''+b.id+'\')"><div class="row"><strong>'+esc(b.start)+'–'+esc(b.end)+'</strong>'+badge(b)+'</div><strong>'+esc(roomName(b.room))+' · '+esc(b.title)+'</strong><span>'+esc(b.group||'')+'</span><span>'+rt('PIC')+': '+esc(b.pic||'—')+'</span></button>';
 }
 showModal(modalHead(rt('Agenda'))+'<div class="modal-body"><div class="agenda-tools"><button class="secondary" onclick="adminAgendaDate=null;openAdminAgenda(\'today\')">'+rt('Today')+'</button><button class="secondary" onclick="adminAgendaDate=null;openAdminAgenda(\'week\')">'+rt('This week')+'</button><input type="date" aria-label="'+rt('Date')+'" value="'+(adminAgendaDate||dayKey())+'" onchange="if(this.value){adminAgendaDate=this.value;openAdminAgenda()}"></div><div class="agenda-tools"><button class="secondary" onclick="openAdminAgenda(adminAgendaMode,-1)">'+rt('Previous')+'</button><span>'+esc(start)+(end!==start?' – '+esc(end):'')+'</span><button class="secondary" onclick="openAdminAgenda(adminAgendaMode,1)">'+rt('Next')+'</button></div>'+ (html||'<p class="empty">'+rt('No bookings in this period.')+'</p>')+'</div>');
}
const updatesRender=render;
render=function(){
 updatesRender();notificationButton();
 if(session&&role==='admin'){
  const target=view==='admin'?document.querySelector('#content .toolbar'):document.querySelector('.desktop-management');
  if(target){const b=document.createElement('button');b.className='secondary';b.textContent=rt('Agenda');b.onclick=()=>openAdminAgenda();target.prepend(b);}
 }
};
