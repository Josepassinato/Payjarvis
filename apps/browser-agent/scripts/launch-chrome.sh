#!/bin/bash
# Launch Chrome with anti-detection flags for OpenClaw browser agent
# Replaces the default headless Chrome launch that gets detected by Amazon

# Kill existing Chrome instances on port 18800
EXISTING_PID=$(pgrep -f "remote-debugging-port=18800")
if [ -n "$EXISTING_PID" ]; then
  echo "[Chrome] Killing existing Chrome on port 18800 (PID: $EXISTING_PID)"
  kill $EXISTING_PID 2>/dev/null
  sleep 2
  # Force kill if still running
  kill -9 $EXISTING_PID 2>/dev/null
  sleep 1
fi

CHROME_BIN="/opt/google/chrome/chrome"
DATA_DIR="/root/.chrome-payjarvis"

# Randomize viewport
VIEWPORTS=("1920,1080" "1366,768" "1440,900" "1536,864")
VIEWPORT=${VIEWPORTS[$RANDOM % ${#VIEWPORTS[@]}]}

echo "[Chrome] Launching with viewport $VIEWPORT"

# Anti-detection flags:
# --headless=new          — required for headless, but stealth script handles navigator.webdriver
# --disable-blink-features=AutomationControlled — KEY: removes "Chrome is being controlled" banner
# --no-sandbox            — required for root
# --disable-dev-shm-usage — required for low-memory containers
# --disable-infobars      — removes info bars
# --disable-extensions    — no extensions = cleaner fingerprint
# --window-size           — realistic viewport (not 800x600!)
# --lang=pt-BR            — Brazilian Portuguese
# --user-data-dir         — persistent profile for cookies/sessions
#
# REMOVED (were causing detection):
# --ozone-platform=headless  (detectable via feature detection)
# --use-angle=swiftshader-webgl  (detectable via WebGL renderer string)
# --disable-gpu  (causes different rendering behavior)
# --ozone-override-screen-size=800,600  (tiny viewport = bot)

$CHROME_BIN \
  --headless=new \
  --remote-debugging-port=18800 \
  --no-sandbox \
  --disable-dev-shm-usage \
  --disable-blink-features=AutomationControlled \
  --disable-infobars \
  --disable-extensions \
  --disable-component-extensions-with-background-pages \
  --disable-default-apps \
  --disable-background-networking \
  --disable-sync \
  --disable-translate \
  --hide-scrollbars \
  --metrics-recording-only \
  --mute-audio \
  --no-first-run \
  --safebrowsing-disable-auto-update \
  --window-size=$VIEWPORT \
  --lang=pt-BR \
  --user-data-dir=$DATA_DIR \
  --noerrdialogs \
  &

CHROME_PID=$!
echo "[Chrome] Started with PID $CHROME_PID on port 18800"
echo "[Chrome] Anti-detection flags: --disable-blink-features=AutomationControlled, realistic viewport"
echo "[Chrome] Data dir: $DATA_DIR (persistent cookies/sessions)"

# Wait for Chrome to be ready
for i in $(seq 1 20); do
  if curl -s http://localhost:18800/json/version > /dev/null 2>&1; then
    echo "[Chrome] Ready! CDP accessible on port 18800"
    exit 0
  fi
  sleep 0.5
done

echo "[Chrome] WARNING: Chrome started but CDP not responding after 10s"
