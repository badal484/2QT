const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
  
  await page.goto('http://localhost:3000/rider');
  
  console.log('Waiting 5 seconds...');
  await new Promise(r => setTimeout(r, 5000));
  
  const content = await page.content();
  if (content.includes('Loading Auth')) {
    console.log('FAIL: Still says Loading Auth');
  } else if (content.includes('Initializing Rider')) {
    console.log('FAIL: Still says Initializing Rider');
  } else {
    console.log('SUCCESS: Loading screen disappeared!');
  }
  
  await browser.close();
})();
