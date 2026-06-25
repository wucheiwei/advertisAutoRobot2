import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { AuthService } from '../auth/auth.service';
import { CoverService } from './cover.service';

export interface CarouselItem {
  /** 分類顯示名稱,例如 "AR" */
  category: string;
  /** 廣告專案資料夾名稱 */
  name: string;
  /** 顯示標題(取 index.html 的 <title>,沒有就用資料夾名) */
  title: string;
  /** 廣告頁網址 (點擊時前往) */
  url: string;
  /** 封面圖網址(命名 = 分類_專案) */
  cover: string;
}

@Injectable()
export class CarouselService {
  constructor(
    private readonly cover: CoverService,
    private readonly auth: AuthService,
  ) {}

  /**
   * 先判斷專案是否存在(掃描資料夾),存在才放進清單,
   * 並以約定命名(= 專案資料夾名)指向封面圖。
   */
  async getItems(opts?: { username?: string }): Promise<CarouselItem[]> {
    const projects = await this.cover.scanProjects();
    const allowed = this.auth.isHadalaboUser(opts?.username)
      ? this.auth.getHadalaboAllowedProjects()
      : null;
    const filtered = allowed
      ? projects.filter((p) => allowed.has(p.project))
      : projects;

    const items: CarouselItem[] = [];
    for (const p of filtered) {
      items.push({
        category: p.category,
        name: p.project,
        title: await this.readTitle(p.indexPath, p.project),
        url: p.url,
        cover: `/storage/covers/${p.coverFile}`,
      });
    }
    return items;
  }

  /** 從 index.html 取出 <title>,失敗則退回資料夾名稱 */
  private async readTitle(indexPath: string, fallback: string): Promise<string> {
    try {
      const html = await fs.readFile(indexPath, 'utf-8');
      const match = html.match(/<title>([^<]*)<\/title>/i);
      const title = match?.[1]?.trim();
      return title || fallback;
    } catch {
      return fallback;
    }
  }
}
