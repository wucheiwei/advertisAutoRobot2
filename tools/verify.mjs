#!/usr/bin/env node
/**
 * 驗證一個 landing page:
 *   node tools/verify.mjs storage/<分類>/<專案>/index.html
 *
 * 1. 起一個臨時靜態 server(服務整個專案根目錄,CDN 之外的相對路徑也能載)
 * 2. 用 puppeteer 開頁面,收集 console error / pageerror / 404
 * 3. 截一張 10:16 的封面到該專案資料夾的 _preview.jpg(供人工確認,非正式封面)
 * 4. 輸出 JSON 結果;有錯誤時 exit code = 1(讓 agent 知道要修)
 */
import http from 'http';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const target = process.argv[2];
if (!target) {
  console.error('用法: node tools/verify.mjs storage/<分類>/<專案>/index.html');
  process.exit(2);
}

const root = process.cwd();
const abs = path.resolve(root, target);
const rel = path.relative(root, abs);
if (rel.startsWith('..')) {
  console.error('目標必須在專案目錄內');
  process.exit(2);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
};

// 臨時靜態 server(隨機 port)
const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let fp = path.join(root, urlPath);
    const st = await fs.stat(fp).catch(() => null);
    if (st?.isDirectory()) fp = path.join(fp, 'index.html');
    if (!(await fs.stat(fp).catch(() => null))) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] ?? 'application/octet-stream' });
    createReadStream(fp).pipe(res);
  } catch {
    res.writeHead(500).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const url = `http://127.0.0.1:${port}/${rel.split(path.sep).join('/')}`;

const errors = [];
const failedRequests = [];

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 1280, deviceScaleFactor: 1.5 });
  const isNoise = (u) => /favicon\.ico$/.test(u);
  page.on('console', (m) => {
    if (m.type() === 'error' && !isNoise(m.location()?.url ?? '') && !/favicon/.test(m.text()))
      errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => {
    if (!isNoise(r.url())) failedRequests.push(`${r.failure()?.errorText} ${r.url()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !isNoise(r.url())) failedRequests.push(`HTTP ${r.status()} ${r.url()}`);
  });

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });
  // 等動畫/延遲初始化跑一下
  await new Promise((r) => setTimeout(r, 1500));

  // 基本互動煙霧測試:點一下頁面中央,看會不會炸出錯誤
  await page.mouse.click(400, 640).catch(() => {});
  await new Promise((r) => setTimeout(r, 800));

  const previewPath = path.join(path.dirname(abs), '_preview.jpg');
  await page.screenshot({ path: previewPath, type: 'jpeg', quality: 80 });

  const title = await page.title();
  const bodyText = await page.evaluate(() => document.body?.innerText?.trim().length ?? 0);

  const result = {
    ok: errors.length === 0 && failedRequests.length === 0,
    url: target,
    title,
    bodyTextLength: bodyText,
    consoleErrors: errors.slice(0, 20),
    failedRequests: failedRequests.slice(0, 20),
    preview: path.relative(root, previewPath),
    hints: [
      ...(title ? [] : ['<title> 是空的:輪播會用它當標題,請補上']),
      ...(bodyText < 20 ? ['頁面文字內容過少,可能沒渲染成功'] : []),
    ],
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
} finally {
  await browser.close();
  server.close();
}
