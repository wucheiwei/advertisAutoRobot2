#!/usr/bin/env python3
"""開發用靜態伺服器：對每個回應都加上 no-cache 標頭，
瀏覽器就不會快取任何檔案，每次進畫面都是最新的。

用法：
    python3 serve.py            # 預設 8000 埠
    python3 serve.py 8080       # 指定埠
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # 強制不快取（HTML/CSS/JS/圖片皆適用）
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    httpd = ThreadingHTTPServer(("", port), NoCacheHandler)
    print(f"No-cache server running → http://localhost:{port}  (Ctrl+C 結束)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
