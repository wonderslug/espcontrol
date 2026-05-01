---
title: Climate
description:
  How to control a Home Assistant climate entity from an EspControl thermostat card.
---

# Climate

::: warning Experimental
Climate cards are still experimental. They are not shown in release setup pages or public navigation yet. Developers can enable them from the setup page with `?experimental=climate`, or by running `localStorage.setItem("espcontrol.experimental.climate", "1"); location.reload();` in the browser console.
:::

A Climate card controls a Home Assistant `climate` entity, such as a thermostat, heat pump, radiator valve, or air conditioner.

On the main screen it shows the target temperature. Tapping the card opens a thermostat control page with a target temperature arc, plus and minus buttons, a mode menu, and optional fan and swing controls.

## Setting Up a Climate Card

1. Select a card and change its type to **Climate**.
2. Enter a **Climate Entity**, for example `climate.living_room`.
3. Set a **Label** if you want custom text on the dashboard card. If left blank, the card uses the Home Assistant name when it is available.
4. Set **Unit Precision** if you want decimal places. The default is whole numbers.

Climate cards can also be placed inside a [Subpage](/features/subpages).

## How It Works on the Panel

- The dashboard card shows the target temperature.
- The card label changes to the active action, such as **Heating**, **Cooling**, **Drying**, or **Fan**, while Home Assistant reports that action.
- The card uses the normal on colour only while `hvac_action` is active, such as `heating`, `cooling`, `drying`, or `fan`. If Home Assistant reports `hvac_action` as `idle`, the card uses the off colour even when the mode is not **Off**.
- The thermostat page appears as a large control card with a Back button in the top-left corner.
- The top-right menu shows the climate modes reported by Home Assistant, such as **Heat**, **Cool**, **Auto**, or **Off**.
- The detail page uses `min_temp`, `max_temp`, and `target_temp_step` when Home Assistant provides them. Until those arrive, it uses 5-35 °C/°F with 0.5° steps.
- The displayed unit comes from the panel's **Temperature Unit** setting.
- The displayed temperature precision comes from the card's **Unit Precision** setting. Whole numbers are used by default.
- Dragging the arc updates the display immediately, but sends the new temperature only when you release it. The plus and minus buttons wait briefly before sending, so repeated taps do not spam Home Assistant.

## Supported Controls

The detail page only shows controls that the climate entity supports:

| Home Assistant attribute | Control shown |
|---|---|
| `hvac_modes` | Top-right mode menu |
| `fan_modes` | Fan selector |
| `swing_modes` | Swing selector |

## Heat/Cool Mode

For climate entities using `heat_cool`, the detail page supports separate low and high targets.

When both `target_temp_low` and `target_temp_high` exist, the page shows **Low** and **High** buttons. Pick which target you want to edit, then use the arc or plus/minus buttons. The panel keeps the low target below the high target by at least one temperature step and sends both values with `climate.set_temperature`.
