# Snakes & Ladders 3D — PWA

This repo contains a small Snakes & Ladders 3D web game with PWA support.

## PWA checklist

- `manifest.json` is present with `name`, `short_name`, `start_url`, `display`, `theme_color`, and `icons` (192/512).
- `sw.js` is registered in `game.js` and caches core assets.
- Icons are in `icons/` and referenced in `manifest.json` and `index.html`.
- Service worker file is at site root so its scope covers the app.

