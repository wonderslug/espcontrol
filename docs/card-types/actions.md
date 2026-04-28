---
title: Action
description:
  How to use action cards on your Espcontrol panel to run Home Assistant scenes, scripts, buttons, and helpers.
---

# Action

An Action card is a simple one-tap shortcut. It sends a selected Home Assistant action when you tap it, but it does not show an on/off state.

Use Action cards for shortcuts such as running a scene, starting a script, pressing a Home Assistant button entity, or changing a helper.

## Setting Up an Action Card

1. Select a card and change its type to **Action**.
2. Set a **Label** - this is the text shown on the card.
3. Choose an **Action**.
4. Enter the **Entity ID** for the thing you want the action to use.
5. If you choose **Set Number Helper** or **Select Option Helper**, enter the value or option.
6. Choose an **Icon**.

## Supported Actions

| Action | Example entity | Extra field |
|---|---|---|
| **Run Scene** | `scene.movie_mode` | None |
| **Run Script** | `script.goodnight` | None |
| **Press Button** | `button.restart_router` | None |
| **Press Input Button** | `input_button.doorbell` | None |
| **Toggle Helper** | `input_boolean.guest_mode` | None |
| **Turn Helper On** | `input_boolean.guest_mode` | None |
| **Turn Helper Off** | `input_boolean.guest_mode` | None |
| **Set Number Helper** | `input_number.target_level` | Value |
| **Select Option Helper** | `input_select.house_mode` | Option |

## How It Works on the Panel

When you tap an Action card:

- The card briefly flashes the highlight colour.
- The selected Home Assistant action is sent with the configured entity.
- The card does not stay highlighted, because Action cards are stateless shortcuts.

## When to Use a Scene or Script

If you want a shortcut that does several things, create a scene or script in Home Assistant first, then point the Action card at that scene or script. This keeps the panel setup simple and makes the behaviour easier to test inside Home Assistant.

Use the dedicated card types for richer controls:

- Use [Cover](/card-types/covers) for blinds, shutters, and covers.
- Use [Switch](/card-types/switches) or [Slider](/card-types/sliders) for lights.
- Media and climate controls are not part of Action cards.

::: info Requires Home Assistant actions
Action cards send Home Assistant actions from the panel. If tapping a card does nothing, check [Home Assistant Actions](/getting-started/home-assistant-actions).
:::
