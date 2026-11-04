const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{ const css=fs.readFileSync(process.argv[2],'utf8');
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1366,height:800}});
 await p.goto('https://newmediaa.com'+(process.argv[3]||'/'),{waitUntil:'load',timeout:120000}); await p.waitForTimeout(2500); await p.addStyleTag({content:css});
 const r=await p.evaluate(()=>{
  const out=[]; const seen=new Set();
  for (const el of document.querySelectorAll('body *')) {
    const cs=getComputedStyle(el); const bg=cs.backgroundColor; const r=el.getBoundingClientRect();
    if(r.width<60||r.height<25) continue;
    const m=bg.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/); if(!m) continue;
    const a=m[4]===undefined?1:+m[4]; if(a<0.5) continue;
    const lum=(+m[1]+ +m[2]+ +m[3])/3; if(lum<180) continue;
    const key=el.tagName+'.'+[...el.classList].slice(0,4).join('.'); if(seen.has(key)) continue; seen.add(key);
    out.push(`${key} bg=${bg} img=${cs.backgroundImage.slice(0,40)} y=${Math.round(r.top+scrollY)}`);
  } return out; });
 console.log(r.join('\n')); await b.close(); })();
