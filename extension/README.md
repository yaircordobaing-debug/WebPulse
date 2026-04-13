# WebPulse Guardian - Extension Installation

This folder contains the source code for the **WebPulse Guardian** browser extension.

## How to install in Chrome / Edge:

1.  Open your browser and navigate to `chrome://extensions` (or `edge://extensions`).
2.  Enable **"Developer mode"** (usually a toggle in the top right).
3.  Click on **"Load unpacked"**.
4.  Select the `extension` folder from this project.
5.  The extension icon should appear in your toolbar.

## Project Structure:

- `manifest.json`: Extension configuration (Manifest V3).
- `background.js`: Service worker handling the Anomaly Engine and notifications.
- `content.js`: Script injected into pages to collect performance and security metrics.
- `popup.html/js/css`: The dashboard UI that appears when you click the extension icon.

## Note on Icons:
The extension expects icons in the `icons/` folder (`icon16.png`, `icon48.png`, `icon128.png`). You can use any PNG images or convert the SVG logo from the landing page to PNGs for a consistent look.
