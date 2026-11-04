const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const css = fs.readFileSync(process.argv[2], 'utf8');
  const out = process.argv[3];
  const b = await chromium.launch();

  let p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto('https://newmediaa.com/', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await p.waitForTimeout(2500); await p.evaluate(() => document.querySelectorAll('.mfp-wrap, .mfp-bg').forEach(e => e.remove())); await p.addStyleTag({ content: css });
  await p.click('.wd-header-mobile-nav a');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: out + '/menu-open.png' });
  console.log('mobile menu opened:', await p.evaluate(() => !!document.querySelector('.mobile-nav.wd-opened, .wd-side-hidden.wd-opened')));
  await p.close();

  p = await b.newPage({ viewport: { width: 1366, height: 800 } });
  await p.goto('https://newmediaa.com/', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await p.waitForTimeout(2500); await p.evaluate(() => document.querySelectorAll('.mfp-wrap, .mfp-bg').forEach(e => e.remove())); await p.addStyleTag({ content: css });
  await Promise.all([p.waitForNavigation({ timeout: 60000 }), p.click('.wd-nav-main a:has-text("المدونة")')]);
  console.log('desktop nav click ->', decodeURIComponent(p.url()));

  await p.goto('https://newmediaa.com/', { waitUntil: 'load' });
  await p.waitForTimeout(2500); await p.evaluate(() => document.querySelectorAll('.mfp-wrap, .mfp-bg').forEach(e => e.remove())); await p.addStyleTag({ content: css });
  await p.waitForTimeout(1000);
  const tabs = await p.$$('.elementor-widget-wd_tabs li');
  if (tabs.length > 2) {
    await tabs[2].click();
    await p.waitForTimeout(800);
    console.log('tab click class:', await tabs[2].evaluate(e => e.className));
  }
  await b.close();
})();
