const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{ const css=fs.readFileSync(process.argv[2],'utf8');
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844}});
 await p.goto('https://newmediaa.com'+process.argv[3],{waitUntil:'load',timeout:120000}); await p.waitForTimeout(2500); await p.addStyleTag({content:css}); await p.waitForTimeout(1500);
 const r=await p.evaluate(()=>{ const out=[];
  for (const el of document.querySelectorAll('body *')) { const r=el.getBoundingClientRect(); if(r.width<100||r.height<100||r.top>900) continue;
   for (const pseudo of [null,'::before','::after']) { const cs=getComputedStyle(el,pseudo); const bg=cs.backgroundColor; const m=bg.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/); if(!m) continue; const a=m[4]===undefined?1:+m[4]; if(a<0.3) continue; if((+m[1]+ +m[2]+ +m[3])/3<150) continue;
    out.push(el.tagName+'.'+[...el.classList].slice(0,4).join('.')+(pseudo||'')+' '+bg+' op='+cs.opacity); } } return out;});
 console.log(r.join('\n')); await b.close(); })();
