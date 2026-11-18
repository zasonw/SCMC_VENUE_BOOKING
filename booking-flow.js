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
 if(form.dataset.reviewConfirmed==='yes'){delete form.dataset.reviewConfirmed;return animateBookingSubmission(form,()=>submitAfterReview(event,id,block),id);}
 if(form.querySelector('.booking-review'))return;
 form.querySelector('.modal-body').hidden=true;form.querySelector('.modal-footer').hidden=true;
 form.insertAdjacentHTML('beforeend','<section class="booking-review"><div class="modal-body"><h2>'+rt('Review booking')+'</h2><p class="section-note">'+rt('Not submitted yet')+'</p><dl class="detail-grid">'+reviewRows(form)+'</dl></div><div class="modal-footer"><button type="button" class="secondary" onclick="backFromReview()">'+rt('Back')+'</button><button type="button" class="primary" onclick="confirmReviewedBooking()">'+rt('Confirm booking')+'</button></div></section>');
 form.querySelector('.booking-review').scrollIntoView({block:'start'});
}
function confirmReviewedBooking(){const form=document.getElementById('booking-form');if(!form||repeatBusy||mutationInFlight)return;backFromReview(form);form.dataset.reviewConfirmed='yes';form.requestSubmit();delete form.dataset.reviewConfirmed;}
// assistant-ui.js starts the fully configured application.

Object.assign(translations,{'Submitting…':'正在提交…','Saved. Approval status is shown in My bookings.':'已保存 可在我的预约查看审批状态','New booking':'新预约'});
const bookingMorphDelay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
Object.assign(translations,{'Booking submitted':'预约已提交','Booking updated':'预约已更新','Try again':'重试','Check status in My bookings':'请在我的预约查看状态','Pending approval':'待审批'});
async function animateBookingSubmission(form,save,editId){
 if(form.dataset.morphActive==='yes')return;
 const button=form.querySelector('button[type="submit"]');if(!button)return save();
 form.querySelector('.receipt-reselect')?.remove();
 const room=Number(form.elements.room.value),revision=sessionRevision;
 const dates=[...form.querySelectorAll('[name=occurrence]:checked')].map(e=>e.value);
 const when=(dates.length?dates[0]:form.elements.date.value)+' · '+form.elements.start.value+'–'+form.elements.end.value;
 const controls=[...form.querySelectorAll('button')].map(el=>[el,el.disabled]);
 form.dataset.morphActive='yes';form.inert=true;form.setAttribute('aria-busy','true');
 const width=Math.max(140,button.getBoundingClientRect().width);
 const shell=document.createElement('div');shell.className='booking-morph-shell';shell.style.width=width+'px';
 button.before(shell);shell.append(button);button.classList.add('booking-morph');button.style.width=width+'px';
 button.innerHTML='<span class="morph-label">'+rt('Submit booking')+'</span><span class="morph-spinner" aria-hidden="true"></span><svg class="morph-tick" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg>';
 button.setAttribute('aria-label',rt('Submitting…'));button.disabled=true;
 const started=Date.now();
 button.getBoundingClientRect();button.classList.add('is-loading');button.style.width='48px';
 controls.forEach(([el])=>el.disabled=true);
 let ok=false;
 try{ok=await save();}catch(error){toast(friendlyError(error));}
 if(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)await bookingMorphDelay(Math.max(0,1500-(Date.now()-started)));
 if(!form.isConnected||document.getElementById('booking-form')!==form||revision!==sessionRevision)return;
 form.inert=false;form.removeAttribute('aria-busy');controls.forEach(([el,disabled])=>el.disabled=disabled);
 if(!ok){
  delete form.dataset.morphActive;button.classList.remove('booking-morph','is-loading');button.style.width='';button.textContent=rt('Try again');button.removeAttribute('aria-label');shell.replaceWith(button);
  const errorBox=form.querySelector('#form-error');
  if(errorBox&&/conflict|unavailable|no longer available|already booked|overlap|冲突|不可用|已被/i.test(errorBox.textContent)){
   const change=document.createElement('button');change.type='button';change.className='secondary receipt-reselect';change.textContent=language==='zh'?'更改时段':'Change slot';
   change.onclick=()=>{const details=form.querySelector('.booking-schedule');if(details)details.open=true;form.elements.start.focus();};errorBox.after(change);
  }
  return;
 }
 // A successful submission must never submit the same form again.
 form.querySelectorAll('input,select,textarea,button[type="submit"]').forEach(el=>el.disabled=true);
 button.classList.remove('is-loading');button.classList.add('is-success');button.setAttribute('aria-label',rt('Saved. Approval status is shown in My bookings.'));
 const entries=form.dataset.savedSeries?bookings.filter(b=>b.series_id===form.dataset.savedSeries):bookings.filter(b=>b.id===(form.dataset.savedId||editId));
 const entry=entries[0],state=liveReady&&entry&&entries.every(b=>b.status===entry.status)?entry.status:'';
 const status=document.createElement('section');status.className='morph-status booking-receipt';status.setAttribute('role','status');
 const heading=document.createElement('strong'),details=document.createElement('span'),label=document.createElement('span');
 heading.textContent=rt(editId?'Booking updated':'Booking submitted');
 details.textContent=roomName(room)+' · '+when+(dates.length>1?' · '+dates.length+(language==='zh'?' 个日期':' dates'):'');
 label.textContent=rt(({pending:'Pending approval',confirmed:'Confirmed'})[state]||'Check status in My bookings');
 status.append(heading,details,label);form.querySelector('.modal-body').hidden=true;
 const footer=form.querySelector('.modal-footer');footer.before(status);
 for(const child of [...footer.children])if(child!==shell)child.hidden=true;
 const next=document.createElement('button');next.type='button';next.className='secondary';next.textContent=rt('New booking');next.onclick=()=>openForm(room);
 const mine=document.createElement('button');mine.type='button';mine.className='primary';mine.textContent=rt('My bookings');mine.onclick=()=>{closeModal();mineTab=entry?myBookingGroup(entry):'pending';navigate('mine');if(entry)openDetail(entry.id);};
 footer.prepend(next,mine);mine.focus({preventScroll:true});
 setTimeout(()=>{if(form.isConnected&&revision===sessionRevision)shell.hidden=true;},60000);
}
