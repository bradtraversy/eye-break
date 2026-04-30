#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/Code/eye-break}"
ICON="$APP_DIR/build/icon.png"
DESKTOP_FILE="$HOME/.local/share/applications/eyebreak.desktop"
DESKTOP_COPY="$HOME/Desktop/EyeBreak.desktop"

shopt -s nullglob
appimages=("$APP_DIR"/dist/EyeBreak-*.AppImage)
shopt -u nullglob

if [[ ${#appimages[@]} -eq 0 ]]; then
  echo "Missing AppImage in: $APP_DIR/dist" >&2
  echo "Run: npm run package:linux" >&2
  exit 1
fi

APPIMAGE="${appimages[0]}"
mkdir -p "$HOME/.local/share/applications" "$HOME/Desktop"
chmod +x "$APPIMAGE"

cat > "$DESKTOP_FILE" <<DESKTOP
[Desktop Entry]
Type=Application
Name=EyeBreak
Comment=20-20-20 eye break reminder
Exec=$APPIMAGE --no-sandbox
Icon=$ICON
Terminal=false
Categories=Utility;Health;
StartupWMClass=EyeBreak
DESKTOP

chmod +x "$DESKTOP_FILE"
cp "$DESKTOP_FILE" "$DESKTOP_COPY"
chmod +x "$DESKTOP_COPY"
gio set "$DESKTOP_COPY" metadata::trusted true 2>/dev/null || true
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

echo "Installed launcher: $DESKTOP_COPY"
echo "Installed app menu entry: $DESKTOP_FILE"
echo "AppImage: $APPIMAGE"
