'use strict';
Object.assign(translations,{
 'Next available':'下个可用时段','No available slots on this date.':'此日期没有可用时段', 'Account':'账号','Venue booking':'场地预约','Choose a date or open Slots to book.':'选择日期 或打开时段直接预约',
 'Your bookings':'我的预约','Manage your upcoming dates.':'查看和管理未来预约','Rooms':'场地',
 'Find a room for your gathering.':'查看场地和可用时段','Requests':'审批',
 'Review bookings and manage spaces.':'审批预约和管理场地',
 'When & where':'日期与场地','Activity':'活动资料','Person in charge':'负责人',
 'Choose fields to edit':'选择修改项目','Only selected fields change.':'只更改所选项目',
 'Previous day':'前一天','Next day':'后一天','Tap a start slot, then an end slot.':'先点开始时段 再点最后一个时段',
 'Swipe to see more rooms.':'左右滑动查看其他场地','Choose time, then room.':'选择时间 再选场地',
 'Date & time':'日期与时间','Choose a room':'选择场地','Booking details':'预约资料',
 'Required fields':'必填项目','Back to calendar':'返回日历','Sign in or register to book.':'登录或注册后即可预约'
});
function openAccountMenu(){
 showModal(modalHead(rt('Account'))+'<div class="modal-body ux-account-menu"><div class="ux-account-identity"><strong>'+esc(session?me:rt('Guest'))+'</strong><span>'+rt(session?(role==='admin'?'Admin':'Member'):'Sign in or register to book.')+'</span></div>'+
 (session?'<button class="secondary" onclick="openProfile()">'+rt('My profile')+'</button><button class="secondary" onclick="closeModal();navigate(\'mine\')">'+rt('My bookings')+'</button>'+
 (role==='admin'?'<button class="secondary" onclick="manageUsers()">'+rt('Users')+'</button><button class="secondary" onclick="managePeople()">'+rt('People')+'</button><button class="secondary" onclick="manageRooms()">'+rt('Rooms')+'</button>':'')+
 '<button class="secondary" onclick="signOut()">'+rt('Sign out')+'</button>':
 '<button class="primary" onclick="authForm()">'+rt('Sign in')+'</button><button class="secondary" onclick="authForm(\'signup\')">'+rt('Register')+'</button>')+'</div>');
}
const uxRenderBase=render;
render=function(){
 uxRenderBase();
 document.querySelector('.brand').textContent='SCMC';
 if(!document.querySelector('.scmc-brand-logo'))document.querySelector('.brand').insertAdjacentHTML('afterend','<img class="scmc-brand-logo" src="/scmc-logo.png?v=2" alt="SCMC church logo" width="88" height="88">');
 document.querySelector('.brand-sub').textContent=rt('Venue booking');
 const titles={schedule:['Venue calendar','Choose a date or open Slots to book.'],mine:['Your bookings','Manage your upcoming dates.'],rooms:['Rooms','Find a room for your gathering.'],admin:['Requests','Review bookings and manage spaces.']};
 const [title,subtitle]=titles[view]||titles.schedule;
 document.getElementById('heading').textContent=rt(title);document.getElementById('subtitle').textContent=rt(subtitle);
 document.getElementById('nav').setAttribute('aria-label',rt('Venue booking'));
 document.querySelectorAll('#nav button').forEach(b=>{if(b.classList.contains('active'))b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 document.getElementById('account-controls').insertAdjacentHTML('beforeend','<button class="secondary ux-account-button" onclick="openAccountMenu()">'+rt('Account')+'</button>');
};
Object.assign(translations,{'Choose month':'选择月份','Month':'月份','Year':'年份','Go':'前往'});
function adminMonthPickerAllowed(){return role==='admin'&&!!session&&window.matchMedia('(min-width:768px)').matches;}
function openMonthPicker(){
 if(!adminMonthPickerAllowed())return;
 const [year,value]=month.split('-');
 showModal(modalHead(rt('Choose month'))+'<form onsubmit="goToMonth(event)"><div class="modal-body form-grid"><label class="field"><span>'+rt('Month')+'</span><select name="month" required>'+Array.from({length:12},(_,i)=>{const m=String(i+1).padStart(2,'0');return '<option value="'+m+'" '+(m===value?'selected':'')+'>'+new Intl.DateTimeFormat(language==='zh'?'zh-CN':'en',{month:'long'}).format(new Date(2026,i,1))+'</option>';}).join('')+'</select></label><label class="field"><span>'+rt('Year')+'</span><input name="year" type="number" min="1900" max="2100" step="1" required value="'+year+'"></label></div><div class="modal-footer"><button class="secondary" type="button" onclick="closeModal()">'+rt('Cancel')+'</button><button class="primary" type="submit">'+rt('Go')+'</button></div></form>');
}
function goToMonth(event){
 event.preventDefault();if(!adminMonthPickerAllowed())return;
 const f=event.target,y=f.elements.year.value,m=f.elements.month.value;
 if(!/^\d{4}$/.test(y)||+y<1900||+y>2100||! /^(0[1-9]|1[0-2])$/.test(m))return;
 month=y+'-'+m;selected=month+'-01';slotSelection=null;closeModal();render();
}
const uxCalendarHTML=calendarHTML;
calendarHTML=function(){
 const html=uxCalendarHTML();if(role!=='admin'||!session)return html;
 return html.replace(/<h2>(.*?)<\/h2>/,'<h2><span class="ux-month-static">$1</span><button class="ux-month-picker" onclick="openMonthPicker()" aria-haspopup="dialog">$1</button></h2>');
};
const uxSlotGrid=slotGridHTML;
slotGridHTML=function(){
 let html=uxSlotGrid();
 const controls='<div class="ux-day-controls"><button type="button" class="secondary" onclick="shiftDay(-1)">'+rt('Previous day')+'</button><button type="button" class="secondary" onclick="selectDay(dayKey())">'+rt('Today')+'</button><button type="button" class="secondary" onclick="shiftDay(1)">'+rt('Next day')+'</button></div><p class="ux-slot-hint">'+rt('Tap a start slot, then an end slot.')+' '+rt('Swipe to see more rooms.')+'</p>';
 return html.replace('<div class="slot-legend">',controls+'<div class="ux-slot-jump"><button type="button" class="secondary" onclick="jumpToAvailableSlot()">'+rt('Next available')+'</button><span class="slot-availability-message" role="status" hidden>'+rt('No available slots on this date.')+'</span></div><div class="slot-legend">');
};
function uxSection(title,n,fields){
 const section=document.createElement('section');section.className='ux-form-section wide';
 const heading=document.createElement('h3');heading.textContent=n+' · '+rt(title);section.append(heading);
 const grid=document.createElement('div');grid.className='form-grid';fields.filter(Boolean).forEach(field=>grid.append(field));section.append(grid);return section;
}
function uxBookingForm(){
 const form=document.getElementById('booking-form');if(!form||form.classList.contains('ux-booking-form'))return;
 const grid=form.querySelector('.form-grid');if(!grid)return;
 form.classList.add('ux-booking-form');
 const field=name=>form.elements[name]?.closest('.field');
 const fellowship=form.elements.fellowship_choice?.closest('.wide')||field('group');
 const schedule=uxSection('When & where',1,['date','start','end','room'].map(field));
 const activity=uxSection('Activity',2,[field('title'),fellowship]);
 const pic=uxSection('Person in charge',3,[field('pic')]);
 const actions=grid.querySelector('.assistant-choices');if(actions)pic.append(actions);
 grid.prepend(schedule,activity,pic);
 // Preserve controls, their values, event listeners and validation while grouping.
 applyLanguage(form);markRequiredFields(form);
}
const uxOpenForm=openForm;
openForm=function(...args){const result=uxOpenForm(...args);uxBookingForm();return result;};
const uxClassic=openClassicBooking;
openClassicBooking=function(){
 uxClassic();
 const picker=document.querySelector('#modal .classic-picker');if(!picker)return;
 picker.insertAdjacentHTML('afterbegin','<div class="ux-step-label">1 · '+rt('Date & time')+'</div>');
 const roomsBox=picker.querySelector('#classic-rooms');
 roomsBox.insertAdjacentHTML('beforebegin','<div class="ux-step-label">2 · '+rt('Choose a room')+'</div>');
};
const uxOpenOccurrence=openOccurrenceEditor;
openOccurrenceEditor=function(...args){
 const result=uxOpenOccurrence(...args),form=document.getElementById('occurrence-form');if(!form)return result;
 form.classList.add('ux-occurrence-form');
 for(const [key,label]of occurrenceFields){
  const control=form.elements['value_'+key];if(!control)continue;
  control.closest('.field').classList.add('ux-edit-field');
  control.setAttribute('aria-label',rt(label));
 }
 const grid=form.querySelector('.form-grid');
 if(grid)grid.insertAdjacentHTML('beforebegin','<h3 class="ux-step-label">'+rt('Choose fields to edit')+'</h3>');
 return result;
};
const uxInvalidate=invalidateOccurrencePreview;
invalidateOccurrencePreview=function(){
 uxInvalidate();const form=document.getElementById('occurrence-form');if(form){form.querySelector('#occurrence-confirm')?.remove();form.classList.remove('ux-review-ready');}
};
const uxPreview=previewOccurrence;
previewOccurrence=async function(event){
 await uxPreview(event);
 const form=document.getElementById('occurrence-form');if(form!==event.target)return;
 const button=form.querySelector('#occurrence-confirm');if(!button)return;
 form.querySelector('.modal-footer').append(button);form.classList.add('ux-review-ready');
};
// Mobile navigation should land at the start of the newly selected page.
const uxNavigate=navigate;
navigate=function(v){uxNavigate(v);if(window.matchMedia?.('(max-width:700px)').matches)window.scrollTo({top:0,behavior:'instant'});};
if(!window.__TEST__)startLive();
