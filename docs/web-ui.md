---
title: Web UI
description:
  How to use the built-in web page to configure buttons, display settings, screensaver, and brightness on your Espcontrol panel.
---

# Web UI

Your Espcontrol panel has a built-in web page where you can set everything up. Open it by typing the panel's address into any browser on your phone or computer — for example, `http://192.168.1.42`.

::: tip Finding the address
The address is shown on the display screen when no buttons are configured yet. You can also find it in your router's connected devices list, or in Home Assistant under **Settings > Devices & Services > ESPHome**.
:::

## Screen tab

This is where you set up your buttons. You'll see a **live preview** of your panel — the top bar with the clock and temperatures, and the button grid below it.

### Adding and removing buttons

- **Add a button** — tap any empty space in the grid (shown as a dashed outline with a **+** icon). This opens the button settings where you can choose what it controls.
- **Remove a button** — right-click the button and choose **Delete**.

### Selecting buttons

- **Tap** a button to select it. Its settings appear below the preview.
- **Shift+click** to select a range of buttons at once.
- **Ctrl+click** (or Cmd+click on Mac) to pick and choose individual buttons.

When you've selected more than one button, right-click to cut or delete them all at once.

### Moving buttons

Drag and drop any button to move it to a new position. If you drop it onto a space that's already taken, the existing button shifts to the next available space.

### Right-click menu

Right-click a button to see these options:

| Option | What it does |
| --- | --- |
| **Setup Subpage** | Opens the subpage editor (only appears on Subpage buttons) |
| **Double Height** / **Single Height** | Makes the button tall (spans two rows) or reverts to normal |
| **Duplicate** | Creates a copy of the button in the next available space |
| **Cut** | Removes the button and saves it so you can paste it elsewhere |
| **Delete** | Removes the button permanently |

Right-click an **empty space** to see a **Paste** option if you've previously cut a button.

### Cut and paste

You can move buttons around by cutting and pasting. Right-click a button, choose **Cut**, then right-click an empty space and choose **Paste**. This also works between the home screen and subpages — you can cut a button from one and paste it into the other.

### Button settings

When you tap a button to select it, a settings panel appears below the preview:

- **Type** — choose **Toggle** (the default — turns a device on and off) or **Subpage** (opens a page of more buttons). See [Buttons & Icons](/buttons-and-icons#button-types) for more.
- **Label** — a custom name for the button. Leave it blank to use the device's name from Home Assistant.
- **Entity** — which Home Assistant device the button controls (for example, `light.living_room`). You can find this in Home Assistant under **Settings > Devices & Services**. Only shown for Toggle buttons.
- **Icon** — pick from hundreds of icons, or choose **Auto** to let the panel pick one based on the device type (lights get a lightbulb, fans get a fan, and so on).
- **When Entity On** — an optional setting with two choices:
  - **Replace Icon** — show a different icon when the device is switched on.
  - **Sensor Data** — show a live reading on the button when the device is on (for example, a temperature or power usage). Enter the sensor name and the unit to display (like `°C` or `%`).
- **Configure Subpage** — opens the subpage editor. Only shown for Subpage buttons.

### Subpages

A **Subpage** button works like a folder — tapping it on the panel opens a new page of buttons. This is handy for grouping related controls together (for example, all the lights in one room) without cluttering the home screen.

Each subpage has its own set of button spaces, one fewer than the home screen (because the first space is used for a **Back** button that returns you to the home screen).

To set up a subpage:

1. Select a button and change its type to **Subpage**.
2. Click **Configure Subpage**, or right-click the button and choose **Setup Subpage**.
3. The preview switches to the subpage. Set up buttons here the same way you would on the home screen.
4. Click the back arrow to return to the home screen.

Subpage buttons show a small **arrow badge** on the home screen so you can tell them apart from regular buttons.

### Double-height buttons

You can make any button **twice as tall**, spanning two rows instead of one. Right-click the button and choose **Double Height**. To change it back, right-click and choose **Single Height**.

If there's already a button in the space below, it gets moved to the next available space automatically.

## Settings tab

This tab lets you adjust how your panel looks and behaves. Each section can be expanded or collapsed by tapping its heading.

### Appearance

- **On colour** — the colour buttons show when a device is switched on. Use the colour picker or type a colour code (for example, `FF8C00` for orange).
- **Off colour** — the colour buttons show when a device is switched off.

### Brightness

- **Daytime brightness** — how bright the screen is during the day (10%–100%).
- **Nighttime brightness** — how bright the screen is at night (10%–100%).
- **Sunrise / Sunset** — shows when the brightness will change each day. These update automatically based on your timezone.

### Temperature

- **Indoor temperature** — turn this on and choose which temperature sensor from Home Assistant to display (for example, a room thermometer).
- **Outdoor temperature** — same as above, but for an outdoor sensor.

Both temperatures appear in the top bar of the panel. You can enable one, both, or neither.

### Screensaver

The screensaver dims the screen and shows a gentle animation when the panel isn't being used. There are two ways to control it:

- **Timer** — the screensaver turns on after a set amount of idle time. Choose from **5, 10, 15, 20, 30, or 45 minutes**, or **1 hour**. The default is 5 minutes.
- **Sensor** — the screensaver is controlled by a motion or presence sensor. When the sensor detects someone nearby, the screen wakes up. When nobody is detected, the screen goes to sleep. Enter the name of your motion sensor from Home Assistant (for example, `binary_sensor.hallway_presence`).

Touching the screen always wakes it up, regardless of which mode you use.

### Backup

- **Export** — saves your entire setup (buttons, subpages, colours, and display settings) as a file you can keep as a backup.
- **Import** — loads a previously saved file to restore your setup. If you're loading a backup from a different-sized panel, the buttons are rearranged to fit automatically.

### Firmware

- **Version** — which version of the software your panel is running.
- **Check for Update** — press this to look for a newer version right now.
- **Auto Update** — turn this on to let the panel update itself automatically.
- **Update Frequency** — how often to check: Hourly, Daily, Weekly, or Monthly. Only shown when Auto Update is on.

## Logs tab

A live feed of what the panel is doing. This is mainly useful if something isn't working — the logs may explain why. Messages are colour-coded: red for errors, yellow for warnings, green for normal activity. Press **Clear** to empty the log.

## Apply Configuration

After making changes, tap **Apply Configuration** at the bottom of the page. The panel restarts and loads your new settings — you'll see a message while it reconnects.

## Related

- [Buttons & Icons](/buttons-and-icons) — more about button types, icons, and subpages
- [Display & Screensaver](/display-screensaver) — more about temperature display and screensaver behaviour
- [Backlight Schedule](/backlight-schedule) — how automatic day/night brightness works
- [Firmware Updates](/firmware-updates) — more about automatic and manual updates
