import puppeteer from 'puppeteer';
try{
const b = await puppeteer.launch({headless:true,executablePath:process.env.PUPPETEER_EXECUTABLE_PATH,args:['--no-sandbox','--single-process','--no-zygote']});
const pg = await b.newPage(); await pg.goto('data:text/html,<h1>hi</h1>'); console.log('TITLE', await pg.title(), 'LAUNCH_OK'); await b.close();
}catch(e){console.error('LAUNCHERR', e.message);}
