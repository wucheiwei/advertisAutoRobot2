import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Browser } from 'puppeteer';

@Injectable()
export class ScreenshotService implements OnModuleDestroy {
  private readonly logger = new Logger(ScreenshotService.name);
  private browserPromise: Promise<Browser> | null = null;

  /** 延遲啟動瀏覽器,並在整個程式生命週期內共用同一個實例。 */
  private getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      // 動態載入,避免沒裝 puppeteer 時整個 app 起不來
      this.browserPromise = import('puppeteer').then((p) =>
        p.default.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        }),
      );
    }
    return this.browserPromise;
  }

  /**
   * 把 targetUrl 截成一張 JPG 封面存到 outPath(每次呼叫都重新截)。
   * 回傳是否成功(失敗時前端用替代封面)。
   */
  async capture(targetUrl: string, outPath: string): Promise<boolean> {
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      // 視窗比例 = mirrow.png 內橢圓的 10:17,封面剛好填滿鏡框開口
      await page.setViewport({ width: 600, height: 1020, deviceScaleFactor: 2 });
      await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });
      // 等封面圖 / 首屏素材載入完成再截,避免空白或錯誤影格
      await page
        .waitForFunction(
          () => {
            const root = document.documentElement;
            if (root.dataset.coverReady === '1') return true;
            const hero = document.querySelector(
              '.home-bg, .hero-bg, [data-cover], img.cover, video.home-video, video.hero-video',
            );
            if (hero instanceof HTMLImageElement) {
              return hero.complete && hero.naturalWidth > 0;
            }
            if (hero instanceof HTMLVideoElement) {
              return hero.readyState >= 2 && hero.videoWidth > 0;
            }
            return document.readyState === 'complete';
          },
          { timeout: 12000 },
        )
        .catch(() => undefined);
      await new Promise((r) => setTimeout(r, 350));
      await page.screenshot({
        path: outPath as `${string}.jpg`,
        type: 'jpeg',
        quality: 88,
      });
      await page.close();
      this.logger.log(`已產生封面: ${outPath}`);
      return true;
    } catch (err) {
      this.logger.warn(`截圖失敗 (${targetUrl}): ${err}`);
      return false;
    }
  }

  async onModuleDestroy() {
    if (this.browserPromise) {
      const browser = await this.browserPromise.catch(() => null);
      await browser?.close();
    }
  }
}
