# Tactical Centre Content Updates

Public update feed used by the Windows Tactical Centre.

## Live manifest

`https://tactical.1stmid.com/updates/manifest.json`

The Windows app checks this feed on startup, when the PC comes back online, and every 5 minutes while the app is running.

## Files

- `manifest.json` — current content revision and file locations.
- `data/live-edit.json` — certification/live editor overrides.
- `data/awards.json` — Merits & Awards catalog overrides.
- `data/maps.json` — remote map list.
- `maps/` — place downloadable map images here.

## Publish a new content update

1. Change the required JSON file(s) and/or upload map image(s).
2. Increase `revision` in `manifest.json`.
3. Update `updatedAt` in `manifest.json`.
4. Commit to `main`.
5. Wait for the Tactical Centre site/GitHub Pages deployment to finish.

If the revision is not increased, clients that already downloaded the current revision will not pull the new content.

## Remote map example

Upload:

`updates/maps/hllv/example-map.png`

Then add this to `updates/data/maps.json`:

```json
{
  "schemaVersion": 1,
  "maps": [
    {
      "id": "hllv-example-map",
      "name": "Example Map",
      "appVersion": "NON_STE",
      "game": "HLL:V",
      "url": "https://tactical.1stmid.com/updates/maps/hllv/example-map.png",
      "sha256": ""
    }
  ]
}
```

For STE maps use:

```json
{
  "id": "ste-example-map",
  "name": "Example Map",
  "appVersion": "STE",
  "game": "STE",
  "url": "https://tactical.1stmid.com/updates/maps/ste/example-map.png",
  "sha256": ""
}
```

SHA-256 is optional. If supplied, the Windows app verifies the downloaded image before installing it.

## Important

Version 1.3.21 is the first desktop build wired to this update feed. Existing Store builds must receive 1.3.21 (or newer) once. After that, normal certification, award, and map content changes can be delivered through this feed without another Store package.
