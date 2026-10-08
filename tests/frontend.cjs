const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const base=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const elements=new Map();
const get=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',style:{},open:false,querySelectorAll(){return []},close(){this.open=false},showModal(){this.open=true}});return elements.get(id)};
const ctx=vm.createContext({window:{__TEST__:true},Intl,Date,Math,Number,String,JSON,Array,Set,WeakMap,Error,FormData:class{constructor(form){return form.data}},localStorage:{setItem(){throw Error('demo writes forbidden')},getItem(){return null}},NodeFilter:{SHOW_TEXT:4},document:{getElementById:get,querySelector(){return null},querySelectorAll(){return []},documentElement:{},createTreeWalker(){return {nextNode:()=>null}}},setTimeout(){},clearTimeout(){},setInterval(){},confirm:()=>true,location:{origin:'https://example.invalid'}});
const run=s=>vm.runInContext(s,ctx);
run(base);run(fs.readFileSync(__dirname+'/../live.js','utf8'));
(async()=>{
 await run('startLive()');assert.equal(run('bookings.length'),0);assert.equal(run('role'),'member');assert.equal(run('slotTime(0)'),'06:00');assert.equal(run('slotTime(34)'),'23:00');
 run('openForm()');assert(get('modal').innerHTML.includes('submitAuth'));assert(!get('modal').innerHTML.includes('id="booking-form"'));
 run('slotSelection={room:1,first:0,last:1};proceedSlots()');assert(get('modal').innerHTML.includes('submitAuth'));
 run("changeRole('admin');resetDemo();advanceClock()");assert.equal(run('role'),'member');assert.equal(run('bookings.length'),0);assert.equal(run('offset'),0);
 run("language='zh'");assert.equal(run("translateText('Users')"),'用户');assert.equal(run("translateText('Sign in')"),'登录');run("language='en'");
 run("db={auth:{getSession:async()=>({data:{session:{user:{id:'member'}}}})},rpc:async()=>({data:{rooms:[{id:1,name:'Room 1',enabled:true}],bookings:[],admin:false,name:'Test User'}})}");
 await run('refreshLive()');assert.equal(run('liveReady'),true);assert.equal(run('me'),'Test User');assert(!get('account-controls').innerHTML.includes('manageUsers'));
 run("db.rpc=async()=>({data:{rooms:[{id:1,name:'Room 1',enabled:true}],bookings:[],admin:true,name:'Admin'}})");await run('refreshLive()');assert(get('account-controls').innerHTML.includes('manageUsers'));
 run("db.rpc=async()=>({error:{message:'This room is already held or booked during that time. Choose another time or venue.'}})");
 assert.equal(await run("mutate('save',{},'Saved')"),false);assert(get('form-error').textContent.includes('already held'));assert.equal(run('bookings.length'),0);
 run("db.rpc=async()=>({data:{rooms:[],bookings:[],admin:false,name:'Member'}})");await run('refreshLive()');assert.equal(run('role'),'member');
 assert(!html.includes('onchange="changeRole(this.value)"'));assert(!html.includes('Sample data only.</'));
 // A second refresh must wait for fresh data, not silently return during a request.
 run("let releaseState;let calls=0;db.rpc=async()=>{calls++;if(calls===1)return await new Promise(resolve=>releaseState=resolve);return {data:{rooms:[],bookings:[],admin:false,name:'Fresh'}}};let firstRefresh=refreshLive()");
 await Promise.resolve();await Promise.resolve();
 run('let queuedRefresh=refreshLive()');assert.equal(run('firstRefresh===queuedRefresh'),true);
 run("releaseState({data:{rooms:[],bookings:[],admin:false,name:'Old'}})");await run('queuedRefresh');
 assert.equal(run('calls'),2);assert.equal(run('me'),'Fresh');
 // A response from the signed-out account must never restore private data.
 run("calls=0;db.rpc=async()=>{calls++;if(calls===1)return await new Promise(resolve=>releaseState=resolve);return {data:{rooms:[],bookings:[],admin:false,name:''}}};let accountRefresh=refreshLive()");
 await Promise.resolve();await Promise.resolve();
 run("clearAccountState();db.auth.getSession=async()=>({data:{session:null}});releaseState({data:{rooms:[],bookings:[{id:'private'}],admin:true,name:'Old admin'}})");
 await run('accountRefresh');assert.equal(run('session'),null);assert.equal(run('role'),'member');assert.equal(run('bookings.length'),0);assert.equal(run('me'),'');
 console.log('PASS: queued refreshes await fresh state; sign-out discards in-flight private account data.');
 console.log('PASS: production startup, no sample data, sign-in gates, role refresh, failed writes, admin controls, 06:00–23:00, Chinese labels.');
})().catch(e=>{console.error(e);process.exitCode=1});
