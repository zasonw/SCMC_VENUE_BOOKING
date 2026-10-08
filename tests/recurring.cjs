const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const html=fs.readFileSync(__dirname+'/../index.html','utf8'),elements=new Map();
const get=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',style:{},open:false,querySelectorAll(){return []},querySelector(){return get('part')},insertAdjacentHTML(_,s){this.innerHTML+=s},close(){this.open=false},showModal(){this.open=true}});return elements.get(id)};
class Fields{constructor(f){this.data=f.data}get(k){const v=this.data[k];return Array.isArray(v)?v[0]:v??null}getAll(k){const v=this.data[k];return Array.isArray(v)?v:v==null?[]:[v]}*[Symbol.iterator](){for(const[k,v]of Object.entries(this.data))for(const item of Array.isArray(v)?v:[v])yield[k,item]}}
const ctx=vm.createContext({window:{__TEST__:true},Intl,Date,Math,Number,String,JSON,Array,Set,WeakMap,Error,crypto,FormData:Fields,localStorage:{setItem(){},getItem(){return null}},NodeFilter:{SHOW_TEXT:4},document:{getElementById:get,querySelector(){return null},querySelectorAll(){return []},documentElement:{},createTreeWalker(){return{nextNode:()=>null}}},setTimeout(){},clearTimeout(){},setInterval(){},confirm:()=>true,location:{origin:'https://example.invalid'}}),run=s=>vm.runInContext(s,ctx);
run(html.match(/<script>([\s\S]*?)<\/script>/)[1]);run(fs.readFileSync(__dirname+'/../live.js','utf8'));run(fs.readFileSync(__dirname+'/../recurring.js','utf8'));
(async()=>{
 assert.equal(run("sixMonthLimit('2026-08-31')"),'2027-02-28');assert.equal(run("sixMonthLimit('2027-08-31')"),'2028-02-29');assert.equal(run("sixMonthLimit('2026-10-07')"),'2027-04-07');
 assert(run("repeatFields('2026-10-11')").includes('name="repeat_day" value="0" checked'));
 assert(run("renderRepeatPreview([{date:'2026-10-11',available:false,reason:'Clash'}])").includes('disabled'));
 run("language='zh'");assert(run("renderRepeatPreview([{date:'2026-10-11',available:false,reason:'Clash'}])").includes('时段冲突'));assert.equal(run("rt('People')"),'人员');run("language='en'");
 run("peopleCache=[{id:'1',name:'<script>',fellowships:['Youth','Choir'],email:null}]");assert(run("peopleRows('choir')").includes('&lt;script&gt;'));assert(run("peopleRows('absent')").includes('No people'));
 const button={disabled:false,textContent:''};const form={data:{title:'Event',group:'Youth',pic:'Test',room:'9',date:'2026-10-11',start:'08:00',end:'09:00',repeat_frequency:'weekly',repeat_until:'2026-10-25',repeat_day:['0'],repeat_monthly:'date'},elements:{repeat_frequency:{value:'weekly'}},querySelector(){return button},querySelectorAll(){return [{value:'2026-10-11'},{value:'2026-10-25'}]}};
 get('modal').open=true;elements.set('booking-form',form);ctx.event={target:form,preventDefault(){}};
 run("session={user:{id:'member'}};let requests=[];db={rpc:async(name,p)=>{requests.push({name,...p});if(name==='venue_api')return{data:{admin:false,name:'Test',rooms:[],bookings:[]}};if(p.action==='preview')return{data:[{date:'2026-10-11',available:true},{date:'2026-10-18',available:false,reason:'Clash'},{date:'2026-10-25',available:true}]};return{data:{count:2}}},auth:{getSession:async()=>({data:{session}})}}");
 await run("submitBooking(event,'',false)");assert.equal(run('requests[0].action'),'preview');assert(get('repeat-preview').innerHTML.includes('Clash'));assert.equal(button.textContent,'Submit dates (2)');
 form.data.title='Changed';await run("submitBooking(event,'',false)");assert.equal(run('requests[1].action'),'preview');
 const key=run('repeatRequestKey');await run("submitBooking(event,'',false)");assert.equal(run('requests[2].action'),'create');assert.deepEqual(JSON.parse(run('JSON.stringify(requests[2].payload.dates)')),['2026-10-11','2026-10-25']);assert.equal(run('requests[2].payload.request_key'),key);
 assert.equal(run('selected'),'2026-10-11');assert.equal(run('repeatBusy'),false);
 // Switching to Once during an outstanding recurring request must not start another save.
 run('repeatBusy=true');form.elements.repeat_frequency.value='once';const requestCount=run('requests.length');
 await run("submitBooking(event,'',false)");assert.equal(run('requests.length'),requestCount);run('repeatBusy=false');form.elements.repeat_frequency.value='weekly';
 // A definite clash invalidates the preview so the next click obtains fresh availability.
 get('modal').open=true;
 run("db.rpc=async()=>({error:{message:'This room is already held or booked during that time. Choose another time or venue.'}})");
 await run("submitBooking(event,'',false)");assert.equal(run('repeatPreview'),null);assert.equal(button.textContent,'Preview dates');
 // Network errors must retain the key: the server may already have created the series.
 run("repeatPreview={signature:JSON.stringify(repeatPayload(event.target)),rows:[]};repeatRequestKey='retry-key';db.rpc=async()=>({error:{message:'Failed to fetch'}})");
 await run("submitBooking(event,'',false)");assert.equal(run('repeatRequestKey'),'retry-key');
 // A late error from an old form must not overwrite the new form's error message.
 run("let rejectOld;db.rpc=()=>new Promise(resolve=>rejectOld=resolve);let oldSubmit=submitBooking(event,'',false)");
 const replacement={...form};elements.set('booking-form',replacement);get('form-error').textContent='New form';
 run("rejectOld({error:{message:'Old request failed'}})");await run('oldSubmit');assert.equal(get('form-error').textContent,'New form');
 // A preview finishing after Close must not populate a dismissed modal.
 elements.set('booking-form',form);run("repeatPreview=null;repeatRequestKey=null;let oldPreview=submitBooking(event,'',false)");
 get('modal').open=false;run("rejectOld({data:[{date:'2026-10-11',available:true}]})");await run('oldPreview');assert.equal(run('repeatPreview'),null);
 // Admin directory reads must not reopen a private panel after sign-out.
 run("role='admin';let resolveDirectory;db.rpc=()=>new Promise(resolve=>resolveDirectory=resolve);api=async()=>[];let directoryLoad=managePeople();clearAccountState();resolveDirectory({data:[{id:'private',name:'Private',fellowships:[]}]})");
 await run('directoryLoad');assert.equal(get('modal').open,false);assert(!run("peopleCache.some(p=>p.id==='private')"));
 console.log('PASS: submission lock across repeat modes, clash re-preview, safe network retry, stale form responses, and signed-out directory access.');
 console.log('PASS: monthly boundary clamp, weekday default, clash selection, Chinese labels, directory escaping/filter, preview invalidation, selected dates and retry key.');
})().catch(e=>{console.error(e);process.exitCode=1});
