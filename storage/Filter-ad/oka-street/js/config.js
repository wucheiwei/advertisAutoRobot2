/*
 * 橡樹街末日 — 設定檔 (Config)
 * =================================================================
 * 這裡定義「地區 → 恐龍濾鏡」的對應關係。
 *
 * 想換成正式素材時，只要把 assets/ 資料夾裡對應的檔案換掉即可：
 *   - frame: 拍照時疊在相機畫面上的「相框」(中間必須透明)
 *   - thumb: 解鎖頁/地圖上顯示的恐龍縮圖
 * 換成 PNG 時，把副檔名改成 .png 並放到相同路徑即可，例如：
 *   frame: 'assets/frames/trex.png'
 *
 * lat / lng 是該地區的中心座標，App 會用使用者 GPS 找「最近的地區」
 * 來決定解鎖哪一個濾鏡。須在 UNLOCK_RADIUS_KM 範圍內，並通過 IP 交叉驗證。
 */

// 須在據點中心此半徑內才能解鎖（公里）
const UNLOCK_RADIUS_KM = 50;

// GPS 與 IP 定位允許的最大偏差（公里），超過視為 VPN / 位置偽造
const IP_GPS_MAX_DISTANCE_KM = 300;

// GPS 精度上限（公尺），超過表示定位不可靠
const MAX_GPS_ACCURACY_M = 5000;

const FILTER_REGIONS = [
  {
    id: 'taipei',
    region: '台北',
    place: '台北車站',
    dino: '暴龍',
    dinoEn: 'T-Rex',
    lat: 25.0478,
    lng: 121.5170,
    accent: '#8be04e',
    frame: 'assets/frames/trex.png',
    thumb: 'assets/dino/trex.png',
    // 該縣市「科博館」——點地圖 pin 後導流到 Google Maps 查詢用
    museum: '國立臺灣科學教育館',
  },
  {
    id: 'yilan',
    region: '宜蘭',
    place: '宜蘭火車站',
    dino: '劍龍',
    dinoEn: 'Stegosaurus',
    lat: 24.7544,
    lng: 121.7580,
    accent: '#8be04e',
    frame: 'assets/frames/stegosaurus.png',
    thumb: 'assets/dino/stegosaurus.png',
    museum: '蘭陽博物館',
  },
  {
    id: 'taichung',
    region: '台中',
    place: '台中科博館',
    dino: '三角龍',
    dinoEn: 'Triceratops',
    lat: 24.1637, // 國立自然科學博物館
    lng: 120.6664,
    accent: '#8be04e',
    frame: 'assets/frames/triceratops.png',
    thumb: 'assets/dino/triceratops.png',
    museum: '國立自然科學博物館',
  },
  {
    id: 'tainan',
    region: '台南',
    place: '台南火車站',
    dino: '翼龍',
    dinoEn: 'Pteranodon',
    lat: 22.9971,
    lng: 120.2128,
    accent: '#8be04e',
    frame: 'assets/frames/pteranodon.png',
    thumb: 'assets/dino/pteranodon.png',
    museum: '國立臺灣史前文化博物館南科考古館',
  },
  {
    id: 'taitung',
    region: '台東',
    place: '台東火車站',
    dino: '迅猛龍',
    dinoEn: 'Velociraptor',
    lat: 22.7929,
    lng: 121.1232,
    accent: '#8be04e',
    frame: 'assets/frames/velociraptor.png',
    thumb: 'assets/dino/velociraptor.png',
    museum: '國立臺灣史前文化博物館',
  },
];

// 由縣市的科博館名稱組出 Google Maps 查詢網址 (查詢該館地址)
function museumMapUrl(region) {
  const q = region && region.museum ? `${region.region} ${region.museum}` : '科學博物館';
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
}

// 末日獵影相框底部品牌字樣
const BRAND_TEXT = 'THE END OF OAK STREET';

// 下一個據點導流 (Ending 頁的「開啟 google 地圖」)，可換成正式座標
const NEXT_SPOT = {
  name: '下一個據點',
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=24.1637,120.6664',
};
