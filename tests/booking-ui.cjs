const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const html=fs.readFileSync(__dirname+'/../index.html','utf8'),elements=new Map();
const get=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',style:{},open:false,querySelectorAll(){return []},querySelector(){return get('part')},insertAdjacentHTML(_,s){this.innerHTML+=s},close(){this.open=false},showModal(){this.open=true}});return elements.get(id)};
class Fields{constructor(f){this.data=f.data}get(k){const v=this.data[k];return Array.isArray(v)?v[0]:v??null}getAll(k){const v=this.data[k];return Array.isArray(v)?v:v==null?[]:[v]}*[Symbol.iterator](){for(const[k,v]of Object.entries(this.data))for(const item of Array.isArray(v)?v:[v])yield[k,item]}}
const ctx=vm.createContext({window:{__TEST__:true},Intl,Date,Math,Number,String,JSON,Array,Set,WeakMap,Error,crypto,FormData:Fields,localStorage:{setItem(){},getItem(){return null}},NodeFilter:{SHOW_TEXT:4},document:{getElementById:get,querySelector(){return null},querySelectorAll(){return []},documentElement:{},createTreeWalker(){return{nextNode:()=>null}}},setTimeout(){},clearTimeout(){},setInterval(){},confirm:()=>true,location:{origin:'https://example.invalid'}}),run=s=>vm.runInContext(s,ctx);
run(html.match(/<script>([\s\S]*?)<\/script>/)[1]);run(fs.readFileSync(__dirname+'/../live.js','utf8'));run(fs.readFileSync(__dirname+'/../recurring.js','utf8'));

run(fs.readFileSync(__dirname+'/../booking-ui.js','utf8'));
const button=(room,index)=>{const classes=new Set(['time-slot','available']);return{dataset:{room:String(room),slot:String(index)},classList:{contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x)}},attrs:{},setAttribute(k,v){this.attrs[k]=v},label:{textContent:''},querySelector(){return this.label}}};
const buttons=[button(1,10),button(1,11),button(1,12),button(2,10)],summary={textContent:''},actions={innerHTML:''},grid={dataset:{gridKey:'fixed'},scrollTop:680,scrollLeft:192};
ctx.document.querySelectorAll=selector=>selector.startsWith('.time-slot')?buttons:selector==='.slot-summary'?[summary]:selector==='.slot-proceed-actions'?[actions]:selector==='.slot-scroll'?[grid]:[];
run("rooms=[{id:1,name:'圣堂',enabled:true},{id:2,name:'副堂',enabled:true}];bookings=[];selected=addDays(dayKey(),2);month=selected.slice(0,7);let renderCalls=0;const actualRender=render;render=()=>{renderCalls++}");
run('pickSlot(1,10);pickSlot(1,12)');
assert.equal(run('renderCalls'),0);assert.equal(grid.scrollTop,680);assert.equal(grid.scrollLeft,192);assert.equal(run('slotSelection.last'),12);assert(buttons.slice(0,3).every(b=>b.classList.contains('selected')));assert(summary.textContent.includes('圣堂'));assert(actions.innerHTML.includes('proceedSlots'));
run('pickSlot(2,10)');assert(!buttons[0].classList.contains('selected'));assert(buttons[3].classList.contains('selected'));
run('clearSlotSelection()');assert.equal(run('slotSelection'),null);assert.equal(run('renderCalls'),0);assert(actions.innerHTML.includes('disabled'));
run("roomFilter='1'");const single=run('slotGridHTML()');assert(single.includes('slot-table single-room'));assert(single.includes('<col style="width:84px">'));assert(single.includes('>圣堂</th>'));assert(!single.includes('>副堂</th>'));
run("roomFilter=''");const all=run('slotGridHTML()');assert(all.includes('col span="2"'));assert(all.includes('--slot-min-width:292px'));assert(all.includes('data-room="2" data-slot="33"'));
assert(run("fellowshipField('Custom group')").includes('value="__other__" selected'));assert(run("fellowshipField('')").includes('name="fellowship_choice" required'));
const label={hidden:true},form={querySelectorAll(){return []},elements:{fellowship_choice:{value:'__other__'},fellowship_other:{value:'  Custom group  ',closest(){return label}},group:{value:''},title:{value:'Prayer'}}};ctx.form=form;
run('syncFellowship(form)');assert.equal(form.elements.group.value,'Custom group');assert.equal(form.elements.fellowship_other.required,true);assert.equal(label.hidden,false);
form.elements.fellowship_choice.value='青团';run('syncFellowship(form)');assert.equal(form.elements.group.value,'青团');assert.equal(form.elements.fellowship_other.disabled,true);
form.elements.title.value='   ';let prevented=false;ctx.event={target:form,preventDefault(){prevented=true}};run("submitBooking(event,'',false)");assert(prevented);assert(get('form-error').textContent.includes('purpose'));
assert(html.includes("block?'Reason / title':'Purpose'"));assert(html.includes('src="/booking-ui.js"'));
console.log('PASS: slot range selection without grid replacement, scroll retention, room switching, clearing, filtered column sizing and required fellowship/purpose.');
run("role='member';mode='calendar';renderSchedule()");assert(!get('content').innerHTML.includes('mobile-booking'));assert(!get('content').innerHTML.includes('slot-scroll'));
run("mode='venues';renderSchedule()");assert(get('content').innerHTML.includes('slot-scroll'));assert(!get('content').innerHTML.includes('booking-view-toggle'));assert(!get('content').innerHTML.includes('>Classic<'));
run("liveReady=true;slotStart='14:00';slotEnd='16:00';session=null;openClassicBooking()");assert(get('modal').innerHTML.includes('classic-picker'));assert(get('modal').innerHTML.includes('changeClassicDate'));assert(get('modal').innerHTML.includes('bookSlot(1)'));
run('bookSlot(1)');assert(get('modal').innerHTML.includes('submitAuth'));assert(html.includes('onclick="openClassicBooking()"'));
console.log('PASS: calendar overview without redundant picker, direct Slots grid, Book popup and guest sign-in without a missing-form error.');

let marker=null;const control={required:true,disabled:false};const caption={querySelector(){return marker},appendChild(node){marker=node}};const reqLabel={querySelector(selector){return selector==='span'?caption:control}};ctx.requiredRoot={querySelectorAll(){return[reqLabel]}};
ctx.document.createElement=()=>({className:'',textContent:'',setAttribute(){},remove(){marker=null}});
run('markRequiredFields(requiredRoot)');assert.equal(marker.textContent,' *');const firstMarker=marker;run('markRequiredFields(requiredRoot)');assert.strictEqual(marker,firstMarker);
control.disabled=true;run('markRequiredFields(requiredRoot)');assert.equal(marker,null);control.disabled=false;control.required=false;run('markRequiredFields(requiredRoot)');assert.equal(marker,null);
console.log('PASS: required asterisks, no duplicate markers, and optional/disabled fields unmarked.');
