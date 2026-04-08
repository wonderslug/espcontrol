---
title: Display & Screensaver
description:
  How to configure the temperature display, screensaver modes, and presence sensor wake on your Espcontrol panel.
---

# Display & Screensaver

These settings control what the panel shows on screen and how it behaves when you're not using it. You'll find all of these in the **Settings** tab on the [Web UI](/web-ui).

## Temperature display

The top bar of your panel can show indoor and outdoor temperatures from any temperature sensor in Home Assistant.

- **Indoor temperature** — turn it on, then choose which sensor to use (for example, a room thermometer).
- **Outdoor temperature** — works the same way. Use a weather sensor or outdoor thermometer.

When both are turned on, the top bar shows two temperatures side by side. When only one is turned on, it shows a single value.

## Screensaver

To save power and protect the display, the panel activates a screensaver when it's not being used. The screen shows a gentle snow animation and the backlight turns off. Touch the screen to wake it up.

There are two ways to control the screensaver, and you can switch between them in the Settings tab:

### Timer

The screensaver turns on after the panel hasn't been touched for a set amount of time. Choose from:

- **5 minutes** (the default)
- 10, 15, 20, 30, or 45 minutes
- 1 hour

### Sensor

Instead of a timer, the screensaver is controlled by a motion or presence sensor (like a mmWave sensor mounted nearby). When someone is in the room, the screen stays on. When nobody is detected, the screen goes to sleep — and wakes up again when someone walks past.

To use this, enter the name of your motion or presence sensor from Home Assistant (for example, `binary_sensor.hallway_presence`).

::: tip
Touching the screen always wakes it up, no matter which mode you're using.
:::

## Related

- [Backlight Schedule](/backlight-schedule) — automatic day and night brightness
- [Web UI](/web-ui) — full guide to all the settings
