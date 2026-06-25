import http from 'http';import {promises as fs} from 'fs';import {createReadStream} from 'fs';import path from 'path';import puppeteer from 'puppeteer';
const root='/sessions/funny-laughing-bell/mnt/advertise-agent';
const target='storage/Music-ad/beat-rush/index.html';
const srv=http.createServer(async(req,res)=>{let fp=path.join(root,decodeURIComponent(new URL(req.url,'http://x').pathname));const st=await fs.stat(fp).catch(()=>null);if(st?.isDirectory())fp=path.join(fp,'index.html');if(!(await fs.stat(fp).catch(()=>null))){res.writeHead(404).end();return;}res.writeHead(200).end(await fs.readFile(fp));});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));const port=srv.address().port;
const b=await puppeteer.launch({headless:true,executablePath:'/sessions/funny-laughing-bell/mnt/outputs/hs/chrome-linux/headless_shell',args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto(`http://127.0.0.1:${port}/${target}`,{waitUntil:'networkidle0'});
await p.click('#startBtn');
await new Promise(r=>setTimeout(r,2500)); // let notes start falling
// hammer the keys for a few seconds
for(let i=0;i<60;i++){for(const k of ['d','f','j','k']){await p.keyboard.press(k);}await new Promise(r=>setTimeout(r,80));}
await new Promise(r=>setTimeout(r,500));
const state=await p.evaluate(()=>({score:document.getElementById('scoreVal').textContent,energy:document.getElementById('energyFill').style.width,running:!document.getElementById('startScreen').classList.contains('hidden')?'start-visible':'playing'}));
console.log('STATE',JSON.stringify(state));
console.log('ERRORS',errs.length,JSON.stringify(errs.slice(0,8)));
await b.close();srv.close();
