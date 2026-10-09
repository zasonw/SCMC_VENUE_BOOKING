const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const html=fs.readFileSync(__dirname+'/../index.html','utf8'),elements=new Map();
const get=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',style:{},open:false,querySelectorAll(){return []},querySelector(){return get('part')},insertAdjacentHTML(_,s){this.innerHTML+=s},close(){this.open=false},showModal(){this.open=true}});return elements.get(id)};
class Fields{constructor(f){this.data=f.data}get(k){const v=this.data[k];return Array.isArray(v)?v[0]:v??null}getAll(k){const v=this.data[k];return Array.isArray(v)?v:v==null?[]:[v]}*[Symbol.iterator](){for(const[k,v]of Object.entries(this.data))for(const item of Array.isArray(v)?v:[v])yield[k,item]}}
const ctx=vm.createContext({window:{__TEST__:true},Intl,Date,Math,Number,String,JSON,Array,Set,WeakMap,Error,crypto,FormData:Fields,localStorage:{setItem(){},getItem(){return null}},NodeFilter:{SHOW_TEXT:4},document:{getElementById:get,querySelector(){return null},querySelectorAll(){return []},documentElement:{},createTreeWalker(){return{nextNode:()=>null}}},setTimeout(){},clearTimeout(){},setInterval(){},confirm:()=>true,location:{origin:'https://example.invalid'}}),run=s=>vm.runInContext(s,ctx);
run(html.match(/<script>([\s\S]*?)<\/script>/)[1]);run(fs.readFileSync(__dirname+'/../live.js','utf8'));run(fs.readFileSync(__dirname+'/../recurring.js','utf8'));

run(fs.readFileSync(__dirname+'/../booking-ui.js','utf8'));run(fs.readFileSync(__dirname+'/../booking-flow.js','utf8'));run(fs.readFileSync(__dirname+'/../assistant-ui.js','utf8'));
run("session=null;openAssistant()");assert(get('modal').innerHTML.includes('Sign in to use'));
run("session={user:{id:'member'}};rooms=[{id:1,name:'Room 1',enabled:true}];openAssistant()");assert(get('modal').innerHTML.includes('assistant-form'));
assert(run("assistantSummary({draft:{room:1,purpose:'<script>',frequency:'once'},availability:{kind:'single',available:false},alternatives:[{id:1,name:'<Room>'}]})").includes('&lt;script&gt;'));
let opened=0;ctx.opened=()=>opened++;
run("openForm=()=>opened();repeatControls=()=>{};markRequiredFields=()=>{};assistantDraft={room:1,date:'2026-11-01',start:'20:00',end:'22:00',purpose:'Study',pic:'Test',fellowship:'Custom',frequency:'weekly',until:'2026-12-01',weekdays:[0],monthly:'date'}");
const fields={};for(const name of ['date','start','end','title','pic','room','fellowship_choice','fellowship_other','group','repeat_frequency','repeat_until','repeat_monthly'])fields[name]={value:'',closest:()=>({hidden:true})};
const picks=[{value:'0',checked:false},{value:'1',checked:true}];elements.set('booking-form',{elements:fields,querySelectorAll:selector=>selector==='[name="repeat_day"]'?picks:[]});
run('useAssistantDraft()');assert.equal(opened,1);assert.equal(fields.end.value,'22:00');assert.equal(fields.group.value,'Custom');assert.equal(fields.repeat_frequency.value,'weekly');assert.equal(picks[0].checked,true);assert.equal(picks[1].checked,false);
run("language='zh'");assert.equal(run("rt('Assistant')"),'预约助手');
console.log('PASS: assistant sign-in gate, safe summary output, booking draft handoff, custom fellowship and recurring fields.');
assert(run('assistantVoiceHTML()').includes('键盘麦克风'));
let recognizer;
ctx.window.SpeechRecognition=class{constructor(){recognizer=this}start(){this.started=true}stop(){this.stopped=true;this.onend?.()}abort(){this.aborted=true}};
const speechButton={disabled:false},speechInput={value:'Existing',readOnly:false};
const speechForm={elements:{request:speechInput},querySelector:()=>speechButton};
elements.set('assistant-form',speechForm);elements.set('assistant-mic',{innerHTML:'',setAttribute(k,v){this[k]=v}});elements.set('assistant-voice-language',{value:'zh-CN',disabled:false});get('modal').open=true;
run('toggleAssistantVoice()');assert(recognizer.started);assert.equal(recognizer.lang,'zh-CN');assert(speechInput.readOnly);assert(speechButton.disabled);
const result=[{transcript:'明天晚上八点'}];result.isFinal=true;recognizer.onresult({results:[result]});recognizer.onresult({results:[result]});assert.equal(speechInput.value,'Existing 明天晚上八点');
run('toggleAssistantVoice()');assert(recognizer.stopped);assert(!speechInput.readOnly);assert(!speechButton.disabled);assert.equal(run('assistantRecognition'),null);
run('toggleAssistantVoice()');recognizer.onerror({error:'not-allowed'});assert.equal(run('assistantRecognition'),null);assert(!speechInput.readOnly);assert(get('assistant-voice-status').textContent.includes('权限'));
run('toggleAssistantVoice()');const oldResult=recognizer.onresult;run('closeModal()');assert(recognizer.aborted);const savedText=speechInput.value;oldResult({results:[result]});assert.equal(speechInput.value,savedText);
assert(html.includes('id="assistant-launcher"'));assert(!fs.readFileSync(__dirname+'/../assistant-ui.js','utf8').includes("nav.insertAdjacentHTML"));
console.log('PASS: floating launcher, speech fallback, Mandarin selection, transcript appending without duplicates, stop/error cleanup, and no stale updates after close.');
// Simulate browsers ending recognition at a pause, then delivering a new result list.
let restart;
ctx.setTimeout=fn=>{restart=fn;return 1};ctx.clearTimeout=()=>{restart=null};get('modal').open=true;speechInput.value='';
run('toggleAssistantVoice()');assert.equal(recognizer.continuous,true);
const phrase=text=>{const r=[{transcript:text}];r.isFinal=true;return r};
recognizer.onresult({results:[phrase('Book tomorrow')]});recognizer.onend();assert(run('assistantRecognition'));assert(speechButton.disabled);restart();
recognizer.onresult({results:[phrase('at eight pm')]});assert.equal(speechInput.value,'Book tomorrow at eight pm');
recognizer.onerror({error:'no-speech'});assert(run('assistantRecognition'));recognizer.onend();restart();
recognizer.onresult({results:[phrase('in Room one')]});run('toggleAssistantVoice()');assert.equal(speechInput.value,'Book tomorrow at eight pm in Room one');assert(!speechButton.disabled);
run('toggleAssistantVoice()');recognizer.onresult({results:[phrase('for fellowship')]});run('toggleAssistantVoice()');assert.equal(speechInput.value,'Book tomorrow at eight pm in Room one for fellowship');
// Closing during a pending restart must never turn the microphone back on.
run('toggleAssistantVoice()');recognizer.onend();const pendingRestart=restart;run('closeModal()');pendingRestart();assert.equal(run('assistantRecognition'),null);
console.log('PASS: continuous listening, pause/restart accumulation, silence recovery, repeated dictation and cancelled restarts.');
