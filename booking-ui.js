'use strict';
Object.assign(translations,{'Fellowship':'团契','Purpose':'用途','Choose fellowship':'选择团契','Other':'其他','Fellowship name':'团契名称','Please choose a fellowship and enter a purpose.':'请选择团契并填写用途'});
let classicDateValid=true;
const fellowshipChoices=['成年团契','青成团契','青团','少年团契','敬拜赞美团','多巴安小组','读书会','门徒课程'];
function fellowshipField(value=''){
 const other=!!value&&!fellowshipChoices.includes(value);
 return '<div class="field wide"><label class="field"><span>Fellowship</span><select name="fellowship_choice" required onchange="syncFellowship(this.form)"><option value="">Choose fellowship</option>'+fellowshipChoices.map(name=>'<option value="'+esc(name)+'" '+(name===value?'selected':'')+'>'+esc(name)+'</option>').join('')+'<option value="__other__" '+(other?'selected':'')+'>Other</option></select></label><label class="field fellowship-other" '+(other?'':'hidden')+'><span>Fellowship name</span><input name="fellowship_other" maxlength="120" value="'+esc(other?value:'')+'" '+(other?'required':'disabled')+' oninput="syncFellowship(this.form)"></label><input type="hidden" name="group" value="'+esc(value)+'"></div>';
}
function syncFellowship(form){const choice=form.elements.fellowship_choice.value,other=choice==='__other__',input=form.elements.fellowship_other;input.disabled=!other;input.required=other;input.closest('label').hidden=!other;form.elements.group.value=other?input.value.trim():choice;}
// Keep the existing table nodes, focus, and both scroll axes intact on every tap.
function updateSlotSelection(){
 document.querySelectorAll('.time-slot[data-room][data-slot]').forEach(button=>{
  if(!button.classList.contains('available')&&!button.classList.contains('selected'))return;
  const room=Number(button.dataset.room),index=Number(button.dataset.slot),chosen=!!slotSelection&&slotSelection.room===room&&index>=slotSelection.first&&index<=slotSelection.last;
  button.classList.toggle('selected',chosen);button.classList.toggle('available',!chosen);
  button.setAttribute('aria-pressed',String(chosen));
  const label=roomName(room)+' '+slotTime(index)+'–'+slotTime(index+1)+' '+(chosen?'Selected':'Available');
  button.setAttribute('data-en-aria-label',label);button.setAttribute('aria-label',translateText(label));
  button.querySelector('span').textContent=translateText(chosen?'Selected':'Available');
 });
 document.querySelectorAll('.slot-summary').forEach(el=>{el.textContent=slotSelection?roomName(slotSelection.room)+' · '+timeLabel(slotTime(slotSelection.first))+'–'+timeLabel(slotTime(slotSelection.last+1)):translateText('Select a time');});
 document.querySelectorAll('.slot-proceed-actions').forEach(el=>{el.innerHTML=(slotSelection?'<button class="secondary" onclick="clearSlotSelection()">'+translateText('Clear')+'</button>':'')+'<button class="primary" '+(slotSelection?'':'disabled')+' onclick="proceedSlots()">'+translateText('Proceed')+'</button>';});
}
function clearSlotSelection(){slotSelection=null;updateSlotSelection();}
// Preserve position on periodic data refreshes, but reset it when date/room filters change.
const renderPreservingSlots=render;
render=function(){
 const positions=[...document.querySelectorAll('.slot-scroll')].map(el=>({key:el.dataset.gridKey,top:el.scrollTop,left:el.scrollLeft}));
 if(slotSelection&&!validSlotSelection())slotSelection=null;
 renderPreservingSlots();
 document.querySelectorAll('.slot-scroll').forEach(el=>{const p=positions.find(p=>p.key===el.dataset.gridKey);if(p){el.scrollTop=p.top;el.scrollLeft=p.left;}});
 liveStatus(lastSyncText,lastSyncError);
};
const validateBookingFields=submitBooking;
submitBooking=function(event,id,block){
 const form=event.target;if(!block&&form.elements.fellowship_choice)syncFellowship(form);
 if(!String(form.elements.group?.value||'').trim()||!String(form.elements.title?.value||'').trim()){
  event.preventDefault();const el=document.getElementById('form-error');el.textContent=translateText('Please choose a fellowship and enter a purpose.');el.style.display='block';return;
 }
 return validateBookingFields(event,id,block);
};


