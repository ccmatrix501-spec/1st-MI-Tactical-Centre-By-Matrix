# 1st M.I. Tactical Centre — Web Project (v1.4.8)

Full source project built from the desktop App.tsx.

## Setup

```bash
npm install
```

## Add your assets

Copy your full asset folders into `public/assets/`:

- `public/assets/maps/`          (valaka-plateau.png, boreas-*.png, agni-prime.png, x-11.png)
- `public/assets/markers/`
- `public/assets/mi3d/`          (structures + zone-assets GLBs)
- `public/assets/bugholes/`
- `public/assets/restriction-maps/`
- `public/assets/training-material/`
- `public/assets/companies/`     (already partially included)
- `public/assets/icon.png`
- `public/assets/certificate-icon.png`

Also put `icon.png` and `certificate-icon.png` in `src/assets/` (required by imports).

## Dev

```bash
npm run dev
```

## Build for hosting (GitHub Pages / static)

```bash
npm run build
```

Output is in `dist/`. Upload the entire `dist/` folder.

## Notes

- `base: "./"` is set so relative paths work on GitHub Pages.
- Desktop-only features (overlay, native save folder scanner, global keybinds) stay gated behind `window.steApi` / `window.steOverlay` and will not run in pure web.
- Specialisation + requirements popup wording matches this App.tsx.
