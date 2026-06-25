#!/usr/bin/env node
/**
 * Landing Page 自動產線 — 讓 Claude 自己找資料、自己寫 code、自己驗證。
 *
 * 用法:
 *   node tools/factory.mjs                       # 產 1 個,主題/分類由 Claude 自己決定
 *   node tools/factory.mjs 3                     # 連續產 3 個(每個獨立 session)
 *   node tools/factory.mjs --category Game-ad    # 指定(或新開)分類
 *   node tools/factory.mjs --idea "黑膠唱片占卜抽籤"  # 指定主題
 *
 * 環境:
 *   - 需要已登入 Claude Code(或設 ANTHROPIC_API_KEY)
 *   - FACTORY_MODEL 可覆寫模型(預設 claude-opus-4-8)
 *
 * 產出:storage/<分類>-ad/<slug>/index.html
 *   → 後端會自動掃描新分類、重啟後自動截封面進輪播。
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const STORAGE = path.join(ROOT, 'storage');
const PROMPT_FILE = path.join(ROOT, 'tools', 'factory-prompt.md'); // ★ 指令單一來源(Cowork 也讀這個)
const MODEL = process.env.FACTORY_MODEL || 'claude-opus-4-8';

// 只吃「已登入的 Claude Code」:清掉這兩個會插隊的憑證(僅影響本程式,不動終端機),
// SDK 找不到 key 就會落到 OAuth 登入。沒設也照刪,delete 不存在的值不會出錯。
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

// ---------- 參數 ----------
const args = process.argv.slice(2);
let count = 1;
let forcedCategory = null;
let seedIdea = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--category') forcedCategory = args[++i];
  else if (args[i] === '--idea') seedIdea = args[++i];
  else if (/^\d+$/.test(args[i])) count = Math.min(10, parseInt(args[i], 10));
}

// ---------- 現有分類與專案(讓 Claude 知道既有生態、避免重複) ----------
async function snapshotStorage() {
  const cats = [];
  const dirs = (await fs.readdir(STORAGE, { withFileTypes: true }).catch(() => []))
    .filter((e) => e.isDirectory() && e.name !== 'covers' && !e.name.startsWith('.'));
  for (const d of dirs) {
    const projects = (await fs.readdir(path.join(STORAGE, d.name), { withFileTypes: true }).catch(() => []))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    cats.push(`${d.name}: ${projects.join(', ') || '(空)'}`);
  }
  return cats.join('\n');
}

// ---------- 工具權限白名單(防呆:只准寫 storage/**,Bash 只准跑驗證) ----------
function canUseTool(toolName, input) {
  const allowPath = (p) => {
    if (!p) return false;
    const rel = path.relative(ROOT, path.resolve(ROOT, p));
    return rel.startsWith('storage' + path.sep) && !rel.includes('..');
  };
  if (['Write', 'Edit', 'MultiEdit'].includes(toolName)) {
    const p = input.file_path ?? input.path;
    if (allowPath(p)) return { behavior: 'allow', updatedInput: input };
    return { behavior: 'deny', message: `只允許寫入 storage/ 底下 (拒絕: ${p})` };
  }
  if (toolName === 'Bash') {
    const cmd = String(input.command ?? '').trim();
    // 允許 verify,可選擇前綴 `export PATH=...&&`(共用指令檔會用它確保 Node 24)
    if (/^(export PATH=[^;|&]*&& *)?node tools\/verify\.mjs storage\/[^;|&]*$/.test(cmd)) {
      return { behavior: 'allow', updatedInput: input };
    }
    if (/^(ls|mkdir -p storage\/)[^;|&]*$/.test(cmd)) {
      return { behavior: 'allow', updatedInput: input };
    }
    return { behavior: 'deny', message: 'Bash 只允許: node tools/verify.mjs <path> / ls / mkdir -p storage/...' };
  }
  // 其餘(WebSearch / WebFetch / Read / Glob / Grep / TodoWrite ...)放行
  return { behavior: 'allow', updatedInput: input };
}

// ---------- 產一個 landing page ----------
async function generateOne(n) {
  // 指令單一來源:讀 tools/factory-prompt.md(Cowork 也讀同一份)
  let prompt = await fs.readFile(PROMPT_FILE, 'utf-8');

  // 附加 factory CLI 的執行期資訊(Cowork 路線沒有這些,改由它自己掃 storage / 自由發想)
  const existing = await snapshotStorage();
  prompt += `\n\n## 目前 storage 生態(供參考,仍請自行確認避免重複)\n${existing}`;
  if (seedIdea) prompt += `\n\n## 指定主題\n${seedIdea}`;
  if (forcedCategory) prompt += `\n\n## 指定分類\n${forcedCategory}(優先放入或新開此分類)`;

  // ★ 數量以此為準,覆寫 prompt 內「請產出 3 個」的預設。
  // factory CLI 用「一個 session 產一頁」的模型(總數由外層 count 迴圈控制,見 README),
  // 因此每個 session 固定只做 1 頁;Cowork 走原檔預設(3 頁)不受影響。
  prompt += `\n\n## ⚠️ 本次產出數量(以此為準,覆寫上方「3 個」的敘述)\n本回合請**只產出 1 個**頁面:完成這 1 個(含驗證直到 "ok": true)就結束,並輸出該頁的**一行** JSON 總結即可,不要做第 2、3 個。`;

  console.log(`\n━━━ [${n}] 開始產生(model: ${MODEL}) ━━━`);
  let cost = 0;
  let resultText = '';
  for await (const msg of query({
    prompt,
    options: {
      cwd: ROOT,
      model: MODEL,
      permissionMode: 'acceptEdits',
      allowedTools: ['WebSearch', 'WebFetch', 'Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash', 'TodoWrite'],
      canUseTool,
      maxTurns: 80,
    },
  })) {
    if (msg.type === 'assistant') {
      for (const block of msg.message?.content ?? []) {
        if (block.type === 'tool_use') {
          const hint = block.input?.file_path ?? block.input?.command ?? block.input?.query ?? '';
          console.log(`  · ${block.name} ${String(hint).slice(0, 90)}`);
        }
      }
    }
    if (msg.type === 'result') {
      cost = msg.total_cost_usd ?? 0;
      resultText = msg.result ?? '';
    }
  }
  console.log(`━━━ [${n}] 完成 ─ 花費 $${cost.toFixed(4)}`);
  console.log(resultText.split('\n').slice(-6).join('\n'));
  return cost;
}

// ---------- main ----------
let total = 0;
for (let i = 1; i <= count; i++) {
  try {
    total += await generateOne(i);
  } catch (err) {
    console.error(`[${i}] 失敗:`, err.message ?? err);
  }
}
console.log(`\n全部完成,總花費 $${total.toFixed(4)}`);
console.log('提示: 重啟 server 後封面會自動產生並出現在輪播。');
