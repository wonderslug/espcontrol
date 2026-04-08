---
title: Buttons & Icons
description:
  How to set up buttons on your Espcontrol panel — choosing devices, picking icons, using Auto mode, subpages, double-height buttons, and sensor readouts.
---

# Buttons & Icons

Your panel has a grid of button spaces — **20** on the 7-inch, **15** on the 4.3-inch, or **9** on the 4-inch. Each space can hold a **Toggle** button that turns a device on and off, or a **Subpage** button that opens a new page of extra buttons.

## Setting up a button

From the [Web UI](/web-ui) **Screen** tab:

1. **Tap an empty space** in the grid to add a new button.
2. **Choose a type** — **Toggle** (the default) to control a device, or **Subpage** to create a page of extra buttons.
3. **Pick the device** you want to control by entering its name from Home Assistant (for example, `light.living_room` or `switch.garden_lights`). You can find these names in Home Assistant under **Settings > Devices & Services**. Subpage buttons don't need a device name.
4. **Choose an icon** — type to search, or select **Auto** to let the panel pick one for you (see below).
5. **Set a label** (optional). If you leave it blank, the button uses the device's name from Home Assistant.

## Button types

### Toggle

The default type. A toggle button is connected to a device in Home Assistant — tap it on the panel to switch the device on or off. The button changes colour to show whether the device is currently on or off.

### Subpage

A subpage button works like a folder — tapping it on the panel opens a new page with its own set of buttons. This is great for grouping related controls together (for example, all the lights in one room) without filling up the home screen.

The subpage has one fewer button space than the home screen, because the first space is used for a **Back** button that takes you back.

To set up a subpage:

1. Select a button and change its type to **Subpage**.
2. Click **Configure Subpage**, or right-click the button and choose **Setup Subpage**.
3. The preview switches to the subpage. Add and arrange buttons here the same way you would on the home screen.
4. Click the back arrow to return to the home screen.

Subpage buttons show a small **arrow badge** on the home screen so you can spot them easily.

## Double-height buttons

You can make any button **twice as tall**, spanning two rows instead of one. Right-click the button and choose **Double Height**. This can make important buttons easier to find and tap.

To change it back, right-click and choose **Single Height**. If there's already a button in the space below, it gets moved to the next available space automatically.

## Shared button settings

These settings apply to all buttons on the panel:

- **On colour** — the colour a button shows when its device is switched on. Default: orange.
- **Off colour** — the colour a button shows when its device is switched off. Default: dark grey.
- **Button order** — you can drag and drop buttons to rearrange them. If you drop a button onto a space that's already taken, the existing button shifts to the next available space.

## Auto icons

When you set a button's icon to **Auto**, the panel picks an appropriate icon based on what kind of device it controls:

| Device type | Icon shown |
| --- | --- |
| Light | Lightbulb |
| Switch | Power plug |
| Fan | Fan |
| Lock | Lock |
| Cover (blinds, shutters) | Horizontal blinds |
| Climate (heating, AC) | Air conditioner |
| Media player | Speaker |
| Camera | Camera |
| Binary sensor (motion, door) | Motion sensor |
| Anything else | Gear |

If you'd rather pick a specific icon, the dropdown offers hundreds of choices covering lighting, climate, security, weather, media, and more. Type to search by name. Browse the full list on the [Icon Reference](/icons) page.

## When Entity On

Each toggle button has an optional **When Entity On** setting that changes what the button shows while the device is switched on. Turn it on and choose one of two options:

### Replace Icon

Show a different icon when the device is on. For example, you could show an outline lightbulb when the light is off and a filled lightbulb when it's on.

### Sensor Data

Show a live reading on the button when the device is on — for example, a temperature, power usage, or completion percentage.

- **Sensor** — choose which sensor from Home Assistant to display (for example, `sensor.printer_percent_complete`).
- **Unit** — the unit to show alongside the value (for example, `%`, `°C`, or `W`).

When the device is off, the button goes back to showing its normal icon.

## Missing an icon?

If the icon you need isn't in the list, [open an issue](https://github.com/jtenniswood/espcontrol/issues) with the icon name and what you'd use it for, and we'll look into adding it.
