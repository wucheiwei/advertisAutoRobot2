import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { promises as fs, watch } from 'fs';
import type { FSWatcher } from 'fs';
import { join } from 'path';
import { ScreenshotService } from './screenshot.service';

export interface ScannedProject {
  /** 分類顯示名稱,例如 "AR" */
  category: string;
  /** 分類資料夾名稱,例如 "AR-ad" */
  dir: string;
  /** 廣告專案資料夾名稱 */
  project: string;
  /** index.html 絕對路徑 */
  indexPath: string;
  /** 廣告頁網址 */
  url: string;
  /** 封面檔名(= 分類_專案.jpg) */
  coverFile: string;
}

/**
 * 已知分類:實體資料夾 → 顯示名稱與優先順序。
 * 不在此清單的資料夾也會被自動掃到(Claude 自己開的新分類),
 * 顯示名稱由資料夾名推導(去掉結尾的 -ad、底線/連字號換空白)。
 */
export const CATEGORY_MAP: { dir: string; name: string }[] = [
  { dir: 'AR-ad', name: 'AR' },
  { dir: 'Immersive-ad', name: '沈浸式廣告' },
  { dir: 'Filter-ad', name: '濾鏡' },
  { dir: 'Game-ad', name: '遊戲' },
  { dir: 'Quiz-ad', name: '測驗' },
];

/** 由資料夾名推導顯示分類名(未知分類用) */
function displayName(dir: string): string {
  const known = CATEGORY_MAP.find((c) => c.dir === dir);
  if (known) return known.name;
  return dir.replace(/[-_]?ad$/i, '').replace(/[-_]+/g, ' ').trim() || dir;
}

/** 每隔多久掃描一次孤兒封面 */
const PRUNE_INTERVAL_MS = 10 * 60 * 1000;

@Injectable()
export class CoverService implements OnModuleDestroy {
  private readonly logger = new Logger(CoverService.name);
  private readonly storageRoot = join(process.cwd(), 'storage');
  private readonly coversDir = join(this.storageRoot, 'covers');
  private pruneTimer: NodeJS.Timeout | null = null;
  private watcher: FSWatcher | null = null;
  private watchTimer: NodeJS.Timeout | null = null;
  /** 正在增量產封面;期間若又有變動,設 rerunPending 等跑完再補一輪 */
  private generating = false;
  private rerunPending = false;

  constructor(private readonly screenshot: ScreenshotService) {}

