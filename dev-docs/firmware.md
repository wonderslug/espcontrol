# Firmware

Most EspControl firmware behavior is implemented as ESPHome components and
header-only C++ under `components/espcontrol/`.

## Important Files

| Path | Purpose |
|---|---|
| `components/espcontrol/button_grid.h` | Umbrella include for grid/card code. |
| `components/espcontrol/button_grid_grid.h` | Main grid creation, card setup, runtime wiring, and subpage wiring. |
| `components/espcontrol/button_grid_config.h` | Compact saved config parser and normalized `ParsedCfg`. |
| `components/espcontrol/button_grid_<type>.h` | Card-specific rendering and runtime behavior. |
| `components/espcontrol/button_grid_modal.h` | Shared modal shell behavior. |
| `components/espcontrol/button_grid_subpages.h` | Subpage support. |
| `components/espcontrol/icons.h` | Icon lookup. |
| `components/espcontrol/i18n_generated.h` | Generated translation strings. |

## Runtime Model

1. ESPHome YAML creates LVGL objects and exposes text/select/number/switch
   entities.
2. The grid code reads saved button config from text entities.
3. `parse_cfg` normalizes the saved compact string into `ParsedCfg`.
4. Visual setup creates the card face.
5. Runtime wiring subscribes to Home Assistant state where needed and attaches
   tap/hold handlers.
6. Some cards open a shared full-screen modal.

Visual setup and runtime wiring are separate. A new card often needs both.

## Adding Firmware Support for a Card

1. Create `components/espcontrol/button_grid_<type>.h`.
2. Include it in `components/espcontrol/button_grid.h`.
3. Add visual setup in `components/espcontrol/button_grid_grid.h`.
4. Add runtime/subscription behavior in `button_grid_grid.h` if the card reacts
   to Home Assistant state or user taps.
5. Update `components/espcontrol/button_grid_config.h` if the saved config or
   options need parser support.
6. Add modal enum/context behavior when the card opens a modal.

Use an existing card with similar behavior as the template:

- Static display card: sensor-like or time-like cards.
- Toggle/action card: switch/action cards.
- Rich modal card: media, climate, or light cards.
- Image loading card: camera or media cover-art behavior.

## Fonts and Glyphs

Firmware fonts only contain the glyphs declared in YAML. Missing glyphs render
as boxes.

- Device font definitions: `devices/<slug>/device/fonts.yaml`
- Shared glyph sets: `common/assets/*glyphs.yaml`
- Icon registry: `common/assets/icons.json`
- Icon lookup in firmware: `components/espcontrol/icons.h`

Use font role substitutions from device profiles instead of hardcoding one
device's physical font id in card logic.

## Home Assistant Bindings

Cards that reflect Home Assistant state must subscribe to the entity or
attribute they need. Keep subscriptions narrow because display memory and update
work are limited.

Useful checks:

```bash
npm run check:firmware-ha-bindings
npm run check:firmware-card-runtime
```

## Config Parser Rules

`button_grid_config.h` should accept existing saved values after an upgrade. Be
careful with:

- renamed card types
- renamed option keys
- new required fields
- default values that change behavior
- clearing unknown options

When parser behavior changes, update compatibility fixtures and run:

```bash
npm run check:firmware-parser
npm run check:backup-contract
npm run check:product
```

## ESPHome Entry Points

Each device has:

- `devices/<slug>/esphome.yaml` - production entry, pulls remote packages.
- `devices/<slug>/dev.yaml` - local development entry, points components at the
  working tree.
- `devices/<slug>/packages.yaml` - package and substitution manifest.

For local firmware work, build from `dev.yaml`.
