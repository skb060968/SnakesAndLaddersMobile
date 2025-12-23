# Snakes & Ladders 3D — PWA

This repo contains a small Snakes & Ladders web game with PWA support.

## PWA checklist

- `manifest.json` is present with `name`, `short_name`, `start_url`, `display`, `theme_color`, and `icons` (192/512).
- `sw.js` is registered in `game.js` and caches core assets.
- Icons are in `icons/` and referenced in `manifest.json` and `index.html`.
- Service worker file is at site root so its scope covers the app.

## Deployment notes

- Serve the app over HTTPS (GitHub Pages, Netlify, Vercel, or other hosts provide HTTPS by default).
- If using GitHub Pages, set `source` branch in repository settings and enable Pages.
- Verify `manifest.json` and `icons` are reachable at the published URL.

## Converting SVG frames to PNG (optional)

The repository includes `images/frame-*.svg` (transparent centers). To produce PNG fallbacks locally:

1. Install dependencies:

```bash
npm install
```

2. Run the convert script:

```bash
npm run convert-frames
```

This generates `images/frame-wood.png` and `images/frame-ornate.png`.

## Local testing

- Use Live Server or a simple HTTP server. Example with Python:

```bash
# Python 3
python -m http.server 8000
# or use a Node static server like `serve`
npx serve . -p 8000
```

- Open `http://localhost:8000` and verify the site loads, service worker installs (check DevTools > Application > Service Workers), and the app can be added to home screen.

## Notes & Recommendations

- `sw.js` uses a cache-first strategy for static assets. You may want to implement a more robust runtime caching strategy for external resources.
- The install step will attempt to cache all assets; if any required file is missing the script now falls back to adding each asset individually rather than failing the install.
- Consider adding a small offline fallback page if desired.
