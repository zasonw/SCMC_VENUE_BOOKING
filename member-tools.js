'use strict';
Object.assign(translations,{
 'My profile':'我的资料','Default fellowship':'默认团契','Profile saved.':'资料已保存',
 'Saved defaults are suggestions. You can change them for each booking.':'默认资料仅为建议 每次预约都可以更改',
 'Save as my default':'设为我的默认资料','Save these details to your profile?':'将这些资料保存为您的默认资料？',
 'Booked by':'预约人','Someone else':'其他负责人','Use saved details':'使用默认资料',
 'Use your saved name and fellowship?':'使用您保存的姓名和团契？',
 'Manage recurring':'管理重复预约','Choose a booking':'选择预约','This date':'仅本次','This and future dates':'本次及之后',
 'Edit occurrences':'修改重复预约','Skip occurrences':'取消重复预约','Change':'更改','Preview changes':'预览修改',
 'Previously modified':'曾单独修改','Choose which dates to include. Unchecked dates stay unchanged.':'请选择要修改的日期 未勾选的日期保持不变',
 'Approval restarts':'重新审批','Confirm changes':'确认修改','Confirm cancellation':'确认取消',
 'Choose at least one change.':'请至少选择一项修改','Choose an upcoming active occurrence.':'请选择尚未开始的有效预约',
 'Booking changed. Preview again.':'预约已发生变化 请重新预览','One or more dates conflict. Preview again.':'部分日期有冲突 请重新预览',
 'No upcoming recurring bookings.':'暂无未来重复预约','Changes saved.':'修改已保存',
 'Change dates one occurrence at a time.':'请逐次修改预约日期',
 'Select at least one available date.':'请至少选择一个可用日期',
 'Cancelled dates stay cancelled. Past dates are unchanged.':'已取消的日期不会恢复 过去的预约保持不变',
 'Apply to':'应用范围','Only checked fields will change.':'只修改勾选的资料',
 'Changes to venue, date or time restart approval.':'更改场地、日期或时间须重新审批',
 'Your profile stays unchanged when booking for someone else.':'代他人预约不会更改您的默认资料',
 'Enter a name and use at most 120 characters per field.':'请填写姓名 每项资料最多120个字符',
 'Reset':'重设','Skip':'取消本次','Choose an edit scope and operation.':'请选择修改范围和操作',
 'Invalid changes.':'修改资料无效'
});
async function memberRpc(name,action,payload={}){
 if(!session||!db)throw Error('Please sign in first.');
 const {data,error}=await db.rpc(name,{action,payload});if(error)throw error;return data;
}
const renderWithProfile=render;
render=function(){renderWithProfile();if(session)document.getElementById('account-controls').insertAdjacentHTML('afterbegin','<button class="secondary" onclick="openProfile()">'+rt('My profile')+'</button>');};
function openProfile(){
 if(!session)return authForm();
 showModal(modalHead(rt('My profile'))+'<form id="profile-form" onsubmit="saveProfile(event)"><div class="modal-body"><p class="section-note">'+rt('Saved defaults are suggestions. You can change them for each booking.')+'</p><div class="form-grid"><label class="field wide"><span>'+rt('Name')+' *</span><input name="name" required maxlength="120" autocomplete="name" value="'+esc(bookingProfile.name||me)+'"></label>'+fellowshipField(bookingProfile.fellowship||'')+'<label class="field wide"><span>'+rt('PIC contact')+' <small>'+rt('Optional')+'</small></span><input name="contact" maxlength="120" autocomplete="tel" value="'+esc(bookingProfile.contact||'')+'"></label></div><div class="form-error" id="form-error" role="alert"></div></div><div class="modal-footer"><button class="secondary" type="button" onclick="closeModal()">'+rt('Cancel')+'</button><button class="primary">'+rt('Save')+'</button></div></form>');
 const f=document.getElementById('profile-form');f.elements.fellowship_choice.required=false;markRequiredFields(f);
}
async function saveProfile(event){
 event.preventDefault();if(mutationInFlight)return;const form=event.target;syncFellowship(form);
 await persistProfile({name:form.elements.name.value,fellowship:form.elements.group.value,contact:form.elements.contact.value},form,true);
}
async function persistProfile(payload,form,close=false){
 if(mutationInFlight)return;const revision=sessionRevision;mutationInFlight=true;
 const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
 try{const profile=await memberRpc('venue_profile','save',payload);if(revision!==sessionRevision)return;bookingProfile=profile;if(close&&document.getElementById('profile-form')===form)closeModal();toast('Profile saved.');}
 catch(error){if(revision===sessionRevision)repeatError(error);}
 finally{mutationInFlight=false;buttons.forEach(b=>b.disabled=false);}
}
function fillFellowship(form,value){
 if(!form.elements.fellowship_choice)return;
 form.elements.fellowship_choice.value=fellowshipChoices.includes(value)?value:value?'__other__':'';
 form.elements.fellowship_other.value=value;syncFellowship(form);
}
function clearOtherPicContact(form){
 if(form.elements.pic.value.trim()!==form.dataset.suggestedPic&&form.dataset.suggestedContact==='yes'){
  form.elements.contact.value='';form.dataset.suggestedContact='no';
 }
}
function bookForOther(){
 const form=document.getElementById('booking-form');if(!form)return;
 form.elements.pic.value='';form.elements.contact.value='';form.dataset.suggestedContact='no';form.elements.pic.focus();
}
function saveBookingDefaults(){
 const form=document.getElementById('booking-form');if(!form||!confirm(rt('Save these details to your profile?')))return;
 syncFellowship(form);persistProfile({name:form.elements.pic.value,fellowship:form.elements.group.value,contact:form.elements.contact.value},form);
}
const formWithDefaults=openForm;
openForm=function(room=null,id=null,start=null,block=false){
 const b=id?bookings.find(x=>x.id===id):null;
 if(b?.series_id)return canManageOccurrence(b)?openOccurrenceEditor(id):toast('Choose an upcoming active occurrence.');
 formWithDefaults(room,id,start,block);
 const f=document.getElementById('booking-form');if(!f||!session||!liveReady||id||block)return;
 f.elements.pic.value=bookingProfile.name||me;
 f.elements.contact.value=bookingProfile.contact||'';
 fillFellowship(f,bookingProfile.fellowship||'');
 f.dataset.suggestedPic=f.elements.pic.value;f.dataset.suggestedContact='yes';
 f.elements.pic.addEventListener('input',()=>clearOtherPicContact(f));
 f.elements.contact.addEventListener('input',()=>{f.dataset.suggestedContact='no';});
 f.querySelector('.modal-body').insertAdjacentHTML('afterbegin','<p class="section-note">'+rt('Booked by')+': '+esc(me)+'</p>');
 f.querySelector('.form-grid').insertAdjacentHTML('beforeend','<div class="wide assistant-choices"><button type="button" class="secondary" onclick="bookForOther()">'+rt('Someone else')+'</button><button type="button" class="secondary" onclick="saveBookingDefaults()">'+rt('Save as my default')+'</button></div>');
 markRequiredFields(f);
};
function canManageOccurrence(b){return !!session&&!!b?.series_id&&(role==='admin'||b.owner==='member')&&['pending','confirmed'].includes(b.status)&&stamp(b.date,b.start)>now();}
const oldCanCancel=canCancel;
canCancel=function(b){return b?.series_id?canManageOccurrence(b):oldCanCancel(b);};
const cancelWithOccurrences=confirmCancel;
confirmCancel=function(id){const b=bookings.find(x=>x.id===id);if(canManageOccurrence(b))return openOccurrenceEditor(id,'one','cancel');return cancelWithOccurrences(id);};
const detailWithBooker=openDetail;
openDetail=function(id){
 detailWithBooker(id);const b=bookings.find(x=>x.id===id);if(!b)return;
 const modal=document.getElementById('modal');
 if(b.booked_by)modal.querySelector('.modal-body').insertAdjacentHTML('afterbegin','<p class="section-note">'+rt('Booked by')+': '+esc(b.booked_by)+'</p>');
 if(canManageOccurrence(b))modal.querySelector('.modal-footer').insertAdjacentHTML('afterbegin','<button class="secondary" onclick="openOccurrenceEditor(\''+id+'\',\'future\')">'+rt('This and future dates')+'</button>');
};
const occurrenceFields=[['room','Venue','room'],['date','Date','date'],['start','Start time','time'],['end','End time','time'],['title','Purpose','text'],['group','Fellowship','fellowship'],['pic','PIC','text'],['contact','PIC contact','text'],['attendance','Estimated attendance','number'],['notes','Notes','textarea']];
let occurrencePreview=null,occurrenceBusy=false;
function occurrenceControl(key,label,type,value){
 let input;
 if(type==='room')input='<select name="value_room" disabled>'+rooms.filter(r=>r.enabled||r.id===Number(value)).map(r=>'<option value="'+r.id+'" '+(r.id===Number(value)?'selected':'')+'>'+esc(r.name)+'</option>').join('')+'</select>';
 else if(type==='fellowship')input='<input name="value_group" list="edit-fellowships" maxlength="120" value="'+esc(value)+'" disabled><datalist id="edit-fellowships">'+fellowshipChoices.map(n=>'<option value="'+esc(n)+'">').join('')+'</datalist>';
 else if(type==='textarea')input='<textarea name="value_'+key+'" maxlength="1500" disabled>'+esc(value||'')+'</textarea>';
 else input='<input name="value_'+key+'" type="'+type+'" '+(type==='text'?'maxlength="120"':type==='number'?'min="1" step="1"':'')+' value="'+esc(value??'')+'" disabled>';
 return '<div class="field '+(['title','group','pic','contact','notes','room','date'].includes(key)?'wide':'time-field')+'"><label class="edit-check"><input type="checkbox" name="change_'+key+'" onchange="toggleOccurrenceField(this.form,\''+key+'\')"><span>'+rt(label)+'</span></label>'+input+'</div>';
}
function openOccurrenceEditor(id,scope='one',operation='edit'){
 const b=bookings.find(x=>x.id===id);if(!canManageOccurrence(b))return toast('Choose an upcoming active occurrence.');
 occurrencePreview=null;
 showModal(modalHead(rt(operation==='edit'?'Edit occurrences':'Skip occurrences'),esc(b.title)+' · '+esc(b.date))+'<form id="occurrence-form" onsubmit="previewOccurrence(event)"><div class="modal-body"><label class="field"><span>'+rt('Apply to')+'</span><select name="scope" onchange="openOccurrenceEditor(\''+id+'\',this.value,\''+operation+'\')"><option value="one" '+(scope==='one'?'selected':'')+'>'+rt('This date')+'</option><option value="future" '+(scope==='future'?'selected':'')+'>'+rt('This and future dates')+'</option></select></label><p class="section-note">'+rt('Cancelled dates stay cancelled. Past dates are unchanged.')+'</p>'+(operation==='edit'?'<p class="section-note">'+rt('Only checked fields will change.')+' '+rt('Changes to venue, date or time restart approval.')+'</p><div class="form-grid">'+occurrenceFields.filter(([key])=>key!=='date'||scope==='one').map(([key,label,type])=>occurrenceControl(key,label,type,b[key])).join('')+'</div>':'')+'<div class="form-error" id="form-error" role="alert"></div><div id="occurrence-preview" aria-live="polite"></div></div><div class="modal-footer"><button class="secondary" type="button" onclick="openDetail(\''+id+'\')">'+rt('Back')+'</button><button class="primary" type="submit">'+rt('Preview changes')+'</button></div></form>');
 const f=document.getElementById('occurrence-form');f.dataset.id=id;f.dataset.operation=operation;
 f.addEventListener('input',e=>{if(e.target.name!=='edit_id')invalidateOccurrencePreview();else updateOccurrenceSelection();});
}
function invalidateOccurrencePreview(){occurrencePreview=null;const box=document.getElementById('occurrence-preview');if(box)box.innerHTML='';}
function toggleOccurrenceField(form,key){
 const checked=form.elements['change_'+key].checked,input=form.elements['value_'+key];input.disabled=!checked;
 input.required=checked&&['room','date','start','end','title','group','pic'].includes(key);
 const label=form.elements['change_'+key].parentElement.querySelector('span');label.textContent=rt(occurrenceFields.find(f=>f[0]===key)[1])+(input.required?' *':'');
 // A new PIC must not inherit the previous PIC's contact.
 if(key==='pic'&&checked){form.elements.change_contact.checked=true;form.elements.value_contact.disabled=false;form.elements.value_contact.value='';}
 invalidateOccurrencePreview();
}
function occurrencePayload(form){
 const patch={};
 for(const [key]of occurrenceFields)if(form.elements['change_'+key]?.checked)patch[key]=key==='room'?Number(form.elements['value_'+key].value):form.elements['value_'+key].value;
 return {id:form.dataset.id,scope:form.elements.scope.value,operation:form.dataset.operation,patch};
}
function occurrenceSnapshot(rows){return Object.fromEntries(rows.map(r=>[r.id,r.version]));}
function selectedOccurrenceRows(form){return (occurrencePreview?.rows||[]).filter(r=>[...form.querySelectorAll('[name="edit_id"]:checked')].some(e=>e.value===r.id));}
async function previewOccurrence(event){
 event.preventDefault();const form=event.target;if(occurrenceBusy||mutationInFlight)return;
 const payload=occurrencePayload(form);if(payload.operation==='edit'&&!Object.keys(payload.patch).length)return repeatError(Error('Choose at least one change.'));
 const revision=sessionRevision,signature=JSON.stringify(payload);occurrenceBusy=true;form.querySelector('[type="submit"]').disabled=true;
 try{
  const rows=await memberRpc('venue_series_edit','preview',payload);
  if(revision!==sessionRevision||document.getElementById('occurrence-form')!==form||!document.getElementById('modal').open||signature!==JSON.stringify(occurrencePayload(form)))return;
  occurrencePreview={payload,signature,rows};
  document.getElementById('occurrence-preview').innerHTML='<h3>'+rt('Review booking')+'</h3><p>'+rt('Choose which dates to include. Unchecked dates stay unchanged.')+'</p><div class="repeat-dates">'+rows.map(r=>'<label class="repeat-date '+(r.available?'':'clash')+'"><input type="checkbox" name="edit_id" value="'+r.id+'" '+(r.available?(payload.scope==='one'||!r.exception?'checked':''):'disabled')+'><span>'+esc(r.date)+(r.new_date!==r.date?' → '+esc(r.new_date):'')+' · '+esc(roomName(r.room))+' · '+esc(r.start)+'–'+esc(r.end)+(r.exception?' · '+rt('Previously modified'):'')+'</span><small>'+rt(r.available?(payload.operation==='cancel'?'Cancel':r.reapproval?'Approval restarts':'Available'):r.reason)+'</small></label>').join('')+'</div><button type="button" class="'+(payload.operation==='cancel'?'danger':'primary')+'" id="occurrence-confirm" onclick="confirmOccurrence()">'+rt(payload.operation==='cancel'?'Confirm cancellation':'Confirm changes')+'</button>';
  updateOccurrenceSelection();document.getElementById('occurrence-preview').scrollIntoView({block:'nearest',behavior:'smooth'});
 }catch(error){if(revision===sessionRevision&&document.getElementById('occurrence-form')===form)repeatError(error);}
 finally{occurrenceBusy=false;form.querySelector('[type="submit"]').disabled=false;}
}
function updateOccurrenceSelection(){
 const form=document.getElementById('occurrence-form'),button=document.getElementById('occurrence-confirm');
 if(!form||!button||!occurrencePreview)return;
 const n=selectedOccurrenceRows(form).length;button.textContent=rt(occurrencePreview.payload.operation==='cancel'?'Confirm cancellation':'Confirm changes')+' ('+n+')';button.disabled=n===0;
}
async function confirmOccurrence(){
 const form=document.getElementById('occurrence-form');if(!form||!occurrencePreview||occurrenceBusy||mutationInFlight)return;
 if(JSON.stringify(occurrencePayload(form))!==occurrencePreview.signature){invalidateOccurrencePreview();return repeatError(Error('Booking changed. Preview again.'));}
 const selectedRows=selectedOccurrenceRows(form);if(!selectedRows.length)return repeatError(Error('Select at least one available date.'));
 const payload={...occurrencePreview.payload,ids:selectedRows.map(r=>r.id),versions:occurrenceSnapshot(selectedRows)};
 const revision=sessionRevision;occurrenceBusy=true;mutationInFlight=true;
 const controls=[...form.querySelectorAll('button,input,select,textarea')];controls.forEach(e=>e.disabled=true);
 try{
  await memberRpc('venue_series_edit','apply',payload);
  if(revision!==sessionRevision)return;
  if(document.getElementById('occurrence-form')===form)closeModal();await refreshLive();if(revision===sessionRevision)toast('Changes saved.');
 }catch(error){if(revision===sessionRevision&&document.getElementById('occurrence-form')===form){invalidateOccurrencePreview();repeatError(error);}}
 finally{occurrenceBusy=false;mutationInFlight=false;controls.forEach(e=>e.disabled=false);if(document.getElementById('occurrence-form')===form)for(const [key]of occurrenceFields)if(form.elements['change_'+key])form.elements['value_'+key].disabled=!form.elements['change_'+key].checked;}
}
function openMyRecurring(){
 if(!session)return authForm();
 const list=bookings.filter(b=>canManageOccurrence(b)&&b.owner==='member').sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
 showModal(modalHead(rt('Choose a booking'))+'<div class="modal-body"><div class="repeat-dates">'+(list.length?list.map(b=>'<button class="series-date" onclick="chooseRecurringAction(\''+b.id+'\')"><span>'+esc(b.date)+' · '+esc(b.title)+' · '+esc(roomName(b.room))+' · '+esc(b.start)+'</span>'+badge(b)+'</button>').join(''):'<p>'+rt('No upcoming recurring bookings.')+'</p>')+'</div></div>');
}
function chooseRecurringAction(id){
 const b=bookings.find(x=>x.id===id);if(!canManageOccurrence(b))return;
 showModal(modalHead(esc(b.title),esc(b.date)+' · '+esc(roomName(b.room)))+'<div class="modal-body"><p>'+rt('Apply to')+'</p>'+['one','future'].map(scope=>'<section class="assistant-choices"><strong>'+rt(scope==='one'?'This date':'This and future dates')+'</strong><button class="secondary" onclick="openOccurrenceEditor(\''+id+'\',\''+scope+'\',\'edit\')">'+rt('Edit')+'</button><button class="danger" onclick="openOccurrenceEditor(\''+id+'\',\''+scope+'\',\'cancel\')">'+rt('Cancel')+'</button></section>').join('')+'</div>');
}
let assistantOnBehalf=false,assistantProfileData=null;
const assistantOpenWithProfile=openAssistant;
openAssistant=function(){assistantOnBehalf=false;assistantProfileData=null;assistantOpenWithProfile();if(!session)return;
 const f=document.getElementById('assistant-form');if(!f)return;
 f.querySelector('.modal-body').insertAdjacentHTML('afterbegin','<div class="assistant-choices"><button type="button" class="secondary" onclick="openMyRecurring()">'+rt('Manage recurring')+'</button></div>');
};
function assistantUseDefaults(){
 if(!assistantDraft||assistantBusy||assistantRecognition)return;
 assistantOnBehalf=false;const name=bookingProfile.name||me;
 const parts=[];if(!assistantDraft.pic)parts.push('PIC: '+name);if(!assistantDraft.fellowship&&bookingProfile.fellowship)parts.push('fellowship: '+bookingProfile.fellowship);if(parts.length)assistantAnswer(parts.join('; '));
}
const summaryWithProfile=assistantSummary;
assistantSummary=function(data){
 assistantProfileData=data;const html=summaryWithProfile(data);
 if(!assistantOnBehalf&&(!data.draft.pic||!data.draft.fellowship)&&(bookingProfile.name||bookingProfile.fellowship))return '<p>'+rt('Use your saved name and fellowship?')+' '+esc(bookingProfile.name||me)+' · '+esc(bookingProfile.fellowship||'')+'</p><div class="assistant-choices"><button type="button" class="secondary" onclick="assistantUseDefaults()">'+rt('Use saved details')+'</button><button type="button" class="secondary" onclick="assistantOtherPerson()">'+rt('Someone else')+'</button></div>'+html;
 return html;
};
const useDraftWithProfile=useAssistantDraft;
useAssistantDraft=function(alternative=null){
 const draft=assistantDraft;useDraftWithProfile(alternative);
 const f=document.getElementById('booking-form');if(!f||!draft)return;
 // The assistant never silently assigns a saved fellowship or PIC.
 f.elements.pic.value=draft.pic||'';fillFellowship(f,draft.fellowship||'');
 f.elements.contact.value=!assistantOnBehalf&&draft.pic&&(draft.pic===(bookingProfile.name||me))?bookingProfile.contact||'':'';
 f.dataset.suggestedPic=f.elements.pic.value;f.dataset.suggestedContact='yes';
};
const prepareWithRecurring=prepareAssistant;
prepareAssistant=function(event){
 const message=event.target.elements.request.value;
 if(!assistantDraft&&!assistantBusy&&/((edit|cancel|skip|change|manage).*(recurring|series|my booking))|((修改|取消|跳过|管理).*(重复|预约|預約))/i.test(message)){
  event.preventDefault();stopAssistantVoice();return openMyRecurring();
 }
 return prepareWithRecurring(event);
};


