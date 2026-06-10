# Card Contract

`common/config/card_contract.json` is the source of truth for card type metadata.
It keeps the web setup page and firmware aligned.

## What the Contract Defines

Each card entry can define:

- `label` - display label used by the setup page.
- `allowInSubpage` - whether the card can be used inside a subpage.
- `domains` - allowed Home Assistant entity domains.
- `options` - typed settings stored in the compact `options` field.
- `default` - default saved config for a new card.
- aliases or picker metadata where supported by the schema.

Generated consumers include:

- `src/webserver/modules/card_contract_generated.js`
- `components/espcontrol/button_grid_contract_generated.h`
- `docs/generated/cards/capabilities.md`

## Saved Button Config

The setup page stores button configuration in ESPHome text entities, usually
named `Button N Config`. Firmware reads those strings and parses them into
`ParsedCfg` in `components/espcontrol/button_grid_config.h`.

The web-side equivalent lives in `src/webserver/modules/config_codec.js`.

When saved config changes, update both sides and keep old config readable when
possible.

## Option Persistence

Several places intentionally clear unknown `options` to prevent stale settings
from leaking across card types. If a card uses `options`, make sure it is
preserved in all relevant places:

- `src/webserver/modules/config_codec.js`
  - normalization while editing
  - serialization before writing back to the device
- `components/espcontrol/button_grid_config.h`
  - firmware parsing after the compact string is read

If an option appears to save in the setup page but disappears after reload, one
of these preservation points is usually missing.

## Contract Change Checklist

After editing `common/config/card_contract.json`:

```bash
python3 scripts/build.py
npm run check:card-contract-outputs
npm run check:model-contract
npm run check:backup-contract
npm run check:product
```

Expected generated files commonly include:

- `src/webserver/modules/card_contract_generated.js`
- `components/espcontrol/button_grid_contract_generated.h`
- `docs/generated/cards/capabilities.md`
- `docs/public/webserver/*/www.js`

## Compatibility Notes

Treat saved card config as durable user data.

- Do not rename card types without an alias or migration path.
- Do not remove an option parser before existing values have a fallback.
- Keep backup import/export working for older backups.
- Add fixtures in `compatibility/fixtures/product_compatibility.json` when the
  saved shape changes.

## Where Card Logic Lives

| Concern | Typical path |
|---|---|
| Type metadata and defaults | `common/config/card_contract.json` |
| Web settings and preview | `src/webserver/types/<type>.js` |
| Web parsing/serialization | `src/webserver/modules/config_codec.js` |
| Firmware parsing | `components/espcontrol/button_grid_config.h` |
| Firmware rendering/runtime | `components/espcontrol/button_grid_<type>.h` |
| Grid setup/runtime wiring | `components/espcontrol/button_grid_grid.h` |
| Shared generated constants | `button_grid_contract_generated.h` and `card_contract_generated.js` |
