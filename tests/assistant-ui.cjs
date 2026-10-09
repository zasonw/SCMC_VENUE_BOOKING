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
