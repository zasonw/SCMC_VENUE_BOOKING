'use strict';
Object.assign(translations,{'Assistant':'预约助手','Describe your booking':'描述预约需求','Prepare draft':'生成草稿','Preparing…':'正在准备…','Complete details':'补充资料','Draft only. Review before submitting.':'仅为草稿 请核对后提交','Add missing details in the booking form.':'请在预约表格中补充缺少的资料','Other available rooms':'其他可用场地','AI is unavailable. Use Book to continue.':'助手暂时不可用 请使用预约按钮','Please wait a minute before trying again.':'请稍等一分钟再试','Sign in to use the assistant.':'登录后使用预约助手','Enter your request in English or Chinese.':'可输入中文或英文','Not provided':'未填写','Available now':'目前可预约','Clash — choose another room or time.':'时段冲突 请更换场地或时间','Check recurring dates in the booking form.':'请在预约表格中核对重复日期','Request is sent to Cloudflare AI.':'需求文字将发送至 Cloudflare AI','Once':'单次','Weekly':'每周','Monthly':'每月'});
let assistantDraft=null;
const renderWithAssistant=render;
render=function(){renderWithAssistant();const nav=document.getElementById('nav');nav.insertAdjacentHTML('beforeend','<button onclick="openAssistant()">'+rt('Assistant')+'</button>');};
function openAssistant(){
 assistantDraft=null;
 if(!session){showModal(modalHead(rt('Assistant'))+'<div class="modal-body"><p>'+rt('Sign in to use the assistant.')+'</p></div><div class="modal-footer"><button class="primary" onclick="authForm()">'+rt('Sign in')+'</button></div>');return;}
 showModal(modalHead(rt('Assistant'))+'<form id="assistant-form" onsubmit="prepareAssistant(event)"><div class="modal-body"><label class="field"><span>'+rt('Describe your booking')+'</span><textarea name="request" required maxlength="2000" rows="4" placeholder="'+(language==='zh'?'明天晚上8点至10点 青团在新会议室查经':'Tomorrow 8–10pm, Bible study for 青团 in 新会议室')+'"></textarea></label><p class="section-note">'+rt('Enter your request in English or Chinese.')+' '+rt('Request is sent to Cloudflare AI.')+'</p><div id="assistant-error" role="alert"></div><div id="assistant-result" aria-live="polite"></div></div><div class="modal-footer"><button class="secondary" type="button" onclick="openClassicBooking()">'+rt('Book')+'</button><button class="primary" type="submit">'+rt('Prepare draft')+'</button></div></form>');
}
function assistantSummary(data){
 const d=data.draft,a=data.availability,rows=[['Venue',d.room?roomName(d.room):''],['Date',d.date],['Time',d.start&&d.end?d.start+'–'+d.end:''],['Purpose',d.purpose],['Fellowship',d.fellowship],['PIC',d.pic],['Repeat',rt({once:'Once',weekly:'Weekly',monthly:'Monthly'}[d.frequency])]];
 if(d.frequency!=='once')rows.push(['Until',d.until]);
 const availability=a?.kind==='single'?rt(a.available?'Available now':'Clash — choose another room or time.'):d.frequency!=='once'?rt('Check recurring dates in the booking form.'):'';
 let html='<h3>'+rt('Draft only. Review before submitting.')+'</h3><dl class="detail-grid">'+rows.map(([label,value])=>'<div><dt>'+rt(label)+'</dt><dd>'+esc(value||rt('Not provided'))+'</dd></div>').join('')+'</dl><p>'+availability+'</p>';
 if(a?.kind==='series')html+='<div class="assistant-dates">'+a.rows.map(row=>'<p>'+esc(row.date)+' · '+rt(row.available?'Available':'Clash')+'</p>').join('')+'</div>';
 if(data.alternatives?.length)html+='<p class="section-note">'+rt('Other available rooms')+'</p><div class="availability-rooms">'+data.alternatives.map(r=>'<button type="button" class="room-choice available" onclick="useAssistantDraft('+Number(r.id)+')">'+esc(r.name)+'</button>').join('')+'</div>';
 return html+'<p class="section-note">'+rt('Add missing details in the booking form.')+'</p><button type="button" class="primary" onclick="useAssistantDraft()">'+rt('Complete details')+'</button>';
}
async function prepareAssistant(event){
 event.preventDefault();const form=event.target,button=form.querySelector('[type="submit"]'),revision=sessionRevision;
 if(button.disabled)return;button.disabled=true;button.textContent=rt('Preparing…');assistantDraft=null;document.getElementById('assistant-result').innerHTML='';document.getElementById('assistant-error').textContent='';
 try{
  const {data:{session:current},error}=await db.auth.getSession();if(error||!current)throw Error('SIGN_IN');
  const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+current.access_token},body:JSON.stringify({message:form.elements.request.value}),signal:AbortSignal.timeout(45000)});
  const data=await response.json();if(!response.ok)throw Error(data.error||'AI_UNAVAILABLE');
  if(revision!==sessionRevision||document.getElementById('assistant-form')!==form||!document.getElementById('modal').open)return;
  assistantDraft=data.draft;document.getElementById('assistant-result').innerHTML=assistantSummary(data);
 }catch(error){if(revision===sessionRevision&&document.getElementById('assistant-form')===form)document.getElementById('assistant-error').textContent=rt(error.message==='SIGN_IN'?'Sign in to use the assistant.':error.message==='RATE_LIMIT'?'Please wait a minute before trying again.':'AI is unavailable. Use Book to continue.');}
 finally{button.disabled=false;button.textContent=rt('Prepare draft');}
}
function useAssistantDraft(alternative=null){
 if(!assistantDraft||!session)return;
 const d={...assistantDraft,room:alternative||assistantDraft.room};
 if(d.date)selected=d.date;
 openForm(d.room,null,d.start||null);
 const form=document.getElementById('booking-form');if(!form)return;
 for(const [key,value]of Object.entries({date:d.date,start:d.start,end:d.end,title:d.purpose}))form.elements[key].value=value||'';
 if(d.pic)form.elements.pic.value=d.pic;
 if(!d.room){form.elements.room.insertAdjacentHTML('afterbegin','<option value=""></option>');form.elements.room.value='';}
 if(d.fellowship){form.elements.fellowship_choice.value=fellowshipChoices.includes(d.fellowship)?d.fellowship:'__other__';form.elements.fellowship_other.value=d.fellowship;syncFellowship(form);}
 form.elements.repeat_frequency.value=d.frequency;form.elements.repeat_until.value=d.until||'';form.elements.repeat_monthly.value=d.monthly;
 form.querySelectorAll('[name="repeat_day"]').forEach(e=>{e.checked=d.weekdays.includes(Number(e.value));});repeatControls();markRequiredFields(form);
}
if(!window.__TEST__)startLive();
