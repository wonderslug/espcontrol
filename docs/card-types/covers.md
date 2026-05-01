---
title: Cover
description:
  How to use cover cards on your EspControl panel to control blinds, shutters, and other cover entities from Home Assistant.
---

# Cover

A cover card lets you control a Home Assistant cover entity — blinds, shutters, roller shades, gates, or garage doors — as either a position slider or a simple toggle.

<!-- ![Cover card showing a blinds icon with a position fill bar](/images/card-cover.png) -->

## Setting Up a Cover

1. Select a card and change its type to **Cover**.
2. Choose the interaction:
   - **Slider** lets you drag to a precise cover position.
   - **Toggle** opens or closes the cover with a tap.
3. If you choose **Slider**, choose the **Slider Function**:
   - **Position** uses Home Assistant's `cover.set_cover_position` action.
   - **Tilt** uses Home Assistant's `cover.set_cover_tilt_position` action.
   - Your Home Assistant cover entity needs to support tilt for **Tilt** mode to work.
4. Set a **Label** (optional) — shown at the bottom of the card. If left blank, the entity's friendly name from Home Assistant is used.
5. Enter an **Entity ID** — the Home Assistant cover entity you want to control (for example, `cover.office_blind`).
6. Choose a **Closed Icon** (defaults to **Blinds**).
7. Choose an **Open Icon** (defaults to **Blinds Open**).

## How It Works on the Panel

### Slider Interaction

- **Drag** the slider to set the selected cover value from 0 to 100.
- In **Position** mode, releasing the slider sends the new position to Home Assistant via `cover.set_cover_position`.
- In **Tilt** mode, releasing the slider sends the new tilt value to Home Assistant via `cover.set_cover_tilt_position`.
- The **fill bar** is always vertical and represents how much the cover is closed — a fully closed cover shows a full bar, and a fully open cover shows an empty bar. This inverted fill matches blinds or shutters blocking a window.
- The fill bar updates in real time as the cover moves, tracking `current_position` in **Position** mode and `current_tilt_position` in **Tilt** mode.

### Toggle Interaction

- **Tap** the card to toggle the cover through Home Assistant.
- The card lights up while the cover is closed or closing.
- When the cover state changes, the label temporarily shows the Home Assistant state, such as **Open**, **Closed**, **Opening**, or **Closing**.
- After the state settles, the card changes back to showing the configured label.

## Cover Icons

Cover cards always use two icons: one for the closed state and one for the open or partially open state.
