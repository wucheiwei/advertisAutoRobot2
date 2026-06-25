# 橡樹街末日 · THE END OF OAK STREET

行動裝置優先的「定位解鎖 + 相機濾鏡」互動體驗（純 HTML / CSS / JS，無需打包）。

## 流程

1. **GPS 授權** — 首頁請求定位權限（`navigator.geolocation`）。
2. **依位置解鎖濾鏡** — 用 GPS 找最近的地區，解鎖該地恐龍相框（台北→三角龍、宜蘭→劍龍、台中→暴龍、台南→翼龍、台東→迅猛龍）。離所有地區都很遠或拒絕授權時，預設台中科博館「暴龍」。
3. **相機授權** — 跳出說明頁，請求相機權限（`getUserMedia`）。
4. **套濾鏡拍照** — 即時預覽疊上恐龍相框，可切換前/後鏡頭，按快門拍照；也可「上傳照片」把相簿既有圖合成相框。
5. **分享** — 預覽成果，可：
   - **分享到社群**：叫出系統分享面板（手機上可選 Instagram / Facebook / X / Threads…）。
   - 個別平台鈕：手機帶圖分享；桌機則下載圖片並開啟對應分享頁。
   - **儲存到相簿**：下載合成後的照片。
   - 點照片可進入 **全台連線恐龍出沒點** 地圖（導流下個據點）。

## 本機執行

相機與定位需要「安全環境」。`localhost` 視為安全，可直接測：

```bash
cd oka-street
python3 -m http.server 8000
# 開 http://localhost:8000
```

> **手機實機測試**需 HTTPS。可用 `ngrok http 8000`、Cloudflare Tunnel，或部署到任何靜態主機（GitHub Pages / Netlify / Vercel）。

## 換素材 / 改設定

- 相框與恐龍圖：見 [`assets/README.md`](assets/README.md)（目前是佔位 SVG，可直接覆蓋）。
- 地區座標、對應恐龍、下個據點地圖連結：見 [`js/config.js`](js/config.js)。

## 檔案結構

```
index.html        五個畫面 (GPS / 解鎖 / 相機 / 分享 / 地圖)
css/styles.css    叢林石刻風格樣式
js/config.js      地區 → 濾鏡 對應、可調設定
js/app.js         定位、相機、合成、分享邏輯
assets/frames/    拍照相框 (中央透明)
assets/dino/      恐龍縮圖
```
