'use strict';
Object.assign(translations,{'Upcoming':'即将开始','Past':'历史','Closed':'已结束','Review booking':'核对预约','Confirm booking':'确认提交','Back':'返回','No bookings':'暂无预约','Sign in to see your bookings.':'登录以查看您的预约','Your selected time is no longer available. Please choose again.':'所选时段已不可用 请重新选择','Selected dates':'所选日期','Not submitted yet':'尚未提交'});
let mineTab='upcoming',bookingIntent=null;
try{bookingIntent=JSON.parse(sessionStorage.getItem('booking-intent')||'null');}catch{}
function rememberBooking(room,date,start,end){
 bookingIntent={room,date,start,end,expires:Date.now()+86400000};
 try{sessionStorage.setItem('booking-intent',JSON.stringify(bookingIntent));}catch{}
}
function forgetBookingIntent(){bookingIntent=null;try{sessionStorage.removeItem('booking-intent');}catch{}}
function resumeBooking(){
 if(!bookingIntent||!session||!liveReady||document.getElementById('modal').open)return;
 const intent=bookingIntent;forgetBookingIntent();
 if(intent.expires<Date.now()||!rooms.some(r=>r.id===intent.room&&r.enabled)||!validBookingTime(intent.date,intent.start,intent.end)||conflict(intent))return toast('Your selected time is no longer available. Please choose again.');
 selected=intent.date;month=selected.slice(0,7);slotStart=intent.start;slotEnd=intent.end;render();openForm(intent.room,null,intent.start);
 const form=document.getElementById('booking-form');if(form)form.elements.end.value=intent.end;
}
const bookWithSession=bookSlot;
bookSlot=function(room){if(!session&&classicDateValid&&validBookingTime(selected,slotStart,slotEnd)&&rooms.some(r=>r.id===room&&r.enabled)&&!conflict({room,date:selected,start:slotStart,end:slotEnd}))rememberBooking(room,selected,slotStart,slotEnd);return bookWithSession(room);};
const proceedWithSession=proceedSlots;
proceedSlots=function(){if(!session&&validSlotSelection())rememberBooking(slotSelection.room,selected,slotTime(slotSelection.first),slotTime(slotSelection.last+1));return proceedWithSession();};
const refreshWithResume=refreshLive;
refreshLive=async function(){await refreshWithResume();resumeBooking();};
const logoutWithIntent=signOut;
signOut=async function(){forgetBookingIntent();return logoutWithIntent();};

function myBookingGroup(b){
 if(['cancelled','rejected','expired'].includes(b.status))return 'closed';
 if(stamp(b.date,b.end)<=now())return 'past';
 return b.status==='pending'?'pending':'upcoming';
}
const listWithAdmin=renderList;
renderList=function(){
 if(view!=='mine')return listWithAdmin();
 const root=document.getElementById('content');
 if(!session){root.innerHTML='<div class="panel empty"><p>'+rt('Sign in to see your bookings.')+'</p><button class="primary" onclick="authForm()">'+rt('Sign in')+'</button></div>';return;}
 const own=bookings.filter(b=>b.owner==='member'),list=own.filter(b=>myBookingGroup(b)===mineTab).sort((a,b)=>(mineTab==='past'||mineTab==='closed'?-1:1)*(stamp(a.date,a.start)-stamp(b.date,b.start)));
 root.innerHTML='<div class="toolbar"><div class="seg mine-tabs">'+[['upcoming','Upcoming'],['pending','Pending'],['past','Past'],['closed','Closed']].map(([key,label])=>'<button class="'+(mineTab===key?'active':'')+'" aria-pressed="'+(mineTab===key)+'" onclick="mineTab=\''+key+'\';render()">'+rt(label)+' ('+own.filter(b=>myBookingGroup(b)===key).length+')</button>').join('')+'</div></div><div class="booking-list">'+(list.length?list.map(b=>'<article class="booking-card"><div class="card-main"><div class="row"><h3>'+esc(b.title)+'</h3>'+badge(b)+'</div><p>'+dateLabel(b.date,{weekday:'short',day:'numeric',month:'short',year:'numeric'})+'</p><p>'+esc(roomName(b.room))+' · '+timeLabel(b.start)+'–'+timeLabel(b.end)+'</p>'+(b.status==='pending'?'<p>'+pendingText(b)+'</p>':'')+'</div><div class="card-actions"><button class="secondary" onclick="openDetail(\''+b.id+'\')">'+rt('View')+'</button>'+(canCancel(b)?'<button class="danger" onclick="confirmCancel(\''+b.id+'\')">'+rt('Cancel')+'</button>':'')+'</div></article>').join(''):'<div class="panel empty">'+rt('No bookings')+'</div>')+'</div>';applyLanguage(root);
};

function reviewRows(form){
 const f=new FormData(form),rows=[['Purpose',f.get('title')],['Fellowship',f.get('group')],['Venue',roomName(Number(f.get('room')))],['Date',f.get('date')],['Time',f.get('start')+'–'+f.get('end')],['PIC',f.get('pic')]];
 const dates=f.getAll('occurrence');if(f.get('repeat_frequency')!=='once'&&dates.length)rows.push(['Selected dates',dates.join(' · ')]);
 return rows.map(([label,value])=>'<div><dt>'+rt(label)+'</dt><dd>'+esc(value||'')+'</dd></div>').join('');
}
function backFromReview(form=document.getElementById('booking-form')){
 if(!form)return;form.querySelector('.booking-review')?.remove();form.querySelector('.modal-body').hidden=false;form.querySelector('.modal-footer').hidden=false;
}
const submitAfterReview=submitBooking;
submitBooking=function(event,id,block){
 const form=event.target;
 if(repeatBusy||mutationInFlight){event.preventDefault();return;}
 if(form.elements.fellowship_choice)syncFellowship(form);
 const repeating=form.elements.repeat_frequency&&form.elements.repeat_frequency.value!=='once';
 if(block||(repeating&&(!repeatPreview||repeatPreview.signature!==JSON.stringify(repeatPayload(form)))))return submitAfterReview(event,id,block);
 event.preventDefault();if(!form.reportValidity())return;
 if(form.dataset.reviewConfirmed==='yes'){delete form.dataset.reviewConfirmed;return submitAfterReview(event,id,block);}
 if(form.querySelector('.booking-review'))return;
 form.querySelector('.modal-body').hidden=true;form.querySelector('.modal-footer').hidden=true;
 form.insertAdjacentHTML('beforeend','<section class="booking-review"><div class="modal-body"><h2>'+rt('Review booking')+'</h2><p class="section-note">'+rt('Not submitted yet')+'</p><dl class="detail-grid">'+reviewRows(form)+'</dl></div><div class="modal-footer"><button type="button" class="secondary" onclick="backFromReview()">'+rt('Back')+'</button><button type="button" class="primary" onclick="confirmReviewedBooking()">'+rt('Confirm booking')+'</button></div></section>');
 form.querySelector('.booking-review').scrollIntoView({block:'start'});
}
function confirmReviewedBooking(){const form=document.getElementById('booking-form');if(!form||repeatBusy||mutationInFlight)return;backFromReview(form);form.dataset.reviewConfirmed='yes';form.requestSubmit();delete form.dataset.reviewConfirmed;}
// assistant-ui.js starts the fully configured application.
