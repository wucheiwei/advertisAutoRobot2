<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

---

## 互動 Landing Page 產線

本專案除了 NestJS 後端,還包含一條「互動廣告活動頁」產線:每個活動頁都是**單檔自包含的 `index.html`**,放在 `storage/<分類>/<slug>/` 底下,由輪播服務統一展示。
預設登入帳號 test
### 目錄結構

```
storage/
  AR-ad/         # AR 體驗(相機)
  Filter-ad/     # 濾鏡 / 試戴
  Fortune-ad/    # 占卜 / 心理測驗
  Immersive-ad/  # 沉浸式捲動敘事
  Game-ad/       # 互動小遊戲
  └─ <slug>/index.html   # 單檔自包含活動頁
tools/
  factory.mjs    # ★ 一鍵自動產線:Claude 自己找資料、寫 code、自驗證
  sources.md     # ★ 開工前必讀:允許的 CDN、可商用素材、產出規範
  verify.mjs     # 自動驗證 + 截封面
```

### 自動產線(讓 Claude 自己做)— `yarn factory`

這是「下一個指令就開始爬網站 + 寫 HTML」的入口。它會用 Claude Agent SDK 跑一個 agent:讀 `sources.md` → 用 WebSearch / WebFetch 研究互動手法 → 自己寫 `storage/<分類>/<slug>/index.html` → 跑 `verify.mjs` 自我驗證,直到 `ok: true`。

```bash
# 前置:需 Node 18+(本機請用 nvm 切到 v24),且已登入 Claude Code 或設好 ANTHROPIC_API_KEY
nvm use 24

yarn factory                          # 產 1 個,主題/分類由 Claude 自己發想
yarn factory 3                        # 連續產 3 個(每個獨立 session,上限 10)
yarn factory --category Game-ad       # 指定(或新開)分類
yarn factory --idea "黑膠唱片占卜抽籤"   # 指定主題

# 等同直接呼叫:
node tools/factory.mjs [數量] [--category <分類>] [--idea "<主題>"]
```

- **權限防呆**:agent 只能寫入 `storage/**`,Bash 只准跑 `verify.mjs` / `ls` / `mkdir -p storage/...`,不會動到其他檔案。
- **模型**:預設 `claude-opus-4-8`,可用環境變數 `FACTORY_MODEL` 覆寫。
- 跑完會印出每個頁面的花費與一行 JSON 總結;**重啟 server 後**會自動截封面並出現在輪播。

> 想自己手寫(不透過 Claude)就照下面「新增一個活動頁」的步驟來。

### 新增一個活動頁(手動)

1. **先讀規範**:[`tools/sources.md`](tools/sources.md) —— 只能用清單上的 CDN 與可商用素材,不抄別人的代碼/圖文。
2. 決定分類與 slug(小寫-連字號、英文、3 個單字內),建立 `storage/<分類>/<slug>/index.html`。
   - 單檔自包含、CSS/JS 內聯;`<title>` 必填(繁中,當輪播標題)。
   - 行動裝置優先、要有互動與 CTA;相機類務必做「無相機降級」。
3. **只能寫 `storage/` 底下**,不要動其他檔案。

### 驗證(必跑,直到 `ok: true`)

```bash
# ⚠️ verify.mjs 用到 optional chaining,需 Node 18+(本機請用 nvm 切到 v24)
nvm use 24            # 或 export PATH="$HOME/.nvm/versions/node/v24.x.x/bin:$PATH"

node tools/verify.mjs storage/<分類>/<slug>/index.html
```

驗證會:起臨時靜態 server → 用 puppeteer 開頁面 → 收集 console error / 404 → 截一張 `_preview.jpg` 到該資料夾。
有任何 console error / 404 就修 `index.html` 後重跑,直到輸出 `"ok": true`。

完成後輸出一行 JSON 總結:

```json
{"category": "...", "slug": "...", "title": "...", "interactive": "玩法一句話"}
```

> 範例:[`storage/Game-ad/cup-stack/`](storage/Game-ad/cup-stack/) — 雲頂咖啡「疊到雲端的咖啡塔」堆杯小遊戲。

---

## Project setup

```bash
$ yarn install
```

## Compile and run the project

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Run tests

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ yarn install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
