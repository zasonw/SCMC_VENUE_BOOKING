'use strict';
Object.assign(translations,{
 'Continue':'继续','Review before submitting.':'提交前请确认预约资料',
 'Change':'修改','min':'分钟','Tap to change':'点击修改','Review booking':'确认预约资料',
 'Help':'帮助','Language':'语言','Prev':'上月','Bookings':'预约',
 'Expand':'放大','Done':'完成',
 'Skip to content':'跳到主要内容','Booking slots':'预约时段',
 'View day':'查看当天','View slots':'查看时段','more':'更多','Status':'状态','Filters':'筛选','Next available':'下个可用时段','No available slots on this date.':'此日期没有可用时段', 'Account':'账号','Venue booking':'场地预约','Choose a date or open Slots to book.':'选择日期 或打开时段直接预约',
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
// Shared outline icons: static SVG paths, no external font or network dependency.
const uiIconPaths={
 calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
 rooms:'<path d="M4 21h16M7 21V4l10-1v18M13 12h.01"/>',
 bookings:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 11h6m-6 4h6"/>',
 admin:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 filters:'<path d="M4 7h8m4 0h4M4 17h3m4 0h9"/><circle cx="14" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
 cancel:'<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',
 blocked:'<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
 activity:'<path d="M5 4h14v17H5zM9 8h6m-6 4h6m-6 4h4"/>'
};
function uiIcon(name){return '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+(uiIconPaths[name]||uiIconPaths.calendar)+'</svg>';}
function addUiIcon(element,name){
 if(!element||element.querySelector(':scope > .ui-icon'))return;
 element.insertAdjacentHTML('afterbegin',uiIcon(name));element.classList.add('has-ui-icon');
}
function polishUi(root=document){
 const navigation={schedule:'calendar',rooms:'rooms',mine:'bookings',admin:'admin'};
 root.querySelectorAll('#nav button').forEach(button=>{
  const match=button.getAttribute('onclick')?.match(/navigate\('([^']+)'\)/);if(match)addUiIcon(button,navigation[match[1]]);
 });
 for(const [selector,name] of [['.ux-account-button','user'],['.notification-button','bell'],['.phone-filter-toggle','filters'],['.ux-header-actions .primary','plus']]){
  root.querySelectorAll(selector).forEach(element=>addUiIcon(element,name));
 }
 root.querySelectorAll('.ux-form-section h3').forEach((heading,i)=>addUiIcon(heading,['calendar','activity','user'][i]||'activity'));
 root.querySelectorAll('.badge').forEach(badge=>{
  const kind=['confirmed','pending','cancelled','rejected','expired','blocked'].find(k=>badge.classList.contains(k));
  if(kind)addUiIcon(badge,{confirmed:'check',pending:'clock',cancelled:'cancel',rejected:'cancel',expired:'clock',blocked:'blocked'}[kind]);
 });
}
function openAccountMenu(){
 showModal(modalHead(rt('Account'))+'<div class="modal-body ux-account-menu"><div class="ux-account-identity"><strong>'+esc(session?me:rt('Guest'))+'</strong><span>'+rt(session?(role==='admin'?'Admin':'Member'):'Sign in or register to book.')+'</span></div>'+
 (session?'<button class="secondary" onclick="openNotifications()">'+rt('Notifications')+(notificationState.unread?' ('+notificationState.unread+')':'')+'</button><button class="secondary" onclick="openProfile()">'+rt('My profile')+'</button><button class="secondary" onclick="closeModal();navigate(\'mine\')">'+rt('My bookings')+'</button>'+
 (role==='admin'?'<button class="secondary" onclick="manageUsers()">'+rt('Users')+'</button><button class="secondary" onclick="managePeople()">'+rt('People')+'</button><button class="secondary" onclick="manageRooms()">'+rt('Rooms')+'</button>':'')+
 '<button class="secondary" onclick="signOut()">'+rt('Sign out')+'</button>':
 '<button class="primary" onclick="authForm()">'+rt('Sign in')+'</button><button class="secondary" onclick="authForm(\'signup\')">'+rt('Register')+'</button>')+'<button class="secondary" onclick="closeModal();refreshLive()">'+rt('Refresh')+'</button></div>');
 const languages=document.querySelector('.topbar .language-switch')?.cloneNode(true);
 if(languages){languages.setAttribute('aria-label',rt('Language'));document.querySelector('.ux-account-menu').prepend(languages);}
}
function updateAccountUnread(){
 const button=document.querySelector('.ux-account-button');if(!button)return;
 button.textContent=rt('Account');
 if(session&&notificationState.unread){const badge=document.createElement('span');badge.className='account-unread';badge.textContent=notificationState.unread;badge.setAttribute('aria-label',rt('Notifications'));button.append(badge);}
}
const uxNotificationButton=notificationButton;
notificationButton=function(){uxNotificationButton();updateAccountUnread();polishUi();};
function addAgendaSlots(root){
 const foot=root?.querySelector('.agenda-foot');
 if(!foot)return;
 // Past days are for looking up events, not starting a booking.
 if(selected<dayKey()){foot.remove();return;}
 const button=document.createElement('button');button.type='button';button.className='primary';button.textContent=rt('View slots');
 button.onclick=()=>{if(document.getElementById('modal').open)closeModal();setMode('venues');};
 foot.replaceChildren(button);
}
showAgenda=function(){showModal(modalHead(rt('Selected day'))+agendaHTML());addAgendaSlots(document.getElementById('modal'));};
const uxSelectCalendarDay=selectDay;
selectDay=function(date){
 const openDay=view==='schedule'&&mode==='calendar'&&window.matchMedia?.('(max-width:700px)').matches;
 uxSelectCalendarDay(date);
 if(openDay)showAgenda();
};
const uxLiveStatus=liveStatus;
liveStatus=function(text,error=false){uxLiveStatus(text,error);if(error||liveReady)document.querySelector('.calendar-grid')?.classList.remove('calendar-wait');document.querySelector('.connection-bar')?.classList.toggle('sync-idle',text==='Shared calendar'&&!error);};
let phoneFiltersOpen=false;
let slotsExpanded=false;
function toggleSlotWorkspace(){
 slotsExpanded=!slotsExpanded;applySlotWorkspace();
}
function applySlotWorkspace(){
 const grid=document.querySelector('.slot-scroll');
 const expanded=!!grid&&slotsExpanded;
 document.body.classList.toggle('slots-expanded',expanded);
 const panel=grid?.closest('.panel');
 panel?.classList.add('slot-workspace');
 panel?.classList.toggle('is-expanded',expanded);
 const button=document.querySelector('.slot-expand');
 if(button){button.textContent=rt(expanded?'Done':'Expand');button.setAttribute('aria-pressed',String(expanded));}
}
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&slotsExpanded&&!document.getElementById('modal').open){slotsExpanded=false;applySlotWorkspace();document.querySelector('.slot-expand')?.focus({preventScroll:true});}
});
// Motion is presentation-only: never delay input, closing, or saving.
const uiMotionPreference=window.matchMedia?.('(prefers-reduced-motion: reduce)');
const uiMotionActive=new Set();
function uiTransition(element,kind='fade'){
 if(!element?.animate||uiMotionPreference?.matches)return;
 for(const animation of uiMotionActive){if(animation.effect?.target===element){animation.cancel();uiMotionActive.delete(animation);}}
 const frames=kind==='dialog'?[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}]:[{opacity:.35},{opacity:1}];
 const animation=element.animate(frames,{duration:kind==='dialog'?200:150,easing:'ease-in-out'});
 uiMotionActive.add(animation);
 const clean=()=>uiMotionActive.delete(animation);animation.onfinish=clean;animation.oncancel=clean;
}
uiMotionPreference?.addEventListener?.('change',event=>{if(event.matches){for(const animation of uiMotionActive)animation.cancel();uiMotionActive.clear();}});
let uiPreviousView=null;
const uxRenderBase=render;
render=function(){
 // Keep the single assistant launcher alive when the old slot panel is replaced.
 const launcher=document.getElementById('assistant-launcher');
 if(launcher?.closest('.slot-proceed,.calendar-tools'))document.body.append(launcher);
 uxRenderBase();
 const main=document.querySelector('.main');
 if(main){main.id='main-content';main.tabIndex=-1;}
 let skip=document.querySelector('.ux-skip-link');
 if(!skip){skip=document.createElement('a');skip.className='ux-skip-link';skip.href='#main-content';document.body.prepend(skip);}
 skip.textContent=rt('Skip to content');
 document.querySelectorAll('.seg button').forEach(button=>button.setAttribute('aria-pressed',String(button.classList.contains('active'))));
 const scroll=document.querySelector('.slot-scroll');
 if(scroll){scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label',rt('Booking slots'));}

 document.querySelector('.sidebar .scmc-brand-logo')?.remove();
 const topbar=document.querySelector('.topbar');
 if(!topbar.querySelector('.phone-brand')){const brand=document.createElement('div');brand.className='phone-brand';brand.innerHTML='<img src="/scmc-mark.png" alt="" width="28" height="28"><strong>SCMC</strong>';topbar.prepend(brand);}
 const chinese=topbar.querySelector('[data-language=zh]');if(chinese){chinese.textContent='中文';chinese.setAttribute('aria-label','简体中文');}
 document.querySelector('.connection-bar')?.classList.toggle('sync-idle',lastSyncText==='Shared calendar'&&!lastSyncError);
 document.querySelector('.brand').innerHTML='<img class="scmc-brand-logo" src="/scmc-mark.png" alt="" width="44" height="44"><span>SCMC</span>';
 document.querySelector('.brand-sub').textContent=rt('Venue Booking');
 const titles={schedule:['Venue booking','Choose a date or open Slots to book.'],mine:['Your bookings','Manage your upcoming dates.'],rooms:['Rooms','Find a room for your gathering.'],admin:['Requests','Review bookings and manage spaces.']};
 const [title,subtitle]=titles[view]||titles.schedule;
 document.getElementById('heading').textContent=rt(title);document.getElementById('subtitle').textContent=rt(subtitle);
 document.getElementById('nav').setAttribute('aria-label',rt('Venue booking'));
 document.querySelectorAll('#nav button').forEach(b=>{if(b.classList.contains('active'))b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 if(view==='schedule'&&mode==='calendar'){
  const layout=document.querySelector('.calendar-layout');
  if(layout){
   const bar=document.createElement('div');bar.className='selected-day-bar';
   bar.innerHTML='<div><small>'+rt('Selected day')+'</small><strong>'+dateLabel(selected,{weekday:'short',day:'numeric',month:'short'})+'</strong></div><div class="selected-day-actions"><button class="secondary" onclick="showAgenda()">'+rt('View day')+'</button><button class="primary" onclick="setMode(\'venues\')">'+rt('View slots')+'</button></div>';
   layout.after(bar);
   addAgendaSlots(layout.querySelector('.agenda'));
   if(selected<dayKey())bar.querySelector('.primary')?.remove();
  }
  document.querySelectorAll('.calendar-grid .day').forEach(day=>{
   const chips=[...day.querySelectorAll('.event-chip')];
   chips.forEach(chip=>{
    const time=chip.querySelector('.event-name');if(!time)return;
    const room=document.createElement('span');room.className='calendar-room';room.textContent=chip.firstChild.textContent;
    chip.firstChild.replaceWith(room);time.textContent=time.textContent.replace(/^\s*·\s*/,'');
    chip.setAttribute('aria-label',room.textContent+' · '+time.textContent);chip.title=chip.getAttribute('aria-label');
   });
   if(chips.length<=3)return;
   chips.slice(3).forEach(chip=>chip.hidden=true);
   const more=document.createElement('button');more.type='button';more.className='calendar-more';more.textContent='+'+(chips.length-3)+' '+rt('more');
   more.onclick=event=>{event.stopPropagation();day.click();if(!document.getElementById('modal').open)showAgenda();};day.append(more);
  });
 }
 const filters=document.querySelector('.filters');
 if(filters){
  filters.classList.toggle('phone-filters-open',phoneFiltersOpen);
  const button=document.createElement('button');button.type='button';button.className='phone-filter-toggle secondary';button.textContent=rt('Filters')+((roomFilter||statusFilter)?' ('+[roomFilter,statusFilter].filter(Boolean).length+')':'');button.setAttribute('aria-expanded',String(phoneFiltersOpen));button.onclick=()=>{phoneFiltersOpen=!filters.classList.contains('phone-filters-open');filters.classList.toggle('phone-filters-open',phoneFiltersOpen);button.setAttribute('aria-expanded',String(phoneFiltersOpen));};
  filters.querySelector('select')?.after(button);
 }
 document.querySelectorAll('.month-controls button').forEach(button=>{if(button.textContent.trim()===rt('Previous'))button.textContent=rt('Prev');});
 const utility=document.querySelector('.ux-slot-jump'),help=document.querySelector('.slot-help');
 if(utility&&help)utility.append(help);
 const footer=document.querySelector('.slot-proceed');
 if(footer&&launcher)footer.append(launcher);
 updateSlotSummary();
 applySlotWorkspace();
 document.getElementById('account-controls').insertAdjacentHTML('beforeend','<button class="secondary ux-account-button" onclick="openAccountMenu()">'+rt('Account')+'</button>');
 updateAccountUnread();
 polishUi();
 if(view==='schedule'&&mode==='calendar'){
  document.body.classList.add('calendar-home');
  const toolbar=document.querySelector('.toolbar'),grid=document.querySelector('.calendar-grid');
  if(toolbar&&launcher){toolbar.classList.add('calendar-tools');toolbar.append(launcher);}
  const filter=toolbar?.querySelector('.phone-filter-toggle');
  if(filter){filter.setAttribute('aria-label',filter.textContent);filter.dataset.count=String([roomFilter,statusFilter].filter(Boolean).length);}
  const head=document.querySelector('.calendar-layout .panel-head');
  head?.classList.toggle('this-month',month===dayKey().slice(0,7));
  for(const b of head?.querySelectorAll('[onclick^="shiftMonth"]')||[]){const prev=b.getAttribute('onclick').includes('-');b.dataset.arrow=prev?'‹':'›';b.setAttribute('aria-label',language==='zh'?(prev?'上个月':'下个月'):(prev?'Previous month':'Next month'));}
  for(const day of grid?.children||[]){
   const strip=document.createElement('span');strip.className='busy-strip';strip.setAttribute('aria-hidden','true');
   const items=[...day.querySelectorAll('.event-chip')];
   for(const item of items.slice(0,3)){const dot=document.createElement('i');dot.className=item.classList.contains('pending')?'pending':item.classList.contains('blocked')?'blocked':'confirmed';strip.append(dot);}
   if(items.length>3)strip.append('+'+(items.length-3));day.append(strip);
  }
  grid?.classList.toggle('calendar-wait',!liveReady&&!lastSyncError);
  let start=null,swiped=false;
  grid?.addEventListener('touchstart',e=>{swiped=false;start=e.touches.length===1?[e.touches[0].clientX,e.touches[0].clientY]:null;},{passive:true});
  grid?.addEventListener('touchcancel',()=>{start=null;});
  grid?.addEventListener('touchend',e=>{if(!start||!window.matchMedia('(max-width:700px)').matches)return;const dx=e.changedTouches[0].clientX-start[0],dy=e.changedTouches[0].clientY-start[1];start=null;if(Math.abs(dx)>75&&Math.abs(dy)<30){swiped=true;shiftMonth(dx<0?1:-1);}}, {passive:true});
  grid?.addEventListener('click',e=>{if(swiped){e.stopImmediatePropagation();e.preventDefault();}},true);
 }else document.body.classList.remove('calendar-home');
 const motionView=view+':'+mode+':'+(mode==='calendar'?month:'');
 if(uiPreviousView!==null&&uiPreviousView!==motionView)uiTransition(document.getElementById('content'));
 uiPreviousView=motionView;
};
Object.assign(translations,{'Venue Booking':'场地预约','Day':'日期','Choose date':'选择日期','Choose month':'选择月份','Month':'月份','Year':'年份','Go':'前往'});
function adminMonthPickerAllowed(){return role==='admin'&&!!session&&window.matchMedia('(min-width:768px)').matches;}
function openMonthPicker(){
 if(!adminMonthPickerAllowed())return;
 const [year,value]=month.split('-');
 showModal(modalHead(rt('Choose date'))+'<form onsubmit="goToMonth(event)"><div class="modal-body form-grid"><label class="field"><span>'+rt('Month')+'</span><select name="month" required onchange="syncMonthPickerDays(this.form)">'+Array.from({length:12},(_,i)=>{const m=String(i+1).padStart(2,'0');return '<option value="'+m+'" '+(m===value?'selected':'')+'>'+new Intl.DateTimeFormat(language==='zh'?'zh-CN':'en',{month:'long'}).format(new Date(2026,i,1))+'</option>';}).join('')+'</select></label><label class="field"><span>'+rt('Year')+'</span><input name="year" onchange="syncMonthPickerDays(this.form)" type="number" min="1900" max="2100" step="1" required value="'+year+'"></label><label class="field wide"><span>'+rt('Day')+'</span><select name="day" required></select></label></div><div class="modal-footer"><button class="secondary" type="button" onclick="closeModal()">'+rt('Cancel')+'</button><button class="primary" type="submit">'+rt('Go')+'</button></div></form>');
 syncMonthPickerDays(document.querySelector('#modal form'),selected.startsWith(month)?selected.slice(-2):1);
}
function syncMonthPickerDays(form,preferred){
 const y=Number(form.elements.year.value),m=Number(form.elements.month.value);
 if(!Number.isInteger(y)||y<1900||y>2100||!m)return;
 const count=new Date(y,m,0).getDate(),day=Math.min(count,Number(preferred||form.elements.day.value||1));
 form.elements.day.innerHTML=Array.from({length:count},(_,i)=>'<option value="'+String(i+1).padStart(2,'0')+'" '+(i+1===day?'selected':'')+'>'+(i+1)+'</option>').join('');
}
function goToMonth(event){
 event.preventDefault();if(!adminMonthPickerAllowed())return;
 const f=event.target,y=f.elements.year.value,m=f.elements.month.value;
 if(!/^\d{4}$/.test(y)||+y<1900||+y>2100||! /^(0[1-9]|1[0-2])$/.test(m))return;
 const d=f.elements.day.value;if(!/^\d{2}$/.test(d)||+d<1||+d>new Date(+y,+m,0).getDate())return;
 month=y+'-'+m;selected=month+'-'+d;slotSelection=null;closeModal();render();
}
const uxCalendarHTML=calendarHTML;
calendarHTML=function(){
 const html=uxCalendarHTML();if(role!=='admin'||!session)return html;
 return html.replace(/<h2>(.*?)<\/h2>/,'<h2><span class="ux-month-static">$1</span><button class="ux-month-picker" onclick="openMonthPicker()" aria-haspopup="dialog">$1</button></h2>');
};
const uxSlotGrid=slotGridHTML;
slotGridHTML=function(){
 let html=uxSlotGrid();
 const controls='<div class="ux-day-controls"><button type="button" class="secondary" onclick="shiftDay(-1)">'+rt('Previous day')+'</button><button type="button" class="secondary" onclick="selectDay(dayKey())">'+rt('Today')+'</button><button type="button" class="secondary" onclick="shiftDay(1)">'+rt('Next day')+'</button></div><details class="slot-help"><summary>'+rt('Help')+'</summary><p class="ux-slot-hint">'+rt('Tap a start slot, then an end slot.')+' '+rt('Swipe to see more rooms.')+'</p></details>';
 return html.replace('<div class="slot-legend">',controls+'<div class="ux-slot-jump"><button type="button" class="secondary slot-expand" onclick="toggleSlotWorkspace()" aria-pressed="false">'+rt('Expand')+'</button><button type="button" class="secondary" onclick="jumpToAvailableSlot()">'+rt('Next available')+'</button><span class="slot-availability-message" role="status" hidden>'+rt('No available slots on this date.')+'</span></div><div class="slot-legend">');
};
function updateSlotSummary(){
 const next=document.querySelector('.slot-proceed-actions .primary');if(next)next.textContent=rt('Continue');
 const summary=document.querySelector('.slot-summary');if(!summary||!slotSelection)return;
 const {room,first,last}=slotSelection;
 summary.replaceChildren();
 const name=document.createElement('strong');name.textContent=roomName(room);
 const time=document.createElement('span');time.textContent=slotTime(first)+'–'+slotTime(last+1)+' · '+((last-first+1)*30)+' '+rt('min');
 summary.append(name,time);
}
const uxUpdateSlotSelection=updateSlotSelection;
updateSlotSelection=function(){uxUpdateSlotSelection();updateSlotSummary();};
function updateScheduleSummary(form){
 const summary=form.querySelector('.booking-schedule-summary');if(!summary)return;
 const f=form.elements;
 const room=roomName(Number(f.room.value)),date=f.date.value,start=f.start.value,end=f.end.value;
 summary.querySelector('strong').textContent=room;
 summary.querySelector('.schedule-time').textContent=(date?dateLabel(date,{day:'numeric',month:'short',year:'numeric'}):rt('Choose date'))+' · '+start+'–'+end;
}
function uxSection(title,n,fields){
 const section=document.createElement('section');section.className='ux-form-section wide';
 const heading=document.createElement('h3');heading.textContent=rt(title);section.append(heading);
 const grid=document.createElement('div');grid.className='form-grid';fields.filter(Boolean).forEach(field=>grid.append(field));section.append(grid);return section;
}
function uxBookingForm(){
 const form=document.getElementById('booking-form');if(!form||form.classList.contains('ux-booking-form'))return;
 const grid=form.querySelector('.form-grid');if(!grid)return;
 form.classList.add('ux-booking-form');
 const field=name=>form.elements[name]?.closest('.field');
 const fellowship=form.elements.fellowship_choice?.closest('.wide')||field('group');
 const schedule=uxSection('When & where',1,['room','date','start','end'].map(field));
 const activity=uxSection('Activity',2,[field('title'),fellowship]);
 const pic=uxSection('Person in charge',3,[field('pic')]);
 const actions=grid.querySelector('.assistant-choices');if(actions)pic.append(actions);
 const details=document.createElement('details');details.className='booking-schedule';
 const summary=document.createElement('summary');summary.className='booking-schedule-summary';
 summary.innerHTML='<span><strong></strong><span class="schedule-time"></span></span><span class="schedule-change">'+rt('Change')+'</span>';
 details.append(summary,schedule.querySelector('.form-grid'));schedule.append(details);
 grid.prepend(schedule,activity,pic);
 details.open=!validBookingTime(form.elements.date.value,form.elements.start.value,form.elements.end.value);
 updateScheduleSummary(form);
 form.addEventListener('input',()=>updateScheduleSummary(form));
 form.addEventListener('change',()=>updateScheduleSummary(form));
 form.addEventListener('invalid',event=>{if(details.contains(event.target))details.open=true;},true);
 // Slot, classic and assistant flows fill the end time after openForm returns.
 queueMicrotask(()=>{if(form.isConnected)updateScheduleSummary(form);});
 // Preserve controls, their values, event listeners and validation while grouping.
 applyLanguage(form);markRequiredFields(form);polishUi(form);
}
const uxOpenForm=openForm;
openForm=function(...args){const result=uxOpenForm(...args);uxBookingForm();if(!args[3]&&document.getElementById('booking-form')){const note=document.querySelector('#modal .modal-head p');if(note)note.textContent=rt('Review before submitting.');}return result;};
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
const uxBackFromReview=backFromReview;
backFromReview=function(...args){const result=uxBackFromReview(...args);uiTransition(document.querySelector('#booking-form > .modal-body'));return result;};
// Name every dialog and keep its heading visible when a multi-step flow replaces it.
const uxShowModal=showModal;
showModal=function(...args){
 const wasOpen=document.getElementById('modal').open;
 const result=uxShowModal(...args),modal=document.getElementById('modal');
 const heading=modal.querySelector('h2');
 if(heading){
  heading.id='ux-dialog-title';heading.tabIndex=-1;
  modal.setAttribute('aria-labelledby',heading.id);modal.removeAttribute('aria-label');
  heading.focus({preventScroll:true});modal.scrollTop=0;
 }else{modal.removeAttribute('aria-labelledby');modal.setAttribute('aria-label',rt('Booking details'));}
 polishUi(modal);
 uiTransition(modal,wasOpen?'fade':'dialog');
 return result;
};
if(!window.__TEST__)startLive();
