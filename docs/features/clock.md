---
title: Clock
description:
  How to configure the timezone and 12/24-hour clock format on your Espcontrol panel.
---

# Clock

The panel can display a clock in the top bar, updated every minute from Home Assistant's time. You can choose your timezone, switch between 12-hour and 24-hour format, or hide the top bar completely.

## Settings

Configured in the **Clock** section of the **Settings** tab in [Setup](/features/setup).

- **Timezone** — select your timezone from the dropdown. This also determines sunrise and sunset times used by the [backlight schedule](/features/backlight).
- **Clock Format** — choose **12h** for 12-hour time with AM/PM, or **24h** for 24-hour time. Defaults to 24h.
- **Show Clock Bar** — turn this off to hide the top clock/temperature bar and give the button grid more screen space.
- **Sunrise / Sunset** — read-only reference values calculated from your timezone, updated daily. Displayed in whichever format you chose.

## How It Works

The on-screen clock is driven by Home Assistant's time sync — no manual time setting is needed. Once the panel connects to Home Assistant, the clock appears automatically.

The clock format setting affects three things:

1. The **top bar clock** on the panel display, when the clock bar is shown.
2. The **sunrise and sunset** times shown in settings.
3. The **clock preview** on the web setup page.

The setting is saved on the device and persists across restarts.
