# Landing Page 產線 — 可用素材與技術清單

> 給自動產生器(Claude)使用。**只能使用可商用、免授權金的來源**;
> 找靈感時學「手法」,不要複製別人網站的程式碼或圖文。

## CDN 函式庫(單檔 HTML 直接 <script> 引入)

| 用途 | 函式庫 | CDN |
|------|--------|-----|
| 3D / WebGL | three.js | https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.min.js |
| 3D 模型展示 | model-viewer | https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js |
| 捲動動畫 | GSAP + ScrollTrigger | https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js |
| 2D 遊戲(輕量) | kontra.js | https://cdn.jsdelivr.net/npm/kontra@9/kontra.min.js |
| 2D 遊戲(完整) | Phaser 3 | https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js |
| 物理引擎 | matter.js | https://cdn.jsdelivr.net/npm/matter-js@0.19.0/build/matter.min.js |
| 臉部偵測(濾鏡) | MediaPipe Face Mesh | https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh |
| 粒子效果 | tsParticles | https://cdn.jsdelivr.net/npm/tsparticles@3/tsparticles.bundle.min.js |
| 抽獎轉盤/紙花 | canvas-confetti | https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js |
| 音效合成 | Tone.js | https://cdn.jsdelivr.net/npm/tone@14.8.49/build/Tone.min.js |

## 免費素材(可商用)

- **圖片**:Unsplash https://images.unsplash.com/...(可直接热連)、Pexels
- **圖示**:Tabler Icons、Heroicons(MIT,可內聯 SVG)
- **字體**:Google Fonts(Noto Sans TC、Sora 等)
- **3D 模型**:Poly Pizza(CC0/CC-BY)、Khronos glTF Sample Models
- **Lottie 動畫**:LottieFiles 免費區
- **首選做法**:能用 CSS/SVG/canvas 程序化畫出來的,就不要依賴外部素材(最穩、不會 404)

## 靈感來源(看手法,不抄代碼)

- awwwards.com / codrops(tympanus.net/codrops)上的互動案例文章
- CodePen 熱門(觀念參考;若引用片段需確認授權)
- 各大品牌活動站的「互動機制」描述(轉盤、占卜、測驗、AR 試戴、捲動敘事、小遊戲)

## 產出規範(務必遵守)

1. **單檔自包含**:一個 `index.html` 完成,CSS/JS 內聯;外部只允許上表 CDN 與 Google Fonts/Unsplash。
2. **不需要 build**、不可用 npm import、不可引用本機不存在的檔案。
3. `<title>` 必填(輪播用它當標題,請寫繁體中文、像廣告活動名)。
4. 行動裝置優先(viewport meta、觸控可玩),也要能滑鼠操作。
5. 必須有明確「互動」:遊戲、抽獎、測驗、濾鏡、3D 操作、捲動敘事…擇一以上。
6. 要有 CTA(行動呼籲按鈕)與品牌活動的「廣告感」(虛構品牌即可,內容用繁體中文)。
7. 相機權限類(AR/濾鏡)必須做「無相機時的優雅降級」(展示模式),否則驗證會失敗。
8. 不得有 console error;CDN 連結要實際存在(verify 會檢查 404)。
