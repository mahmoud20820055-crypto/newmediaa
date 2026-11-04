const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{ const css=fs.readFileSync(process.argv[2],'utf8'); const out=process.argv[3];
 const b=await chromium.launch();
 for (const [w,h,dev] of [[1366,800,'desk'],[390,844,'mob']]) for (const [n,u] of [['home','/'],['blog','/blogs/']]) for (const tag of ['now','new']) {
  const p=await b.newPage({viewport:{width:w,height:h}});
  await p.goto('https://newmediaa.com'+u,{waitUntil:'load',timeout:120000}); await p.waitForTimeout(3000);
  await p.evaluate(()=>{document.querySelectorAll('.wd-popup, .mfp-wrap, .mfp-bg').forEach(e=>e.remove())});
  if(tag==='new') { await p.addStyleTag({content:css}); await p.waitForTimeout(800); }
  await p.screenshot({path:`${out}/pv-${n}-${dev}-${tag}.png`, fullPage: dev==='desk'});
  await p.close(); }
 await b.close(); })();
