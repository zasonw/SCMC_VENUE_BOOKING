'use strict';
Object.assign(translations,{'Assistant':'预约助手','Describe your booking':'描述预约需求','Prepare draft':'生成草稿','Preparing…':'正在准备…','Complete details':'补充资料','Draft only. Review before submitting.':'仅为草稿 请核对后提交','Add missing details in the booking form.':'请在预约表格中补充缺少的资料','Other available rooms':'其他可用场地','AI is unavailable. Use Book to continue.':'助手暂时不可用 请使用预约按钮','Please wait a minute before trying again.':'请稍等一分钟再试','Sign in to use the assistant.':'登录后使用预约助手','Enter your request in English or Chinese.':'可输入中文或英文','Not provided':'未填写','Available now':'目前可预约','Clash — choose another room or time.':'时段冲突 请更换场地或时间','Check recurring dates in the booking form.':'请在预约表格中核对重复日期','Request is sent to Cloudflare AI.':'需求文字将发送至 Cloudflare AI','Once':'单次','Weekly':'每周','Monthly':'每月','Add details or ask to change the room, date or time.':'补充资料 或更改场地、日期和时间','New draft':'新草稿','Update draft':'更新草稿'});
let assistantDraft=null,assistantQuestion='',assistantBusy=false;
function assistantRequest(message){return assistantDraft?'Update this previous booking draft using the latest request. Keep unchanged details. Only repeat if explicitly requested. Previous draft: '+JSON.stringify(assistantDraft)+'\nQuestion being answered: '+assistantQuestion+'\nLatest request: '+message:message;}
const renderWithAssistant=render;
render=function(){renderWithAssistant();const launcher=document.getElementById('assistant-launcher');if(launcher){launcher.setAttribute('aria-label',rt('Assistant'));launcher.title=rt('Assistant');}};
function openAssistant(){
 assistantDraft=null;assistantQuestion='';
 if(!session){showModal(modalHead(rt('Assistant'))+'<div class="modal-body"><p>'+rt('Sign in to use the assistant.')+'</p></div><div class="modal-footer"><button class="primary" onclick="authForm()">'+rt('Sign in')+'</button></div>');return;}
 showModal(modalHead(rt('Assistant'))+'<form id="assistant-form" onsubmit="prepareAssistant(event)"><div class="modal-body"><div id="assistant-conversation" class="assistant-conversation" aria-live="polite"></div><label class="field"><span>'+rt('Describe your booking')+'</span><textarea name="request" required maxlength="1000" rows="4" placeholder="'+(language==='zh'?'明天晚上8点至10点 青团在新会议室查经':'Tomorrow 8–10pm, Bible study for 青团 in 新会议室')+'"></textarea></label>'+assistantVoiceHTML()+'<p class="section-note">'+rt('Enter your request in English or Chinese.')+' '+rt('Request is sent to Cloudflare AI.')+'</p><div id="assistant-error" role="alert"></div><div id="assistant-result" aria-live="polite"></div></div><div class="modal-footer"><button class="secondary" type="button" onclick="openClassicBooking()">'+rt('Book')+'</button><button class="primary" type="submit">'+rt('Send')+'</button></div></form>');
}

