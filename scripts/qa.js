const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{ const css=fs.readFileSync(process.argv[2],'utf8'); const out=process.argv[3];
 const pages=['/','/blogs/','/featured-works/','/%D8%AA%D9%88%D8%A7%D8%B5%D9%84-%D9%85%D8%B9%D9%86%D8%A7/','/?p=10835','/?post_type=portfolio&p=10539'];
 const b=await chromium.launch(); let i=0;
 for (const [w,h,dev] of [[1366,800,'desk'],[390,844,'mob']]) for (const u of pages) {
  const p=await b.newPage({viewport:{width:w,height:h}}); const errs=[];
  p.on('pageerror',e=>errs.push(e.message.slice(0,80)));
  await p.goto('https://newmediaa.com'+u,{waitUntil:'load',timeout:120000}); await p.waitForTimeout(2000);
  await p.evaluate(()=>{document.querySelectorAll('.wd-popup, .mfp-wrap, .mfp-bg').forEach(e=>e.remove())});
  await p.addStyleTag({content:css}); await p.waitForTimeout(1500);
  const res=await p.evaluate(()=>{
   const lum=c=>{const m=c.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/); if(!m) return null; return {l:(0.2126*m[1]+0.7152*m[2]+0.0722*m[3]),a:m[4]===undefined?1:+m[4]};};
   const bgOf=el=>{ while(el){ const c=lum(getComputedStyle(el).backgroundColor); if(c&&c.a>0.5) return c.l; el=el.parentElement;} return 5; };
   const bad=[]; const light=[];
   for (const el of document.querySelectorAll('body *')) {
     const cs=getComputedStyle(el); if(cs.visibility==='hidden'||cs.display==='none') continue; const r=el.getBoundingClientRect(); if(!r.width||!r.height) continue;
     const own=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>1); 
     if(own && cs.webkitTextFillColor!=='rgba(0, 0, 0, 0)' && cs.color!=='rgba(0, 0, 0, 0)'){ const t=lum(cs.color); const bg=bgOf(el); if(t && Math.abs(t.l-bg)<70) bad.push(el.tagName+'.'+[...el.classList].slice(0,2).join('.')+' "'+el.textContent.trim().slice(0,30)+'" fg='+Math.round(t.l)+' bg='+Math.round(bg)); }
     if(r.width>120&&r.height>40){ const c=lum(cs.backgroundColor); if(c&&c.a>0.6&&c.l>170 && !/mobile-nav|wd-side-hidden|cart|search/.test(el.className)) light.push(el.tagName+'.'+[...el.classList].slice(0,3).join('.')); }
   }
   return {overflow: document.documentElement.scrollWidth - innerWidth, bad:[...new Set(bad)].slice(0,8), light:[...new Set(light)].slice(0,6)};
  });
  await p.screenshot({path:`${out}/${dev}-${i}.png`,fullPage:false});
  console.log(`[${dev}] ${decodeURIComponent(u)} overflow=${res.overflow} lowContrast=${res.bad.length} light=${res.light.length} jsErr=${errs.length}`);
  res.bad.forEach(x=>console.log('   low:',x)); res.light.forEach(x=>console.log('   light:',x));
  await p.close(); i++; }
 await b.close(); })();
