#!/usr/bin/env bash
# Renders scripts/og-home.html to assets/og/home.jpg (1200x630) with headless Chrome. Needs Google Chrome and Python 3.
# Run from the project folder.  npm run og-home
set -e
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
PORT=8765; python3 -m http.server $PORT >/dev/null 2>&1 & SRV=$!; trap "kill $SRV 2>/dev/null" EXIT; sleep 1
mkdir -p assets/og
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size=1200,630 --virtual-time-budget=6000 --screenshot=assets/og/home.png "http://localhost:$PORT/scripts/og-home.html" >/dev/null 2>&1
sips -s format jpeg -s formatOptions 88 assets/og/home.png --out assets/og/home.jpg >/dev/null && rm assets/og/home.png
echo "wrote assets/og/home.jpg ($(du -h assets/og/home.jpg | cut -f1))"