Object.assign(translations,{
 'Send':'发送','Which room would you like?':'您想预约哪个场地？',
 'Which date?':'您想预约哪一天？','What start and end time? Please include AM or PM.':'几点开始和结束？请说明早上、下午或晚上',
 'What is the activity or purpose?':'这次预约是什么活动？','Which fellowship?':'您属于哪个团契？',
 'Who is the PIC?':'负责人是谁？','Until which date should this repeat?':'重复预约到哪一天？',
 'Which weekdays should repeat?':'每周哪几天重复？','Choose a future time between 6am and 11pm, with the end after the start.':'请选择早上6点至晚上11点内的未来时段 结束时间须晚于开始时间',
 'Choose another room or change the time.':'请选择其他场地 或更改时间',
 'Ready to review. Nothing has been booked yet.':'可以核对预约了 目前尚未提交',
 'Try another time':'试试其他时间','Same room, later times':'同一场地的较晚时段',
 'Review and submit':'核对并提交','Today':'今天','Tomorrow':'明天','Use my name':'使用我的姓名',
 'Please check availability again.':'请重新检查时段','Continue':'继续'
});
function assistantNext(d){
 if(!d.date)return ['date','Which date?'];
 if(!d.start||!d.end)return ['time','What start and end time? Please include AM or PM.'];
 if(!validBookingTime(d.date,d.start,d.end))return ['time','Choose a future time between 6am and 11pm, with the end after the start.'];
 if(!d.room||!rooms.some(r=>r.id===d.room&&r.enabled))return ['room','Which room would you like?'];
 if(!d.purpose)return ['purpose','What is the activity or purpose?'];
 if(!d.fellowship)return ['fellowship','Which fellowship?'];
 if(!d.pic)return ['pic','Who is the PIC?'];
 if(d.frequency!=='once'&&(!d.until||d.until<d.date))return ['until','Until which date should this repeat?'];
 if(d.frequency==='weekly'&&!d.weekdays?.length)return ['weekdays','Which weekdays should repeat?'];
 return null;
}
function assistantChip(label,message){
 return '<button type="button" class="secondary" onclick="'+esc('assistantAnswer('+JSON.stringify(message)+')')+'">'+esc(label)+'</button>';
}
function assistantSummary(data){
 const d=data.draft,a=data.availability,next=assistantNext(d);
 const rows=[['Venue',d.room?roomName(d.room):''],['Date',d.date],['Time',d.start&&d.end?d.start+'–'+d.end:''],['Purpose',d.purpose],['Fellowship',d.fellowship],['PIC',d.pic],['Repeat',rt({once:'Once',weekly:'Weekly',monthly:'Monthly'}[d.frequency]||'Once')]];
 let question=next?next[1]:a?.kind==='single'&&a.available?'Ready to review. Nothing has been booked yet.':d.frequency!=='once'?'Check recurring dates in the booking form.':'Please check availability again.';
 if(a?.kind==='single'&&!a.available)question='Choose another room or change the time.';
 assistantQuestion=question;
 let choices='';
 if(next?.[0]==='room')choices=rooms.filter(r=>r.enabled).map(r=>assistantChip(r.name,'Use room '+r.name)).join('');
 if(next?.[0]==='fellowship')choices=fellowshipChoices.map(f=>assistantChip(f,'Fellowship: '+f)).join('');
 if(next?.[0]==='pic'&&me)choices=assistantChip(rt('Use my name')+' · '+me,'PIC: '+me);
 if(next?.[0]==='date')choices=assistantChip(rt('Today'),'Date: today')+assistantChip(rt('Tomorrow'),'Date: tomorrow');
 if(data.alternatives?.length)choices+=data.alternatives.map(r=>assistantChip(r.name,'Change room to '+r.name)).join('');
 let html='<h3 class="assistant-question">'+rt(question)+'</h3><div class="assistant-choices">'+choices+'</div><dl class="detail-grid">'+rows.filter(([,v])=>v).map(([label,value])=>'<div><dt>'+rt(label)+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl>';
 if(a?.kind==='single'&&!a.available&&d.start&&d.end){
  // These are suggestions from the last loaded calendar, rechecked on selection.
  const duration=Number(d.end.slice(0,2))*60+Number(d.end.slice(3))-Number(d.start.slice(0,2))*60-Number(d.start.slice(3));
  const suggestions=[];
  for(let m=Number(d.start.slice(0,2))*60+Number(d.start.slice(3))+30;m+duration<=1380&&suggestions.length<3;m+=30){
   const fmt=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'),start=fmt(m),end=fmt(m+duration);
   if(!conflict({room:d.room,date:d.date,start,end}))suggestions.push(assistantChip(start+'–'+end,'Change time to '+start+'–'+end+' (24-hour time)'));
  }
  if(suggestions.length)html+='<p>'+rt('Same room, later times')+'</p><div class="assistant-choices">'+suggestions.join('')+'</div>';
 }
 if(!next&&(a?.kind==='single'&&a.available||d.frequency!=='once'))html+='<button type="button" class="primary" onclick="reviewAssistantDraft()">'+rt('Review and submit')+'</button>';
 return html+'<div class="assistant-choices"><button type="button" class="secondary" onclick="useAssistantDraft()">'+rt('Complete details')+'</button><button type="button" class="secondary" onclick="openAssistant()">'+rt('New draft')+'</button></div>';
}
function assistantAnswer(message){
 const form=document.getElementById('assistant-form');if(!form||assistantBusy||assistantRecognition)return;
 form.elements.request.value=message;form.requestSubmit();
}
function reviewAssistantDraft(){
 if(assistantBusy||assistantRecognition||!assistantDraft||assistantNext(assistantDraft))return;
 useAssistantDraft();
 const form=document.getElementById('booking-form');
 // Existing flow revalidates permissions and conflicts, and requires explicit confirmation.
 if(form)form.requestSubmit();
}
async function prepareAssistant(event){
 event.preventDefault();const form=event.target,button=form.querySelector('[type="submit"]'),revision=sessionRevision;
 if(button.disabled||assistantRecognition||assistantBusy)return;assistantBusy=true;button.disabled=true;button.textContent=rt('Preparing…');document.getElementById('assistant-result').hidden=true;document.getElementById('assistant-error').textContent='';
 const message=form.elements.request.value;
 try{
  const {data:{session:current},error}=await db.auth.getSession();if(error||!current)throw Error('SIGN_IN');
  const requestMessage=assistantRequest(form.elements.request.value);if(requestMessage.length>2000)throw Error('TOO_LONG');
  const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+current.access_token},body:JSON.stringify({message:requestMessage}),signal:AbortSignal.timeout(45000)});
  const data=await response.json();if(!response.ok)throw Error(data.error||'AI_UNAVAILABLE');
  if(revision!==sessionRevision||document.getElementById('assistant-form')!==form||!document.getElementById('modal').open)return;
  assistantDraft=data.draft;
  const conversation=document.getElementById('assistant-conversation');
  conversation.insertAdjacentHTML('beforeend','<p class="assistant-user">'+esc(message)+'</p>');
  form.elements.request.value='';form.elements.request.placeholder=rt('Add details or ask to change the room, date or time.');document.getElementById('assistant-result').innerHTML=assistantSummary(data);
  conversation.insertAdjacentHTML('beforeend','<p class="assistant-reply">'+rt(assistantQuestion)+'</p>');
  document.getElementById('assistant-result').scrollIntoView({block:'nearest',behavior:'smooth'});
 }catch(error){if(revision===sessionRevision&&document.getElementById('assistant-form')===form)document.getElementById('assistant-error').textContent=rt(error.message==='SIGN_IN'?'Sign in to use the assistant.':error.message==='TOO_LONG'?'Text limit reached. Review or shorten your request.':error.message==='RATE_LIMIT'?'Please wait a minute before trying again.':'AI is unavailable. Use Book to continue.');}
 finally{if(document.getElementById('assistant-form')===form)document.getElementById('assistant-result').hidden=false;assistantBusy=false;button.disabled=false;button.textContent=rt('Send');}
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
// Start after voice handlers are registered below.
Object.assign(translations,{'Voice':'语音','Stop':'停止','Listening…':'正在聆听…','Starting microphone…':'正在开启麦克风…','Voice language':'语音语言','Review the text, then prepare your draft.':'请核对文字 再生成草稿','Use your keyboard microphone or type instead.':'请使用键盘麦克风或直接输入','Microphone access denied. You can still type.':'麦克风权限未开启 您仍可输入文字','No speech heard. Try again or type.':'未听到语音 请重试或输入文字','Voice unavailable. Use your keyboard microphone or type.':'语音暂不可用 请使用键盘麦克风或输入文字','Your browser handles voice recognition.':'语音由浏览器识别'});
let assistantRecognition=null,assistantVoiceTimer=null;
const micSVG='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg>';
function assistantVoiceHTML(){
 if(!(window.SpeechRecognition||window.webkitSpeechRecognition))return '<p class="section-note">'+rt('Use your keyboard microphone or type instead.')+'</p>';
 return '<div class="assistant-voice"><button id="assistant-mic" type="button" class="secondary" aria-pressed="false" onclick="toggleAssistantVoice()">'+micSVG+'<span>'+rt('Voice')+'</span></button><select id="assistant-voice-language" aria-label="'+rt('Voice language')+'"><option value="en-SG" '+(language==='en'?'selected':'')+'>English</option><option value="zh-CN" '+(language==='zh'?'selected':'')+'>普通话</option></select></div><p id="assistant-voice-status" class="section-note" role="status" aria-live="polite">'+rt('Speak slowly. Pauses are OK. Tap Stop when finished.')+'</p>';
}
function voiceControls(form,active){
 const button=document.getElementById('assistant-mic'),lang=document.getElementById('assistant-voice-language');
 if(button){button.innerHTML=micSVG+'<span>'+rt(active?'Stop':'Voice')+'</span>';button.setAttribute('aria-pressed',String(active));}
 if(lang)lang.disabled=active;
 if(form){form.elements.request.readOnly=active;form.querySelector('[type="submit"]').disabled=active;}
}
function stopAssistantVoice(){
 const rec=assistantRecognition;assistantRecognition=null;clearTimeout(assistantVoiceTimer);
 if(rec){rec.onresult=rec.onend=rec.onerror=rec.onstart=null;try{rec.abort();}catch{}voiceControls(document.getElementById('assistant-form'),false);}
}
Object.assign(translations,{'Speak slowly. Pauses are OK. Tap Stop when finished.':'请慢慢说 停顿也没关系 说完后点停止','Listening — take your time.':'正在聆听 请慢慢说','Tap Voice to add more, or prepare your draft.':'点语音可继续补充 或生成草稿','Text limit reached. Review or shorten your request.':'已达字数上限 请核对或精简需求','Voice paused. Tap Voice to continue.':'语音已暂停 请点语音继续'});
function toggleAssistantVoice(){
 if(assistantRecognition){const active=assistantRecognition;active.finishRequested=true;clearTimeout(assistantVoiceTimer);try{active.stop();if(assistantRecognition===active)assistantVoiceTimer=setTimeout(()=>active.finish(),2500);}catch{active.finish();}return;}
 const FormRecognition=window.SpeechRecognition||window.webkitSpeechRecognition,form=document.getElementById('assistant-form');
 if(!FormRecognition||!form||form.querySelector('[type="submit"]').disabled)return;
 const status=document.getElementById('assistant-voice-status'),rec=new FormRecognition();
 let base=form.elements.request.value.trim(),interim='',finalText='',rapidEnds=0,startedAt=Date.now();
 assistantRecognition=rec;rec.lang=document.getElementById('assistant-voice-language').value;rec.continuous=true;rec.interimResults=true;rec.maxAlternatives=1;rec.finishRequested=false;
 voiceControls(form,true);status.textContent=rt('Starting microphone…');
 const current=()=>assistantRecognition===rec&&document.getElementById('assistant-form')===form&&document.getElementById('modal').open;
 const commit=()=>{form.elements.request.value=[base,finalText.trim(),interim.trim()].filter(Boolean).join(' ').slice(0,1000);};
 rec.finish=()=>{if(!current())return;commit();stopAssistantVoice();status.textContent=rt('Tap Voice to add more, or prepare your draft.');};
 rec.onstart=()=>{if(current())status.textContent=rt('Listening — take your time.');};
 rec.onresult=event=>{
  if(!current())return;finalText='';interim='';
  for(let i=0;i<event.results.length;i++){const result=event.results[i];if(result.isFinal)finalText+=result[0].transcript+' ';else interim+=result[0].transcript;}
  form.elements.request.value=[base,finalText.trim()].filter(Boolean).join(' ').slice(0,1000);
  status.textContent=interim||rt('Listening — take your time.');
  if([base,finalText,interim].join(' ').length>=1000){commit();stopAssistantVoice();status.textContent=rt('Text limit reached. Review or shorten your request.');}
 };
 rec.onerror=event=>{
  if(!current())return;
  if(event.error==='no-speech'){status.textContent=rt('Listening — take your time.');return;}
  commit();stopAssistantVoice();status.textContent=rt(['not-allowed','service-not-allowed'].includes(event.error)?'Microphone access denied. You can still type.':'Voice unavailable. Use your keyboard microphone or type.');
 };
 rec.onend=()=>{
  if(!current())return;
  if(rec.finishRequested){rec.finish();return;}
  // Browsers can end recognition at a pause even with continuous mode enabled.
  commit();base=form.elements.request.value.trim();finalText='';interim='';
  rapidEnds=Date.now()-startedAt<1500?rapidEnds+1:0;
  if(rapidEnds>=3){stopAssistantVoice();status.textContent=rt('Voice paused. Tap Voice to continue.');return;}
  status.textContent=rt('Listening — take your time.');
  assistantVoiceTimer=setTimeout(()=>{if(!current())return;try{startedAt=Date.now();rec.start();}catch{stopAssistantVoice();status.textContent=rt('Voice paused. Tap Voice to continue.');}},350);
 };
 try{rec.start();}catch{stopAssistantVoice();status.textContent=rt('Voice unavailable. Use your keyboard microphone or type.');}
}
const showModalWithoutVoice=showModal;
showModal=function(html){stopAssistantVoice();return showModalWithoutVoice(html);};
const closeModalWithoutVoice=closeModal;
closeModal=function(){stopAssistantVoice();return closeModalWithoutVoice();};
const voiceDialog=document.getElementById('modal');
voiceDialog.addEventListener?.('close',stopAssistantVoice);
voiceDialog.addEventListener?.('cancel',stopAssistantVoice);
document.addEventListener?.('visibilitychange',()=>{if(document.hidden)stopAssistantVoice();});
if(!window.__TEST__)startLive();
