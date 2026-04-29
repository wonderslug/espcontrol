---
title: Time Settings
description:
  How to configure clock sync, timezone, and 12/24-hour format on your Espcontrol panel.
---

# Time Settings

The panel can display a clock in the top bar, updated every minute from network time. You can choose your timezone, switch between 12-hour and 24-hour format, and set custom NTP servers.

## Settings

Configured in the **Time Settings** section of the **Settings** tab in [Setup](/features/setup).

- **Timezone** — select your timezone from the dropdown. This also determines sunrise and sunset times used by the [backlight schedule](/features/backlight).
- **Clock Format** — choose **12h** for 12-hour time with AM/PM, or **24h** for 24-hour time. Defaults to 24h.
- **NTP Server 1 / 2 / 3** — choose the network time servers used to keep the panel clock accurate. Defaults to `0.pool.ntp.org`, `1.pool.ntp.org`, and `2.pool.ntp.org`.
- **Sunrise / Sunset** — read-only reference values calculated from your timezone, updated daily. Displayed in whichever format you chose.

The **Clock Bar** section controls whether the top bar is shown. It also contains the indoor and outdoor temperature controls shown in that bar.

## How It Works

The on-screen clock normally syncs directly from NTP over Wi-Fi. Home Assistant time is still used as a fallback, so the clock can continue to work if NTP is blocked but the panel is connected to Home Assistant.

You can use public NTP server names, such as the defaults, or a local server/IP address on your own network. If your panel uses manual network settings without DNS, use IP addresses for the NTP servers.

The clock format setting affects three things:

1. The **top bar clock** on the panel display, when the clock bar is shown.
2. The **sunrise and sunset** times shown in settings.
3. The **clock preview** on the web setup page.

The setting is saved on the device and persists across restarts.
