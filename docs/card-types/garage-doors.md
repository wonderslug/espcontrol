---
title: Garage Door
description:
  How to use garage door cards on your EspControl panel to open and close Home Assistant cover entities.
---

# Garage Door

A garage door card controls a Home Assistant `cover` entity as a simple open/close toggle.

Unlike a **Cover** card, it does not show a slider. It normally shows your label, then briefly swaps that label for the live door state when the state changes.

## Setting Up a Garage Door

1. Select a card and change its type to **Garage Door**.
2. Enter an **Entity ID** — the Home Assistant garage door cover entity, for example `cover.garage_door`.
3. Choose the closed and open icons. These default to **Garage** and **Garage Open**.
4. Set a **Label** (optional). If left blank, the entity's friendly name from Home Assistant is used.

## How It Works on the Panel

- Tapping the card sends a toggle action to Home Assistant.
- The card lights up while the door is open, opening, or closing.
- When the door state changes, the label temporarily shows the Home Assistant state, such as **Open**, **Closed**, **Opening**, or **Closing**.
- After the state has stayed the same for about 3 seconds, the card changes back to showing the configured label.
- The icon uses the closed **Garage** icon when the state is closed or closing, and the open icon when the state is open or opening.
