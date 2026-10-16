// Optional browser verification: Playwright + installed Chromium, or BROWSER_EXECUTABLE.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__TEST__=true});
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());if(url.hostname!=='ui.test')return route.abort();
  const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
  const file=path.join(__dirname,'..',name);
  if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
  route.fulfill({body:fs.readFileSync(file),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.png')?'image/png':'text/html'});
 });
 await page.goto('https://ui.test');
 await page.evaluate(()=>{
  session={user:{id:'fixture'}};liveReady=true;me='Jason';role='member';selected=addDays(dayKey(),3);month=selected.slice(0,7);
  bookingProfile={name:'Jason',fellowship:'乐龄团契',contact:''};
  rooms=['圣堂','副堂','新会议室','旧会议室','Cafe','厨房','亲子室','喜乐1','喜乐2'].map((name,i)=>({id:i+1,name,enabled:true}));
  bookings=[{id:'00000000-0000-0000-0000-000000000001',series_id:'series',owner:'member',room:3,date:selected,start:'09:00',end:'11:00',title:'Bible study',group:'乐龄团契',pic:'Jason',contact:'',notes:'',status:'confirmed',history:[],created:Date.now(),booked_by:'Jason'}];
  render();
 });
 const noPageOverflow=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow');
 await noPageOverflow();
 assert(!await page.locator('.filters select').last().isVisible());
 await page.locator('.phone-filter-toggle').click();assert(await page.locator('.filters select').last().isVisible());
 await page.locator('.phone-filter-toggle').click();assert(!await page.locator('.filters select').last().isVisible());
 for(const width of [320,430]){await page.setViewportSize({width,height:844});await noPageOverflow();}
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>openAccountMenu());assert(await page.locator('#modal button').filter({hasText:'Refresh'}).isVisible());await page.evaluate(()=>closeModal());
 fs.mkdirSync('/tmp/venue-ux-shots',{recursive:true});
 await page.screenshot({path:'/tmp/venue-ux-shots/mobile-calendar.png'});
 await page.evaluate(()=>setMode('venues'));await noPageOverflow();
 await page.screenshot({path:'/tmp/venue-ux-shots/mobile-slots.png'});
 const nav=await page.locator('.sidebar').boundingBox(),assistant=await page.locator('#assistant-launcher').boundingBox();
 assert(assistant.y+assistant.height<=nav.y,'assistant overlaps bottom navigation');
 await page.evaluate(()=>openForm(4));
 assert.equal(await page.locator('.ux-form-section').count(),3);
 assert.equal(await page.locator('#modal').getAttribute('aria-labelledby'),'ux-dialog-title');
 assert(await page.locator('#ux-dialog-title').evaluate(e=>document.activeElement===e),'dialog title receives focus');
 assert.equal(await page.locator('.slot-scroll').getAttribute('tabindex'),'0');
 assert.equal(await page.locator('.ux-skip-link').count(),1);

 assert(await page.evaluate(()=>{const m=document.getElementById('modal');return m.scrollWidth<=m.clientWidth+1}),'modal overflow');
 await page.screenshot({path:'/tmp/venue-ux-shots/mobile-booking.png'});
 await page.evaluate(()=>{closeModal();openOccurrenceEditor(bookings[0].id,'future')});
 assert(!await page.locator('[name=value_pic]').isVisible());
 await page.locator('[name=change_pic]').check();assert(await page.locator('[name=value_pic]').isVisible());
 await page.screenshot({path:'/tmp/venue-ux-shots/mobile-recurring.png'});
 await page.evaluate(()=>{closeModal();setLanguage('zh');mode='calendar';render()});
 await noPageOverflow();await page.screenshot({path:'/tmp/venue-ux-shots/mobile-chinese.png'});
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>{role='admin';render()});await noPageOverflow();
 await page.screenshot({path:'/tmp/venue-ux-shots/desktop.png'});
 // Fixed Malaysia afternoon: skip elapsed slots and an occupied next slot.
 await page.evaluate(()=>{
  closeModal();setLanguage('en');session=null;role='member';
  offset=stamp('2026-10-11','18:23')-Date.now();selected='2026-10-11';month='2026-10';
  roomFilter='1';mode='calendar';render();
  bookings=[{id:'held',room:1,date:selected,start:'18:30',end:'19:00',status:'confirmed'}];
  setMode('venues');
 });
 assert(await page.locator('.time-slot[data-slot="24"]').isDisabled());
 assert(await page.evaluate(()=>document.querySelector('.slot-scroll').scrollTop>0));
 const slot=await page.locator('.time-slot[data-slot="26"]').boundingBox();
 const head=await page.locator('.slot-table thead th').first().boundingBox();
 assert(slot.y>=head.y+head.height-1 && slot.y<head.y+head.height+150,'next free slot should be visible below header');
 const initialScroll=await page.locator('.slot-scroll').evaluate(e=>e.scrollTop);
 await page.evaluate(()=>{pickSlot(1,26);pickSlot(1,27);render()});
 assert.equal(await page.locator('.slot-scroll').evaluate(e=>e.scrollTop),initialScroll,'selection/refresh must preserve scroll');
 await page.evaluate(()=>selectDay('2026-10-10'));
 assert(await page.locator('.slot-availability-message').isVisible(),'fully unavailable date explains empty availability');
 await page.evaluate(()=>{mode='calendar';render()});
 const refresh=await page.locator('.ux-header-actions .secondary').boundingBox();
 const book=await page.locator('.ux-header-actions .primary').boundingBox();
 assert(Math.abs(refresh.y-book.y)<4,'header actions aligned');
 assert.equal(await page.locator('link[rel="icon"]').getAttribute('href'),'/favicon.ico?v=3');
 await page.screenshot({path:'/tmp/venue-ux-shots/desktop-header.png'});
 await page.evaluate(()=>{session={user:{id:'fixture'}};role='admin';render();openMonthPicker()});
 await page.locator('[name=year]').fill('2028');await page.locator('[name=month]').selectOption('02');
 await page.locator('#modal button[type=submit]').click();
 assert.equal(await page.evaluate(()=>month),'2028-02');
 await page.setViewportSize({width:820,height:1180});assert(await page.locator('.ux-month-picker').isVisible());
 await page.setViewportSize({width:390,height:844});assert(!await page.locator('.ux-month-picker').isVisible());
 await page.evaluate(()=>openMonthPicker());assert(!await page.locator('#modal').isVisible());
 await page.evaluate(()=>{
  closeModal();session={user:{id:'fixture'}};role='member';roomFilter='';statusFilter='';mode='calendar';
  bookings=Array.from({length:6},(_,i)=>({id:'busy-'+i,room:1,date:selected,start:'09:00',end:'10:00',status:'confirmed',title:'Activity '+i,group:'Test',pic:'Jason',history:[]}));render();
 });
 assert.equal(await page.locator('.day.selected .event-chip:visible').count(),3);
 await page.locator('.day.selected .calendar-more').click();assert.equal(await page.locator('#modal .agenda-item').count(),6);
 assert(await page.locator('#modal .modal-head button').isVisible());await page.evaluate(()=>closeModal());
 await page.locator('.selected-day-actions .primary').click();assert(await page.locator('.slot-scroll').isVisible());
 for(const width of [1024,1280,1440]){await page.setViewportSize({width,height:900});await page.evaluate(()=>{mode='calendar';render()});await noPageOverflow();}
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: 390px/1440px layouts, no page/modal overflow, mobile navigation and assistant separation, collapsible edits, Chinese controls and no browser errors.');
})().catch(e=>{console.error(e);process.exitCode=1});