  /**
   * 掃描 storage/ 底下「每一個」分類資料夾(不限既有清單),
   * 每個分類下含 index.html 的子資料夾即為一個專案。
   * 已知分類照 CATEGORY_MAP 順序排前面,其餘(Claude 新開的)依字母排後面。
   */
  async scanProjects(): Promise<ScannedProject[]> {
    let dirs: string[];
    try {
      dirs = (await fs.readdir(this.storageRoot, { withFileTypes: true }))
        .filter(
          (e) =>
            e.isDirectory() && e.name !== 'covers' && !e.name.startsWith('.'),
        )
        .map((e) => e.name);
    } catch {
      return [];
    }

    // 排序:已知分類在前(照 CATEGORY_MAP),未知分類在後(字母序)
    const order = CATEGORY_MAP.map((c) => c.dir);
    dirs.sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 || ib !== -1)
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      return a.localeCompare(b);
    });

    const out: ScannedProject[] = [];
    for (const dir of dirs) {
      const categoryPath = join(this.storageRoot, dir);
      const name = displayName(dir);
      const entries = await fs.readdir(categoryPath, { withFileTypes: true });
      const projects = entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
      for (const project of projects) {
        const indexPath = join(categoryPath, project, 'index.html');
        const hasIndex = await fs
          .access(indexPath)
          .then(() => true)
          .catch(() => false);
        if (!hasIndex) continue;
        out.push({
          category: name,
          dir,
          project,
          indexPath,
          url: `/storage/${dir}/${project}/index.html`,
          coverFile: `${dir}_${project}.jpg`,
        });
      }
    }
    return out;
  }

  /**
   * server 重啟時呼叫:先清空所有舊封面,再掃描專案全部重新產生。
   * 需在 HTTP server 開始 listen 之後呼叫(透過本機網址截圖)。
   */
  async regenerateAll(): Promise<void> {
    await fs.mkdir(this.coversDir, { recursive: true });

    // 1) 清空舊封面
    const old = await fs.readdir(this.coversDir).catch(() => [] as string[]);
    await Promise.all(
      old.map((f) => fs.rm(join(this.coversDir, f), { force: true })),
    );

    // 2) 掃描專案,逐一重新截圖
    const port = process.env.PORT ?? 3000;
    const base = `http://127.0.0.1:${port}`;
    const projects = await this.scanProjects();
    this.logger.log(`重新產生 ${projects.length} 張封面…`);
    for (const p of projects) {
      await this.screenshot.capture(
        `${base}${p.url}`,
        join(this.coversDir, p.coverFile),
      );
    }
    this.logger.log('封面產生完成');
  }

  /**
   * 增量:只為「還沒有封面檔」的專案截圖(熱更新用,不刪舊檔)。
   * 回傳這次新產生的專案清單。
   */
  async generateMissing(): Promise<ScannedProject[]> {
    await fs.mkdir(this.coversDir, { recursive: true });
    const port = process.env.PORT ?? 3000;
    const base = `http://127.0.0.1:${port}`;
    const projects = await this.scanProjects();
    const created: ScannedProject[] = [];
    for (const p of projects) {
      const coverPath = join(this.coversDir, p.coverFile);
      const exists = await fs
        .access(coverPath)
        .then(() => true)
        .catch(() => false);
      if (exists) continue;
      const ok = await this.screenshot.capture(`${base}${p.url}`, coverPath);
      if (ok) created.push(p);
    }
    if (created.length) {
      this.logger.log(
        `熱更新:新增 ${created.length} 張封面 (${created
          .map((p) => p.coverFile)
          .join(', ')})`,
      );
    }
    return created;
  }

  /**
   * 串行化版本:同一時間只跑一輪 generateMissing + pruneOrphans;
   * 跑的過程中若又被觸發,跑完會自動再補一輪(吃掉最後一次變動)。
   */
  private async runIncremental(): Promise<void> {
    if (this.generating) {
      this.rerunPending = true;
      return;
    }
    this.generating = true;
    try {
      do {
        this.rerunPending = false;
        await this.generateMissing();
        await this.pruneOrphans();
      } while (this.rerunPending);
    } finally {
      this.generating = false;
    }
  }

  /**
   * 監看 storage/:任何專案資料夾變動(新增 index.html / 刪除專案)時,
   * debounce 後自動增量產封面 + 清孤兒,免重啟。
   * 忽略 covers/ 自身的寫入以免無限迴圈。
   */
  watchStorage(): void {
    if (this.watcher) return;
    try {
      this.watcher = watch(
        this.storageRoot,
        { recursive: true },
        (_event, filename) => {
          if (!filename) return;
          const segs = filename.toString().split(/[\\/]/);
          // 略過封面資料夾本身(避免我們寫封面又觸發自己)與隱藏檔
          if (segs.some((s) => s === 'covers' || s.startsWith('.'))) return;
          if (this.watchTimer) clearTimeout(this.watchTimer);
          this.watchTimer = setTimeout(() => {
            this.runIncremental().catch((err) =>
              this.logger.warn(`熱更新封面失敗: ${err}`),
            );
          }, 1200);
          this.watchTimer.unref?.();
        },
      );
      this.logger.log('已開始監看 storage/,新頁面會自動產生封面(免重啟)');
    } catch (err) {
      this.logger.warn(
        `無法監看 storage/ (${err});新封面需重啟 server 才會出現`,
      );
    }
  }

  /** 刪掉沒有對應專案的孤兒封面 */
  async pruneOrphans(): Promise<void> {
    let files: string[];
    try {
      files = await fs.readdir(this.coversDir);
    } catch {
      return;
    }
    const valid = new Set((await this.scanProjects()).map((p) => p.coverFile));
    const orphans = files.filter((f) => !valid.has(f));
    if (!orphans.length) return;
    await Promise.all(
      orphans.map((f) => fs.rm(join(this.coversDir, f), { force: true })),
    );
    this.logger.log(`清除 ${orphans.length} 張孤兒封面: ${orphans.join(', ')}`);
  }

  /** 啟動固定時間的孤兒封面清理 job */
  startPruneJob(): void {
    if (this.pruneTimer) return;
    this.pruneTimer = setInterval(() => {
      this.pruneOrphans().catch((err) =>
        this.logger.warn(`清理孤兒封面失敗: ${err}`),
      );
    }, PRUNE_INTERVAL_MS);
    // 不要因為這個計時器卡住程式結束
    this.pruneTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    if (this.watchTimer) clearTimeout(this.watchTimer);
    if (this.watcher) this.watcher.close();
  }
}
