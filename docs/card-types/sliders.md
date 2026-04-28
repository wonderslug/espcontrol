---
title: Slider
description:
  How to use slider cards on your Espcontrol panel to control light brightness and fan speed from Home Assistant.
---

# Slider

A slider card lets you control the brightness of a Home Assistant light entity or the speed of a Home Assistant fan entity by dragging a fill bar up or down (or left to right).

<!-- ![Slider card showing a lightbulb icon with a brightness fill bar](/images/card-slider.png) -->

## Setting Up a Slider

1. Select a card and change its type to **Slider**.
2. Enter an **Entity ID** — the Home Assistant light or fan entity you want to control (for example, `light.living_room` or `fan.office_fan`).
3. Choose an **Off Icon** and **On Icon**. Existing sliders that only had one icon keep using that same icon for both states unless you change it.
4. Set a **Label** (optional) — shown at the bottom of the card. If left blank, the entity's friendly name from Home Assistant is used.
5. Pick a **Direction** — **Vertical** (default) or **Horizontal**.

## How It Works on the Panel

- **Drag** the slider to set the brightness or fan speed from 0 to 100 percent. Releasing the slider sends the new value to Home Assistant.
- For lights, the slider uses Home Assistant's brightness control.
- For fans, the slider uses Home Assistant's percentage speed control.
- A coloured **fill bar** shows the current level in real time — it rises from the bottom in vertical mode or extends from the left in horizontal mode.
- When the light or fan changes externally (from Home Assistant or another control), the fill bar updates automatically to reflect the current level.

## Direction

You can orient the slider in two directions:

- **Vertical** (default) — the fill bar grows upward from the bottom of the card.
- **Horizontal** — the fill bar grows from left to right.

Choose the direction that best fits your grid layout. **Tall** cards work well with vertical sliders, while **Wide** cards suit horizontal sliders.

## On and Off Icons

Slider cards always have separate **Off Icon** and **On Icon** fields. Use the same icon in both fields if you do not want the icon to change while the light or fan is on.