function assistantOtherPerson(){
 if(!assistantDraft||assistantBusy||assistantRecognition)return;
 assistantOnBehalf=true;assistantDraft.pic='';
 if(assistantProfileData){assistantProfileData.draft=assistantDraft;document.getElementById('assistant-result').innerHTML=assistantSummary(assistantProfileData);}
}
const profileReviewRows=reviewRows;
reviewRows=function(form){return '<div><dt>'+rt('Booked by')+'</dt><dd>'+esc(me)+'</dd></div>'+profileReviewRows(form);};
openSeries=function(id){
 const list=bookings.filter(b=>b.series_id===id).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
 if(!session||!list.length||!(role==='admin'||list.some(b=>b.owner==='member')))return;
 const first=list.find(canManageOccurrence),pending=role==='admin'?list.filter(b=>b.status==='pending'&&stamp(b.date,b.start)>now()).length:0;
 showModal(modalHead(rt('Series'),esc(list[0].title))+'<div class="modal-body"><p class="section-note">'+rt('Cancelled dates stay cancelled. Past dates are unchanged.')+'</p><div class="repeat-dates">'+list.map(b=>'<button class="series-date" onclick="openDetail(\''+b.id+'\')"><span>'+esc(b.date)+' · '+esc(roomName(b.room))+' · '+esc(b.start)+(b.is_exception?' · '+rt('Previously modified'):'')+'</span>'+badge(b)+'</button>').join('')+'</div></div><div class="modal-footer">'+(first?'<button class="secondary" onclick="openOccurrenceEditor(\''+first.id+'\',\'future\')">'+rt('Edit occurrences')+'</button><button class="danger" onclick="openOccurrenceEditor(\''+first.id+'\',\'future\',\'cancel\')">'+rt('Skip occurrences')+'</button>':'')+(pending?'<button class="primary" onclick="seriesAction(\''+id+'\',\'approve\')">'+rt('Approve series')+'</button>':'')+'</div>');
};
if(!window.__TEST__)startLive();
