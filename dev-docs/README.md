# EspControl Developer Reference

These notes are for maintainers working inside this repository. They are kept
outside `docs/` so they are not built into the public VitePress documentation
site.

For end-user install and usage instructions, use `README.md` and the public
documentation under `docs/`. For the longer contributor walkthrough, use
`DEVELOPERS.md`.

## Fast Orientation

- Product metadata starts in `devices/manifest.json`.
- Card behavior starts in `common/config/card_contract.json`.
- Shared Home Assistant entity names start in `common/config/entity_names.json`.
- Web setup code lives under `src/webserver/`.
- Firmware UI code lives mostly in `components/espcontrol/*.h`.
- Device entry points live under `devices/<device-slug>/`.
- Generated public web bundles are written to `docs/public/webserver/<slug>/www.js`.
- Generated public docs are written under `docs/generated/`.

## Reference Map

- [Architecture](architecture.md) - how firmware, the web setup page, generated
  files, and device profiles fit together.
- [Change Workflows](change-workflows.md) - common edits and the files/checks
  they usually require.
- [Card Contract](card-contract.md) - how card metadata moves from JSON into the
  web UI and firmware.
- [Web Configurator](web-configurator.md) - structure of the browser setup page
  served by the device.
- [Firmware](firmware.md) - the on-device LVGL grid, card runtime, modals, fonts,
  and parser notes.
- [Devices and Builds](devices-and-builds.md) - device profiles, generated
  package files, firmware bundles, and release-facing outputs.
- [Checks and Releases](checks-and-releases.md) - local verification commands and
  release-sensitive files.

## Keep This Folder Internal

The public docs site is built with:

```bash
npm run docs:build
```

That script runs `vitepress build docs`, so only Markdown under `docs/` is treated
as site content. Keep this folder at the repository root unless there is an
intentional decision to publish it.

## Editing Rules

- Prefer source files over generated files. If a file says it is generated, find
  the generator and update its input.
- After changing contract, device, entity, icon, or model inputs, run the
  relevant generator and commit the regenerated output.
- Keep developer notes factual and repo-specific. Do not duplicate user-facing
  instructions from the public docs unless the developer context changes the
  action.
