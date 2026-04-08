---
title: FAQ
description:
  Frequently asked questions about the Espcontrol touchscreen panel — WiFi, setup, updates, troubleshooting, and more.
---

# FAQ

## How do I find my device's IP address?

There are several ways:

- **On the display itself** — when no buttons are configured yet, the panel shows its address on screen.
- **In your router** — look at the connected devices list (usually at `192.168.1.1` or similar). The panel will appear with its hostname.
- **In Home Assistant** — go to **Settings > Devices & Services > ESPHome**, click on the device, and look for the IP address.

## The web page looks broken or unstyled

The panel's built-in web page loads some visual resources from the internet. If the page looks plain or broken:

- Make sure your panel has a working **internet connection**, not just local network access. Some routers block IoT devices from reaching the internet.
- Try **clearing your browser cache** and reloading the page.
- Try a different browser (Chrome or Edge recommended).

## My device won't connect to WiFi

- Make sure you're connecting to a **2.4 GHz** network. The panel does not support 5 GHz WiFi.
- Double-check your **WiFi password** — it's easy to mistype on a small screen.
- Move the panel **closer to your router** during initial setup. You can move it to its final location afterwards.
- If the panel previously connected but can't anymore (e.g. you changed your WiFi password), it will create a hotspot so you can enter the new details. Look for a network called **espcontrol-xxxxxx**.

## How do I reset the device?

To start completely fresh, re-flash the firmware using the [install guide](/install). Connect the panel to your computer with a USB-C cable and use the web installer. This will reset WiFi settings and the panel will create its setup hotspot again.

Your button configuration is stored separately and will be preserved unless you change it through the web page.

## Can I use this without Home Assistant?

No. The panel is designed to work with Home Assistant. It needs Home Assistant for:

- Controlling your smart home devices (lights, switches, fans, etc.)
- Time synchronisation (for the clock and backlight schedule)
- Temperature sensor data
- Presence sensor data for screensaver wake

Without Home Assistant, the panel would have no devices to control and no data to display.

## How do I update the firmware?

If **Auto Update** is turned on (the default), the panel checks for and installs new versions automatically. You don't need to do anything.

To update manually:

1. Open the panel's web page.
2. Go to the **Settings** tab.
3. Under **Firmware**, press **Check for Update**.
4. If a new version is available, the panel will download and install it.

See [Firmware Updates](/firmware-updates) for more details.

## What if the icon I need isn't listed?

The panel includes hundreds of icons from the Material Design Icons set. If the one you need isn't there, [open an issue on GitHub](https://github.com/jtenniswood/espcontrol/issues) with the icon name (from [pictogrammers.com/library/mdi](https://pictogrammers.com/library/mdi/)) and what you'd use it for. We'll look into adding it.

## How many buttons can I have?

Each panel has a grid of cells sized to fill the screen. The home grid sizes are:

- **7-inch JC1060P470** — 20 buttons (4 rows x 5 columns)
- **4.3-inch JC4880P443** — 15 buttons (5 rows x 3 columns)
- **4-inch 4848S040** — 9 buttons (3 rows x 3 columns)

You can go beyond these limits using **subpages**. Any button can be set to the Subpage type, which opens a nested page with its own grid of buttons (one fewer slot than the home grid, since the first position is a Back button). See [Buttons & Icons — Subpages](/buttons-and-icons#subpages) for details.

## What are subpages?

Subpages let you group related buttons together. A button set to the **Subpage** type acts like a folder — tapping it on the display opens a nested grid of buttons. This is useful for organising controls by room or device type without filling up the home screen. Each subpage has its own buttons, icons, and labels, configured the same way as the home grid. See [Buttons & Icons — Subpages](/buttons-and-icons#subpages).

## Can I back up my configuration?

Yes. In the [Web UI](/web-ui) **Settings** tab, under **Backup**, you can **Export** your full configuration (buttons, subpages, colours, and display settings) as a JSON file. To restore it, use **Import** to upload a previously exported file. You can also use this to copy a configuration from one panel to another — the importer remaps buttons automatically if the panels have different grid sizes.

## Which panels are supported?

Espcontrol currently supports three Guition touchscreen panels:

- **JC1060P470** — 7-inch, 1024x600, landscape orientation (ESP32-P4)
- **JC4880P443** — 4.3-inch, 480x800, portrait orientation (ESP32-P4)
- **4848S040** — 4-inch, 480x480, square (ESP32-S3)

All use the same firmware features, button configuration, and web UI. The grid layout automatically matches each panel's screen size and orientation.

## Does the panel work with other smart home platforms?

Espcontrol is built specifically for Home Assistant. It does not support other platforms like Google Home, Apple HomeKit, or SmartThings directly. However, if those platforms are integrated into your Home Assistant setup, the panel can control devices that are exposed through Home Assistant.

## The display is stuck on the loading screen

- Give it up to **60 seconds** on first boot. It needs time to connect to WiFi and download resources.
- If it stays on the loading screen, **power-cycle** the panel (unplug and re-plug the USB-C cable).
- If the WiFi hotspot appears after restarting, the panel couldn't connect to your network — go through the [WiFi setup](/install#connect-to-wifi) again.

## How is my data handled?

Everything stays on your local network. The panel communicates directly with your Home Assistant instance over your home WiFi. No data is sent to external servers, cloud services, or third parties. The only internet connection the panel makes is to check for firmware updates and to load the web page styling.
