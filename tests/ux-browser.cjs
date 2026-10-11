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
  route.fulfill({body:fs.readFileSync(file),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});
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
 fs.mkdirSync('/tmp/venue-ux-shots',{recursive:true});
 await page.screenshot({path:'/tmp/venue-ux-shots/mobile-calendar.png'});
 await page.evaluate(()=>setMode('venues'));await noPageOverflow();
 await page.screenshot({path:'/tmp/venue-ux-shots/mobile-slots.png'});
 const nav=await page.locator('.sidebar').boundingBox(),assistant=await page.locator('#assistant-launcher').boundingBox();
 assert(assistant.y+assistant.height<=nav.y,'assistant overlaps bottom navigation');
 await page.evaluate(()=>openForm(4));
 assert.equal(await page.locator('.ux-form-section').count(),3);
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
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: 390px/1440px layouts, no page/modal overflow, mobile navigation and assistant separation, collapsible edits, Chinese controls and no browser errors.');
})().catch(e=>{console.error(e);process.exitCode=1});