// Calendar is an overview; Book opens a picker and Slots opens the grid directly.
function classicRoomChoicesHTML(){
 const valid=classicDateValid&&validBookingTime(selected,slotStart,slotEnd);
 return (!valid?'<p class="availability-note">'+translateText('Choose a future time between 06:00 and 23:00.')+'</p>':'')+'<div class="availability-rooms">'+rooms.filter(r=>!roomFilter||r.id===+roomFilter).map(r=>{
 const held=conflict({room:r.id,date:selected,start:slotStart,end:slotEnd}),free=valid&&r.enabled&&!held;
 return '<button class="room-choice '+(free?'available':'')+'" '+(free?'':'disabled')+' onclick="bookSlot('+r.id+')"><strong>'+esc(roomName(r.id))+'</strong><small>'+translateText(free?'Book':!r.enabled?'Disabled':held?'Booked':'Unavailable')+'</small></button>';
 }).join('')+'</div>';
}
function updateClassicAvailability(){const container=document.getElementById('classic-rooms');if(container)container.innerHTML=classicRoomChoicesHTML();}
function changeClassicDate(date){classicDateValid=!!date;if(!date){updateClassicAvailability();return;}selected=date;month=date.slice(0,7);slotSelection=null;render();updateClassicAvailability();}
function openClassicBooking(){
 if(!liveReady)return toast('Please wait for the calendar to connect.');
 classicDateValid=true;if(selected<dayKey())selected=dayKey();
 showModal(modalHead(translateText('Book'))+'<div class="modal-body classic-picker"><label class="field"><span>'+translateText('Booking date')+'</span><input type="date" required value="'+selected+'" min="'+dayKey()+'" onchange="changeClassicDate(this.value)"></label><div class="booking-times"><label><span>'+translateText('Start time')+'</span><input type="time" required value="'+slotStart+'" min="06:00" max="23:00" onchange="slotStart=this.value;slotSelection=null;updateClassicAvailability()"></label><label><span>'+translateText('End time')+'</span><input type="time" required value="'+slotEnd+'" min="06:00" max="23:00" onchange="slotEnd=this.value;slotSelection=null;updateClassicAvailability()"></label></div><div id="classic-rooms">'+classicRoomChoicesHTML()+'</div></div>');
}
bookSlot=function(room){
 if(!classicDateValid||!validBookingTime(selected,slotStart,slotEnd)||!rooms.find(r=>r.id===room)?.enabled||conflict({room,date:selected,start:slotStart,end:slotEnd}))return toast('Please choose an available future time.');
 if(!session)return authForm();
 openForm(room,null,slotStart);
 const end=document.querySelector('#booking-form [name="end"]');if(end)end.value=slotEnd;
};
// Recheck stale selections before extending them or opening a booking form.
function validBookingTime(date,start,end){
 return /^\d{4}-\d{2}-\d{2}$/.test(date)&&/^\d{2}:\d{2}$/.test(start)&&/^\d{2}:\d{2}$/.test(end)&&start>='06:00'&&end<='23:00'&&start<end&&Number.isFinite(stamp(date,end))&&stamp(date,start)>now();
}
function validSlotSelection(){
 if(!slotSelection)return false;
 const {room,first,last}=slotSelection;
 return Number.isInteger(first)&&Number.isInteger(last)&&first>=0&&last<34&&first<=last&&!!rooms.find(r=>r.id===room)?.enabled&&(!roomFilter||Number(roomFilter)===room)&&validBookingTime(selected,slotTime(first),slotTime(last+1))&&!conflict({room,date:selected,start:slotTime(first),end:slotTime(last+1)});
}
const pickAvailableSlot=pickSlot;
pickSlot=function(room,index){if(slotSelection&&!validSlotSelection())slotSelection=null;pickAvailableSlot(room,index);};
const proceedAvailableSlots=proceedSlots;
proceedSlots=function(){
 if(slotSelection&&!validSlotSelection()){clearSlotSelection();return toast('This time is no longer available.');}
 return proceedAvailableSlots();
};
// Derive required markers from the actual form constraints, including conditional fields.
function markRequiredFields(root=document.getElementById('modal')){
 if(!root)return;
 root.querySelectorAll('label').forEach(label=>{
  const control=label.querySelector('input:not([type="hidden"]),select,textarea');
  const required=!!control&&control.required&&!control.disabled;
  const caption=label.querySelector('span')||label;
  let marker=caption.querySelector('.required-marker');
  if(required&&!marker){marker=document.createElement('span');marker.className='required-marker';marker.textContent=' *';marker.setAttribute('aria-hidden','true');if(caption===label)label.insertBefore(marker,control);else caption.appendChild(marker);}
  if(!required&&marker)marker.remove();
 });
}
const modalWithRequired=showModal;
showModal=function(html){modalWithRequired(html);markRequiredFields();};
const fellowshipWithRequired=syncFellowship;
syncFellowship=function(form){fellowshipWithRequired(form);markRequiredFields(form);};
const repeatWithRequired=repeatControls;
repeatControls=function(){repeatWithRequired();markRequiredFields();};
// booking-flow.js starts the app after the final booking controls load.

