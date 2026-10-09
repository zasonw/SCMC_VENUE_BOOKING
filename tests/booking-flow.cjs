const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const html=fs.readFileSync(__dirname+'/../index.html','utf8'),elements=new Map();
const get=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',style:{},open:false,querySelectorAll(){return []},querySelector(){return get('part')},insertAdjacentHTML(_,s){this.innerHTML+=s},close(){this.open=false},showModal(){this.open=true}});return elements.get(id)};
class Fields{constructor(f){this.data=f.data}get(k){const v=this.data[k];return Array.isArray(v)?v[0]:v??null}getAll(k){const v=this.data[k];return Array.isArray(v)?v:v==null?[]:[v]}*[Symbol.iterator](){for(const[k,v]of Object.entries(this.data))for(const item of Array.isArray(v)?v:[v])yield[k,item]}}
const ctx=vm.createContext({window:{__TEST__:true},Intl,Date,Math,Number,String,JSON,Array,Set,WeakMap,Error,crypto,FormData:Fields,localStorage:{setItem(){},getItem(){return null}},NodeFilter:{SHOW_TEXT:4},document:{getElementById:get,querySelector(){return null},querySelectorAll(){return []},documentElement:{},createTreeWalker(){return{nextNode:()=>null}}},setTimeout(){},clearTimeout(){},setInterval(){},confirm:()=>true,location:{origin:'https://example.invalid'}}),run=s=>vm.runInContext(s,ctx);
run(html.match(/<script>([\s\S]*?)<\/script>/)[1]);run(fs.readFileSync(__dirname+'/../live.js','utf8'));run(fs.readFileSync(__dirname+'/../recurring.js','utf8'));

run(fs.readFileSync(__dirname+'/../booking-ui.js','utf8'));
const storage=new Map();ctx.sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
run(fs.readFileSync(__dirname+'/../booking-flow.js','utf8'));
run("rooms=[{id:1,name:'Room 1',enabled:true}];selected=addDays(dayKey(),2);bookings=[];slotStart='09:00';slotEnd='10:00';session=null;liveReady=true;bookSlot(1)");
assert(storage.has('booking-intent'));assert(get('modal').innerHTML.includes('submitAuth'));
run("let openedRoom=null;openForm=(room,id,start)=>{openedRoom=room};session={user:{id:'member'}}");get('modal').open=false;
const resumed={elements:{end:{value:''}}};elements.set('booking-form',resumed);run('resumeBooking()');assert.equal(run('openedRoom'),1);assert.equal(resumed.elements.end.value,'10:00');assert(!storage.has('booking-intent'));
run("openedRoom=null;rememberBooking(1,selected,'09:00','10:00');rooms[0].enabled=false;resumeBooking()");assert.equal(run('openedRoom'),null);assert(!storage.has('booking-intent'));run('rooms[0].enabled=true');
assert.equal(run("myBookingGroup({status:'cancelled',date:selected,end:'10:00'})"),'closed');assert.equal(run("myBookingGroup({status:'pending',date:selected,end:'10:00'})"),'pending');assert.equal(run("myBookingGroup({status:'confirmed',date:addDays(dayKey(),-1),end:'10:00'})"),'past');assert.equal(run("myBookingGroup({status:'confirmed',date:selected,end:'10:00'})"),'upcoming');
const body={hidden:false},footer={hidden:false};let review=null;
const form={data:{title:'<Prayer>',group:'Youth',room:'1',date:'2026-10-15',start:'09:00',end:'10:00',pic:'Test',repeat_frequency:'once'},elements:{group:{value:'Youth'},title:{value:'<Prayer>'}},dataset:{},reportValidity:()=>true,querySelector:s=>s==='.modal-body'?body:s==='.modal-footer'?footer:review,insertAdjacentHTML(_,html){this.summary=html;review={scrollIntoView(){},remove(){review=null}}},requestSubmit(){run("submitBooking(event,'',false)")}};
ctx.event={target:form,preventDefault(){}};elements.set('booking-form',form);
run("let saves=0;mutate=async()=>{saves++;return false};submitBooking(event,'',false)");assert.equal(run('saves'),0);assert(body.hidden);assert(form.summary.includes('&lt;Prayer&gt;'));run('backFromReview()');assert(!body.hidden);assert(!review);
run("submitBooking(event,'',false);confirmReviewedBooking()");assert.equal(run('saves'),1);assert(!body.hidden);assert(!form.dataset.reviewConfirmed);
form.data.repeat_frequency='weekly';form.data.occurrence=['2026-10-15','2026-10-22'];assert(run('reviewRows(event.target)').includes('2026-10-15 · 2026-10-22'));
run("language='zh'");assert.equal(run("rt('Review booking')"),'核对预约');assert.equal(run("rt('Upcoming')"),'即将开始');
assert(html.includes('src="/booking-flow.js"'));
console.log('PASS: guest booking intent, resume with availability check, booking groups, review/back/confirm, escaping, recurring date summary and Chinese labels.');
