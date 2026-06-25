/* ===================================================================
   橡樹街末日 · THE END OF OAK STREET — App logic
   流程：GPS 授權 → 依位置解鎖濾鏡 → 相機授權 → 套濾鏡拍照 → 分享
   注意：Geolocation 與相機 (getUserMedia) 需在 https 或 localhost 下才能運作。
   =================================================================== */

(function () {
  'use strict';

  // ---- 狀態 ----
  const state = {
    region: null,        // 解鎖的地區設定 (來自 config.js)
    locationVerified: false, // GPS 驗證通過後才允許進相機
    stream: null,        // 相機 MediaStream
    facingMode: 'environment',
    frameImg: null,      // 已載入的相框 Image 物件
    photoBlob: null,     // 拍好的照片 Blob
    photoUrl: null,      // 照片的 object URL
  };

  // ---- DOM 快取 ----
  const $ = (sel) => document.querySelector(sel);
  const screens = {};
  document.querySelectorAll('.screen').forEach((el) => { screens[el.dataset.screen] = el; });

  const els = {
    btnAllowGps: $('#btn-allow-gps'),
    gpsNote: $('#gps-note'),
    unlockPlace: $('#unlock-place'),
    unlockTitle: $('#unlock-title'),
    unlockThumb: $('#unlock-thumb'),
    btnOpenCamera: $('#btn-open-camera'),
    video: $('#camera-video'),
    frame: $('#camera-frame'),
    canvas: $('#camera-canvas'),
    camPermission: $('#camera-permission'),
    permDino: $('#perm-dino'),
    btnAllowCamera: $('#btn-allow-camera'),
    hud: $('#camera-hud'),
    btnFlip: $('#btn-flip'),
    btnShutter: $('#btn-shutter'),
    btnUploadPhoto: $('#btn-upload-photo'),
    fileUpload: $('#file-upload'),
    sharePhoto: $('#share-photo'),
    btnShare: $('#btn-share'),
    btnSave: $('#btn-save'),
    btnRetake: $('#btn-retake'),
    mapBoard: $('#map-board'),
    mapSelect: $('#map-select'),
    mapSelectIcon: $('#map-select-icon'),
    mapSelectRegion: $('#map-select-region'),
    mapSelectMuseum: $('#map-select-museum'),
    mapHint: $('#map-hint'),
    btnNextSpot: $('#btn-next-spot'),
    toast: $('#toast'),
  };

  // ---- 工具 ----
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove('is-active'));
    screens[name].classList.add('is-active');
  }

  let toastTimer;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('is-show'), 2600);
  }

  // 兩點間距離 (公里) — Haversine
  function distanceKm(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // 依使用者座標挑選「最近且距離足夠近」的地區濾鏡
  function pickRegion(coords) {
    let best = null, bestD = Infinity;
    for (const r of FILTER_REGIONS) {
      const d = distanceKm(coords, r);
      if (d < bestD) { bestD = d; best = r; }
    }
    if (!best || bestD > UNLOCK_RADIUS_KM) return null;
    return best;
  }

  const VERIFY_FAIL_MESSAGES = {
    out_of_range: '您不在任何恐龍出沒點範圍內，請親赴現場解鎖',
    location_mismatch: '定位與網路位置不一致，請關閉 VPN 後再試',
    outside_taiwan: '此活動僅限台灣地區參與',
    ip_check_failed: '無法驗證位置，請關閉 VPN 或稍後再試',
    poor_accuracy: '定位精度不足，請到戶外開闊處再按「重試驗證定位」',
  };

  let ipLocationCache = null;

  async function fetchIpLocation() {
    if (ipLocationCache) return ipLocationCache;
    const res = await fetch('https://ipwho.is/');
    if (!res.ok) throw new Error('IP geo HTTP ' + res.status);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'IP geo failed');
    ipLocationCache = {
      lat: data.latitude,
      lng: data.longitude,
      country: data.country_code,
    };
    return ipLocationCache;
  }

  // GPS + IP 雙重驗證，阻擋 VPN / 改 IP 遠端解鎖
  async function verifyLocation(gpsCoords) {
    const region = pickRegion(gpsCoords);
    if (!region) return { ok: false, reason: 'out_of_range' };

    try {
      const ipLoc = await fetchIpLocation();
      const gpsIpDistance = distanceKm(gpsCoords, ipLoc);

      if (gpsIpDistance > IP_GPS_MAX_DISTANCE_KM) {
        return { ok: false, reason: 'location_mismatch' };
      }
      // 海外 IP 且與 GPS 偏差大 → 拒絕（VPN 改 IP 解鎖）
      if (ipLoc.country !== 'TW' && gpsIpDistance > 80) {
        return { ok: false, reason: 'outside_taiwan' };
      }
    } catch (err) {
      // IP 服務不可用（限流、Safari 私密模式等）→ 改以 GPS 單獨驗證，不阻擋現場使用者
      console.warn('IP location check skipped:', err.message);
    }

    return { ok: true, region };
  }

  // 預先載入相框圖（fetch → blob → Image，避免 Safari 私密模式快取/CORS 問題）
  const frameCache = new Map();

  async function fetchImage(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) throw new Error(`Not an image: ${url}`);
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ img, objectUrl });
        img.onerror = () => reject(new Error(`Decode failed: ${url}`));
        img.src = objectUrl;
      });
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      throw err;
    }
  }

  async function loadFrameImage(src) {
    if (frameCache.has(src)) return frameCache.get(src);

    const promise = (async () => {
      const { img, objectUrl } = await fetchImage(src);
      img._objectUrl = objectUrl;
      return img;
    })();

    frameCache.set(src, promise);
    return promise;
  }

  function showFrameOverlay(img) {
    if (img && img.src) {
      els.frame.src = img.src;
      els.frame.classList.add('is-ready');
    } else {
      els.frame.removeAttribute('src');
      els.frame.classList.remove('is-ready');
    }
  }

  function preloadAllFrames() {
    const urls = new Set(FILTER_REGIONS.map((r) => r.frame));
    urls.forEach((url) => { loadFrameImage(url).catch(() => {}); });
  }

  function goToMapWithoutLocation(message) {
    state.region = null;
    state.locationVerified = false;
    state.frameImg = null;
    showFrameOverlay(null);
    if (message) toast(message);
    renderMap();
    showScreen('map');
  }

  function resetGpsPrompt() {
    els.btnAllowGps.textContent = '允許偵測定位';
    els.btnAllowGps.disabled = false;
    els.gpsNote.classList.remove('note--warn');
    els.gpsNote.textContent = '*免登入直接體驗';
  }

  const GEO_ERR = { DENIED: 1, UNAVAILABLE: 2, TIMEOUT: 3 };

  async function isGeolocationDenied() {
    if (!navigator.permissions || !navigator.permissions.query) return false;
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      return status.state === 'denied';
    } catch {
      return false;
    }
  }

  async function redirectIfLocationDenied(message) {
    if (!(await isGeolocationDenied())) return false;
    goToMapWithoutLocation(message || '未授權定位，請從地圖探索恐龍出沒點');
    return true;
  }

  function showGpsVerifyPrompt(reason) {
    els.btnAllowGps.classList.remove('is-loading');
    els.btnAllowGps.textContent = '重試驗證定位';
    els.gpsNote.classList.add('note--warn');
    showScreen('gps');
    const msg = VERIFY_FAIL_MESSAGES[reason] || '無法解鎖濾鏡';
    toast(msg);
    els.gpsNote.textContent = msg;
  }

  async function requestGps() {
    // 不允許定位（曾封鎖）→ 直接進地圖探索
    if (await isGeolocationDenied()) {
      goToMapWithoutLocation('未授權定位，請從地圖探索恐龍出沒點');
      return;
    }

    els.btnAllowGps.classList.add('is-loading');
    els.gpsNote.classList.remove('note--warn');
    els.gpsNote.textContent = '偵測中…請允許定位權限';

    navigator.geolocation.getCurrentPosition(
      (pos) => { handleGpsSuccess(pos); },
      (err) => { handleGpsError(err); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // =================================================================
  // Screen 1 — GPS 授權
  // =================================================================
  async function handleGpsSuccess(pos) {
    els.btnAllowGps.classList.remove('is-loading');
    if (await redirectIfLocationDenied()) return;

    resetGpsPrompt();
    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };

    if (pos.coords.accuracy > MAX_GPS_ACCURACY_M) {
      showGpsVerifyPrompt('poor_accuracy');
      return;
    }

    const result = await verifyLocation(coords);
    if (!result.ok) {
      // 有開定位但不在據點範圍 → 導到地圖探索其他出沒點
      if (result.reason === 'out_of_range') {
        goToMapWithoutLocation(VERIFY_FAIL_MESSAGES.out_of_range);
        return;
      }
      // 其他驗證失敗（VPN 等）→ 留在 GPS 頁重試
      showGpsVerifyPrompt(result.reason);
      return;
    }
    applyRegion(result.region);
  }

  async function handleGpsError(err) {
    els.btnAllowGps.classList.remove('is-loading');
    // 不允許定位 → 進地圖探索
    if ((err && err.code === GEO_ERR.DENIED) || await isGeolocationDenied()) {
      goToMapWithoutLocation('未授權定位，請從地圖探索恐龍出沒點');
      return;
    }
    // 找不到定位（定位服務未開 / 逾時 / 取得失敗）→ 進地圖探索
    goToMapWithoutLocation('無法取得定位，請從地圖探索恐龍出沒點');
  }

  els.btnAllowGps.addEventListener('click', () => {
    if (!('geolocation' in navigator)) {
      els.gpsNote.classList.add('note--warn');
      els.gpsNote.textContent = '此裝置或瀏覽器不支援定位，請改用支援 GPS 的手機瀏覽器。';
      els.btnAllowGps.disabled = true;
      toast('此裝置不支援定位');
      return;
    }
    requestGps();
  });

  // 套用解鎖結果，進入 Screen 2；相框不存在則直接進地圖（不標示目前位置）
  async function applyRegion(region) {
    if (await redirectIfLocationDenied()) return;

    showFrameOverlay(null);
    state.frameImg = null;
    state.locationVerified = false;
    try {
      state.frameImg = await loadFrameImage(region.frame);
    } catch (err) {
      console.warn('Frame unavailable:', region.frame, err.message);
      goToMapWithoutLocation('此地區濾鏡尚未開放，請探索其他恐龍出沒點');
      return;
    }
    if (await redirectIfLocationDenied()) return;
    state.region = region;
    state.locationVerified = true;
    els.unlockPlace.textContent = `已偵測到${region.place}`;
    els.unlockTitle.textContent = `獲得濾鏡-${region.dino}`;
    els.unlockThumb.src = region.thumb;
    els.unlockThumb.alt = `獲得濾鏡-${region.dino}`;
    els.permDino.textContent = region.dino;
    document.documentElement.style.setProperty('--lime', region.accent || '#8be04e');
    showFrameOverlay(state.frameImg);
    showScreen('unlock');
  }

  // =================================================================
  // Screen 2 → 3 — 開啟相機
  // =================================================================
  function enterCameraScreen() {
    if (!state.locationVerified || !state.region) {
      goToMapWithoutLocation('未授權定位，請從地圖探索恐龍出沒點');
      return;
    }
    showScreen('camera');
    els.hud.hidden = true;
    els.camPermission.classList.remove('is-hidden');
    if (state.frameImg) showFrameOverlay(state.frameImg);
    startCamera(state.facingMode);
  }

  els.btnOpenCamera.addEventListener('click', enterCameraScreen);
  els.btnAllowCamera.addEventListener('click', () => startCamera(state.facingMode));

  async function startCamera(facingMode) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('此裝置/瀏覽器不支援相機');
      return;
    }
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      state.stream = stream;
      state.facingMode = facingMode;
      els.video.srcObject = stream;
      els.video.classList.toggle('is-mirrored', facingMode === 'user');
      await els.video.play().catch(() => {});
      els.camPermission.classList.add('is-hidden');
      els.hud.hidden = false;
    } catch (err) {
      console.error(err);
      els.camPermission.classList.remove('is-hidden');
      if (err.name === 'NotAllowedError') {
        toast('未授權相機，請於瀏覽器設定開啟');
      } else {
        toast('無法開啟相機：' + err.name);
      }
    }
  }

  function stopCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach((t) => t.stop());
      state.stream = null;
    }
  }

  // 切換前/後鏡頭
  els.btnFlip.addEventListener('click', () => {
    startCamera(state.facingMode === 'environment' ? 'user' : 'environment');
  });

  // 把影像依 object-fit: cover 規則畫進 canvas
  function drawCover(ctx, img, cw, ch, mirror) {
    const iw = img.videoWidth || img.naturalWidth || img.width;
    const ih = img.videoHeight || img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale, dh = ih * scale;
    const dx = (cw - dw) / 2, dy = (ch - dh) / 2;
    ctx.save();
    if (mirror) { ctx.translate(cw, 0); ctx.scale(-1, 1); }
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  // 拍照：合成「相機畫面 + 相框」
  async function capturePhoto() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.round(els.video.clientWidth * dpr);
    const ch = Math.round(els.video.clientHeight * dpr);
    els.canvas.width = cw;
    els.canvas.height = ch;
    const ctx = els.canvas.getContext('2d');

    drawCover(ctx, els.video, cw, ch, state.facingMode === 'user');

    if (!state.frameImg) {
      try { state.frameImg = await loadFrameImage(state.region.frame); } catch (e) {}
    }
    // 相框拉伸填滿整張畫布 (對應 CSS object-fit: fill)，不裁切
    if (state.frameImg) ctx.drawImage(state.frameImg, 0, 0, cw, ch);

    await finishPhotoFromCanvas();
  }

  // 上傳既有照片：把使用者選的圖 + 相框合成
  async function compositeUploaded(file) {
    const fileUrl = URL.createObjectURL(file);
    try {
      const { img, objectUrl } = await fetchImage(fileUrl);
      const cw = img.naturalWidth, ch = img.naturalHeight;
      els.canvas.width = cw; els.canvas.height = ch;
      const ctx = els.canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, cw, ch);
      URL.revokeObjectURL(objectUrl);
      if (!state.frameImg) { try { state.frameImg = await loadFrameImage(state.region.frame); } catch (e) {} }
      if (state.frameImg) ctx.drawImage(state.frameImg, 0, 0, cw, ch);
      await finishPhotoFromCanvas();
    } catch (err) {
      toast('無法讀取照片，請換一張試試');
    } finally {
      URL.revokeObjectURL(fileUrl);
    }
  }

  function finishPhotoFromCanvas() {
    return new Promise((resolve) => {
      els.canvas.toBlob((blob) => {
        if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
        state.photoBlob = blob;
        state.photoUrl = URL.createObjectURL(blob);
        els.sharePhoto.src = state.photoUrl;
        stopCamera();
        showScreen('share');
        resolve();
      }, 'image/jpeg', 0.92);
    });
  }

  els.btnShutter.addEventListener('click', () => { capturePhoto(); });

  els.btnUploadPhoto.addEventListener('click', () => els.fileUpload.click());
  els.fileUpload.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) compositeUploaded(file);
    els.fileUpload.value = '';
  });

  // =================================================================
  // Screen 4 — 分享 / 儲存
  // =================================================================
  function photoFile() {
    return new File([state.photoBlob], 'oak-street-end.jpg', { type: 'image/jpeg' });
  }

  const SHARE_CAPTION = '#橡樹街末日 #THEENDOFOAKSTREET 我遇到了遠古宿敵！';

  // 叫出系統分享面板，使用者自選 IG / FB / X / Threads（手機上可帶照片）
  async function nativeShare() {
    if (!state.photoBlob) return;
    const file = photoFile();
    const shareData = {
      files: [file],
      title: '橡樹街末日',
      text: SHARE_CAPTION,
    };
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      toast('請在分享面板選擇要分享的 App');
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== 'AbortError') toast('分享已取消');
      }
    } else {
      savePhoto();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(SHARE_CAPTION).catch(() => {});
      }
      toast('此環境不支援直接分享，已儲存圖片並複製文案');
    }
  }

  els.btnShare.addEventListener('click', nativeShare);

  // 儲存到相簿：手機走分享面板選「儲存到照片」；桌機則下載檔案
  // 回傳 true 代表確實存檔 / 完成存檔動作；使用者取消則回傳 false。
  async function savePhoto(opts) {
    if (!state.photoUrl || !state.photoBlob) return false;
    const file = photoFile();
    const filename = `oak-street-${state.region ? state.region.id : 'photo'}.jpg`;

    if (!opts?.forceDownload && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      if (!(opts && opts.silent)) toast('請選擇「儲存到照片」或「加入照片」');
      try {
        await navigator.share({ files: [file] });
        return true;
      } catch (err) {
        if (err.name === 'AbortError') return false;
        // 其他錯誤 → 退回桌機下載流程
      }
    }

    const a = document.createElement('a');
    a.href = state.photoUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (!(opts && opts.silent)) toast('已下載照片（桌機請從下載資料夾取得）');
    return true;
  }

  // 儲存成功後 → 跳到 Screen 5 全台連線地圖
  els.btnSave.addEventListener('click', async () => {
    const saved = await savePhoto();
    if (saved) { renderMap(); showScreen('map'); }
  });

  // 重新拍攝
  els.btnRetake.addEventListener('click', enterCameraScreen);

  // =================================================================
  // Screen 5 (Ending) — 全台連線地圖
  // =================================================================
  // 對齊 assets/map-taiwan.png 上既有的 5 個圈圈位置 (百分比，依圖檔偵測)
  const MAP_POS = {
    taipei:   { x: 67.8, y: 11.3 },
    yilan:    { x: 83.3, y: 22.3 },
    taichung: { x: 48.4, y: 36.4 },
    tainan:   { x: 36.3, y: 59.9 },
    taitung:  { x: 63.4, y: 63.4 },
  };

  function renderMap() {
    els.mapBoard.innerHTML = '';
    const currentId = state.region ? state.region.id : null;
    FILTER_REGIONS.forEach((r) => {
      const pos = MAP_POS[r.id] || { x: 50, y: 50 };
      const isCurrent = currentId !== null && r.id === currentId;
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'map-pin' + (isCurrent ? ' is-current' : '');
      pin.style.left = pos.x + '%';
      pin.style.top = pos.y + '%';
      pin.setAttribute('aria-label', `${r.region}・${r.dino}`);
      pin.innerHTML =
        `<div class="map-pin__dot"><img src="${r.thumb}" alt="${r.dino}" /></div>` +
        `<div class="map-pin__label">${isCurrent ? '當前位置 · ' : ''}${r.region}</div>`;
      pin.addEventListener('click', () => selectSpot(r, pin));
      els.mapBoard.appendChild(pin);
    });
    // 重設選取狀態
    els.mapSelect.hidden = true;
    els.btnNextSpot.hidden = true;
    els.mapHint.hidden = false;
  }

  // 點選地圖據點：顯示該濾鏡恐龍 icon + 科博館，並導流 Google Maps
  function selectSpot(region, pinEl) {
    els.mapBoard.querySelectorAll('.map-pin').forEach((p) => p.classList.remove('is-selected'));
    if (pinEl) pinEl.classList.add('is-selected');

    els.mapSelectIcon.src = region.thumb;
    els.mapSelectIcon.alt = region.dino;
    els.mapSelectRegion.textContent = `${region.region}・${region.dino}`;
    els.mapSelectMuseum.textContent = `📍 ${region.museum}`;
    els.mapSelect.hidden = false;

    els.btnNextSpot.href = museumMapUrl(region);
    // 文字固定，避免按鈕大小隨館名長短改變（館名已顯示在上方面板）
    els.btnNextSpot.textContent = '📍 開啟 Google 地圖導航';
    els.btnNextSpot.hidden = false;
    els.mapHint.hidden = true;
  }

  // 提供從分享頁前往地圖的方式：點擊照片
  els.sharePhoto.addEventListener('click', () => { renderMap(); showScreen('map'); });

  // 初始畫面
  showScreen('gps');
  preloadAllFrames();

  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' }).then((status) => {
      status.onchange = () => {
        if (status.state === 'denied' && !state.locationVerified) {
          goToMapWithoutLocation('未授權定位，請從地圖探索恐龍出沒點');
        }
      };
    }).catch(() => {});
  }

  // 釋放資源
  window.addEventListener('pagehide', stopCamera);
})();
