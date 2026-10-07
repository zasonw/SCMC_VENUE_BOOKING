'use strict';
let repeatPreview=null,repeatRequestKey=null,repeatBusy=false,peopleCache=[],peopleAccounts=[];
Object.assign(translations,{
 'Repeat':'重复','Once':'单次','Weekly':'每周','Monthly':'每月','Until':'截止日期','Weekdays':'星期','Pattern':'方式','Same date':'相同日期','Same weekday':'相同星期',
 'Preview dates':'预览日期','Submit dates':'提交日期','Available':'可预约','Clash':'时段冲突','Past time':'时间已过','Recurring':'重复预约','Series':'系列','Approve series':'批准系列','Cancel series':'取消系列',
 'Choose an end date within the next six months.':'请选择未来六个月内的截止日期','Choose at least one weekday.':'请至少选择一个星期',
 'Choose a repeat pattern.':'请选择重复方式','Choose a monthly pattern.':'请选择每月重复方式','No dates match this repeat pattern.':'此重复方式没有符合的日期',
 'Select at least one available date.':'请至少选择一个可用日期','Select valid dates from the preview.':'请选择预览中的有效日期','Please preview the dates again.':'请重新预览日期',
 'No eligible bookings in this series.':'此系列没有可操作的预约','Series submitted.':'系列预约已提交','Series updated.':'系列预约已更新',
 'Dates are not reserved until submitted.':'提交后才会保留时段','Clashes are excluded. Uncheck any other dates to skip them.':'冲突日期已排除 也可取消勾选其他日期',
 'Months without this date or weekday are skipped.':'没有此日期或星期组合的月份将跳过',
 'Edit applies to this date only.':'修改仅适用于此日期','This cancels your pending dates only. Confirmed dates need an admin.':'仅取消您待审批的日期 已确认的日期须由管理员取消',
 'Approve all upcoming pending dates?':'批准系列中所有未来待审批日期？','Cancel all eligible dates in this series?':'取消此系列中所有可取消的日期？',
 'People':'人员','Add person':'添加人员','Edit person':'编辑人员','Fellowships':'团契标签','Account':'账号','No account':'未关联账号','Delete':'删除',
 'Separate tags with commas.':'多个标签请用逗号分隔','Search name or fellowship':'搜索姓名或团契','No people found.':'没有匹配人员','Person saved.':'人员已保存','Person removed.':'人员已移除',
 'Delete this directory entry? The login account is kept.':'删除此人员记录？登录账号将保留',
 'Use up to 20 short fellowship tags.':'最多可填写 20 个简短团契标签','Choose a registered account.':'请选择已注册的账号','Person not found.':'找不到此人员','This account is already linked to another person.':'此账号已关联其他人员',
 'Linking an account does not grant admin access.':'关联账号不会授予管理员权限'
});
const rt=s=>translateText(s);
async function recurringApi(action,payload={}){if(!db)throw Error('Connection failed. Please retry.');const {data,error}=await db.rpc('venue_recurring',{action,payload});if(error)throw error;return data;}
function sixMonthLimit(day=dayKey()){
 const [y,m,d]=day.split('-').map(Number),last=new Date(Date.UTC(y,m+6,0)).getUTCDate(),date=new Date(Date.UTC(y,m-1+6,Math.min(d,last)));
 return date.toISOString().slice(0,10);
}
function repeatFields(date){const dow=new Date(date+'T12:00:00+08:00').getUTCDay();return '<section class="repeat-fields wide"><label class="field"><span>Repeat</span><select name="repeat_frequency" onchange="repeatControls()"><option value="once">Once</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label><div id="repeat-options" hidden><label class="field"><span>Until</span><input type="date" name="repeat_until" min="'+date+'" max="'+sixMonthLimit()+'" disabled></label><fieldset id="repeat-weekdays"><legend>Weekdays</legend><div class="weekday-picks">'+[1,2,3,4,5,6,0].map(n=>'<label><input type="checkbox" name="repeat_day" value="'+n+'" '+(n===dow?'checked':'')+'><span>'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][n]+'</span></label>').join('')+'</div></fieldset><label class="field" id="repeat-monthly" hidden><span>Pattern</span><select name="repeat_monthly"><option value="date">Same date</option><option value="weekday">Same weekday</option></select><small id="monthly-pattern-label"></small><small>Months without this date or weekday are skipped.</small></label></div></section><section id="repeat-preview" class="wide" aria-live="polite"></section>';}
function clearRepeatPreview(){repeatPreview=null;repeatRequestKey=null;const box=document.getElementById('repeat-preview');if(box)box.innerHTML='';const form=document.getElementById('booking-form');if(form){const frequency=form.elements.repeat_frequency?.value;form.querySelector('[type="submit"]').textContent=rt(frequency&&frequency!=='once'?'Preview dates':'Submit booking');}}
function repeatControls(){
 const form=document.getElementById('booking-form');if(!form?.elements.repeat_frequency)return;
 const frequency=form.elements.repeat_frequency.value,repeat=frequency!=='once',until=form.elements.repeat_until;
 document.getElementById('repeat-options').hidden=!repeat;until.disabled=!repeat;until.required=repeat;until.min=form.elements.date.value;until.max=sixMonthLimit();
 document.getElementById('repeat-weekdays').hidden=frequency!=='weekly';document.getElementById('repeat-monthly').hidden=frequency!=='monthly';
 const date=form.elements.date.value;if(date){const ordinal=Math.floor((Number(date.slice(-2))-1)/7)+1;document.getElementById('monthly-pattern-label').textContent=language==='zh'?'每月第 '+ordinal+' 个'+dateLabel(date,{weekday:'long'}):['First','Second','Third','Fourth','Fifth'][ordinal-1]+' '+dateLabel(date,{weekday:'long'});}
 clearRepeatPreview();
}
const recurringOpenForm=openForm;
openForm=function(...args){
 repeatPreview=null;repeatRequestKey=null;recurringOpenForm(...args);
 const form=document.getElementById('booking-form');if(!form||!session||!liveReady)return;
 if(args[1]){const b=bookings.find(b=>b.id===args[1]);if(b?.series_id)form.querySelector('.modal-body').insertAdjacentHTML('afterbegin','<p class="notice">'+rt('Edit applies to this date only.')+'</p>');return;}
 if(args[3])return;
 form.querySelector('.form-grid').insertAdjacentHTML('beforeend',repeatFields(form.elements.date.value));
 form.addEventListener('input',event=>{if(event.target.name==='occurrence'){updateRepeatCount();return;}if(event.target.name==='date')repeatControls();else clearRepeatPreview();});
 applyLanguage(form);
};
function repeatPayload(form,block=false){const f=new FormData(form);return {title:f.get('title'),group:f.get('group'),pic:f.get('pic'),room:Number(f.get('room')),date:f.get('date'),start:f.get('start'),end:f.get('end'),contact:f.get('contact')||'',attendance:f.get('attendance')||'',notes:f.get('notes')||'',block,repeat:{frequency:f.get('repeat_frequency'),until:f.get('repeat_until'),monthly:f.get('repeat_monthly'),weekdays:f.getAll('repeat_day').map(Number)}};}
function renderRepeatPreview(rows){return '<p class="section-note">'+rt('Dates are not reserved until submitted.')+'</p><p class="section-note">'+rt('Clashes are excluded. Uncheck any other dates to skip them.')+'</p><div class="repeat-dates">'+rows.map(row=>'<label class="repeat-date '+(row.available?'':'clash')+'"><input name="occurrence" type="checkbox" value="'+esc(row.date)+'" '+(row.available?'checked':'disabled')+'><span>'+dateLabel(row.date,{weekday:'short',day:'numeric',month:'short',year:'numeric'})+'</span><small>'+rt(row.available?'Available':row.reason)+'</small></label>').join('')+'</div><p id="repeat-count" role="status"></p>';}
function updateRepeatCount(){const form=document.getElementById('booking-form');if(!form||!repeatPreview)return;const n=form.querySelectorAll('[name="occurrence"]:checked').length;document.getElementById('repeat-count').textContent=language==='zh'?'已选择 '+n+' 个日期':n+' dates selected';form.querySelector('[type="submit"]').textContent=rt('Submit dates')+' ('+n+')';}
function repeatError(error){const e=document.getElementById('form-error');if(e){e.textContent=rt(friendlyError(error));e.style.display='block';}else toast(friendlyError(error));}
const singleSubmitBooking=submitBooking;
submitBooking=async function(event,id,block){
 const form=event.target;if(id||block||!form.elements.repeat_frequency||form.elements.repeat_frequency.value==='once')return singleSubmitBooking(event,id,block);
 event.preventDefault();if(repeatBusy)return;const payload=repeatPayload(form),signature=JSON.stringify(payload),button=form.querySelector('[type="submit"]');repeatBusy=true;button.disabled=true;
 try{
  if(!repeatPreview||repeatPreview.signature!==signature){
   const rows=await recurringApi('preview',payload);
   if(document.getElementById('booking-form')!==form||JSON.stringify(repeatPayload(form))!==signature)return;
   repeatPreview={signature,rows};repeatRequestKey=crypto.randomUUID();document.getElementById('repeat-preview').innerHTML=renderRepeatPreview(rows);updateRepeatCount();return;
  }
  const dates=[...form.querySelectorAll('[name="occurrence"]:checked')].map(e=>e.value);if(!dates.length)throw Error('Select at least one available date.');
  await recurringApi('create',{...payload,dates,request_key:repeatRequestKey});
  selected=dates[0];month=selected.slice(0,7);slotSelection=null;closeModal();await refreshLive();toast('Series submitted.');
 }catch(error){repeatError(error);}finally{repeatBusy=false;button.disabled=false;}
};
const recurringOpenDetail=openDetail;
openDetail=function(id){recurringOpenDetail(id);const b=bookings.find(b=>b.id===id);if(!b?.series_id)return;const modal=document.getElementById('modal');modal.querySelector('.modal-body').insertAdjacentHTML('afterbegin','<p class="series-label">'+rt('Recurring')+'</p>');if(role==='admin'||b.owner==='member')modal.querySelector('.modal-footer').insertAdjacentHTML('afterbegin','<button class="secondary" onclick="openSeries(\''+b.series_id+'\')">'+rt('Series')+'</button>');};
function openSeries(id){
 const bs=bookings.filter(b=>b.series_id===id).sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start));if(!bs.length||!session||!(role==='admin'||bs.some(b=>b.owner==='member')))return;
 const approveCount=role==='admin'?bs.filter(b=>b.status==='pending'&&stamp(b.date,b.start)>now()).length:0,cancelCount=bs.filter(canCancel).length;
 showModal(modalHead(rt('Series'),esc(bs[0].title))+'<div class="modal-body">'+(role!=='admin'?'<p class="notice">'+rt('This cancels your pending dates only. Confirmed dates need an admin.')+'</p>':'')+'<div class="repeat-dates">'+bs.map(b=>'<button class="series-date" onclick="openDetail(\''+b.id+'\')"><span>'+dateLabel(b.date,{day:'numeric',month:'short',year:'numeric'})+' · '+esc(roomName(b.room))+' · '+timeLabel(b.start)+'</span>'+badge(b)+'</button>').join('')+'</div></div><div class="modal-footer">'+(cancelCount?'<button class="danger" onclick="seriesAction(\''+id+'\',\'cancel\')">'+rt('Cancel series')+' ('+cancelCount+')</button>':'')+(approveCount?'<button class="primary" onclick="seriesAction(\''+id+'\',\'approve\')">'+rt('Approve series')+' ('+approveCount+')</button>':'')+'</div>');
}
async function seriesAction(id,operation){if(mutationInFlight)return;if(!confirm(rt(operation==='approve'?'Approve all upcoming pending dates?':'Cancel all eligible dates in this series?')))return;mutationInFlight=true;try{await recurringApi('series_action',{series_id:id,operation});closeModal();await refreshLive();toast('Series updated.');}catch(error){toast(friendlyError(error));}finally{mutationInFlight=false;}}
const renderWithPeople=render;
render=function(){renderWithPeople();if(session&&role==='admin')document.getElementById('account-controls').insertAdjacentHTML('afterbegin','<button class="secondary" onclick="managePeople()">'+rt('People')+'</button>');};
function peopleRows(query=''){
 const q=query.trim().toLowerCase(),list=peopleCache.filter(p=>(p.name+' '+p.fellowships.join(' ')).toLowerCase().includes(q));
 return list.length?list.map(p=>'<div class="user-row"><div><strong>'+esc(p.name)+'</strong><div class="fellowship-tags">'+p.fellowships.map(t=>'<span>'+esc(t)+'</span>').join('')+'</div>'+(p.email?'<small>'+esc(p.email)+'</small>':'')+'</div><button class="secondary" onclick="editPerson(\''+p.id+'\')">'+rt('Edit')+'</button></div>').join(''):'<p>'+rt('No people found.')+'</p>';
}
async function managePeople(){if(role!=='admin')return;try{[peopleCache,peopleAccounts]=await Promise.all([recurringApi('people'),api('users')]);showModal(modalHead(rt('People'))+'<div class="modal-body"><div class="people-toolbar"><input type="search" placeholder="'+rt('Search name or fellowship')+'" aria-label="'+rt('Search name or fellowship')+'" oninput="document.getElementById(\'people-list\').innerHTML=peopleRows(this.value)"><button class="primary" onclick="editPerson()">'+rt('Add person')+'</button></div><div id="people-list">'+peopleRows()+'</div></div>');}catch(error){toast(friendlyError(error));}}
function editPerson(id=''){
 const p=peopleCache.find(p=>p.id===id);showModal(modalHead(rt(p?'Edit person':'Add person'))+'<form onsubmit="savePerson(event,\''+id+'\')"><div class="modal-body"><div class="form-grid"><label class="field wide"><span>Name</span><input name="name" required maxlength="120" value="'+esc(p?.name||'')+'"></label><label class="field wide"><span>Fellowships</span><textarea name="fellowships" maxlength="2400">'+esc(p?.fellowships.join(', ')||'')+'</textarea><small>Separate tags with commas.</small></label><label class="field wide"><span>Account <small>Optional</small></span><select name="user_id"><option value="">No account</option>'+peopleAccounts.map(a=>'<option value="'+a.id+'" '+(p?.user_id===a.id?'selected':'')+'>'+esc(a.name)+' · '+esc(a.email)+'</option>').join('')+'</select><small>Linking an account does not grant admin access.</small></label></div><div class="form-error" id="form-error" role="alert"></div></div><div class="modal-footer">'+(p?'<button type="button" class="danger" onclick="deletePerson(\''+p.id+'\')">Delete</button>':'')+'<button type="button" class="secondary" onclick="managePeople()">Back</button><button class="primary">Save</button></div></form>');
}
async function savePerson(event,id){event.preventDefault();if(mutationInFlight)return;mutationInFlight=true;const f=new FormData(event.target);try{await recurringApi('save_person',{id,name:String(f.get('name')).trim(),user_id:f.get('user_id')||null,fellowships:String(f.get('fellowships')).split(/[,，\n]/).map(t=>t.trim()).filter(Boolean)});await managePeople();toast('Person saved.');}catch(error){repeatError(error);}finally{mutationInFlight=false;}}
async function deletePerson(id){if(mutationInFlight||!confirm(rt('Delete this directory entry? The login account is kept.')))return;mutationInFlight=true;try{await recurringApi('delete_person',{id});await managePeople();toast('Person removed.');}catch(error){repeatError(error);}finally{mutationInFlight=false;}}

if(!window.__TEST__)startLive();
