import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { createAuthMiddleware } from './auth/auth.middleware';
import { AuthService } from './auth/auth.service';
import { CoverService } from './carousel/cover.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Render 等反向代理需信任 X-Forwarded-* 以正確判斷 client IP
  app.set('trust proxy', 1);

  // 在靜態檔之前攔截:未登入無法進入首頁與 storage 活動頁
  const authService = app.get(AuthService);
  app.use(createAuthMiddleware(authService));

  // 首頁與前端靜態檔 (public/index.html 會服務在 "/")
  app.useStaticAssets(join(process.cwd(), 'public'));

  // storage 資料夾裡的媒體檔,透過 /storage/xxx 取得
  app.useStaticAssets(join(process.cwd(), 'storage'), { prefix: '/storage/' });

  await app.listen(process.env.PORT ?? 3000);

  const cover = app.get(CoverService);

  // SERVE_ONLY=1:部署機模式 —— 只服務「本機已產好並 commit 的封面」,
  // 不跑 Puppeteer 重產 / 不監看 storage(部署機沒有也不需要 Puppeteer)。
  // cowork/factory 與封面截圖都在本機完成,push 上來後部署機直接服務。
  if (process.env.SERVE_ONLY === '1') {
    console.log('SERVE_ONLY 模式:直接服務既有封面,略過 Puppeteer 重產與監看');
    return;
  }

  // 本機:清空舊封面 → 掃描專案全部重產 → 啟動定時清孤兒 job → 監看 storage 熱更新
  cover
    .regenerateAll()
    .then(() => {
      cover.startPruneJob();
      cover.watchStorage(); // 新頁面產生後自動補封面,免重啟
    })
    .catch((err) => console.error('封面初始化失敗:', err));
}
bootstrap();
