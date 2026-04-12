---
title: Push Buttons
description:
  How to use push buttons on your Espcontrol panel to trigger Home Assistant automations.
---

# Push Buttons

A push button is a momentary button with no on/off state. When tapped, it flashes the highlight colour and fires an event to Home Assistant that you can use as an automation trigger.

Push buttons are useful for things like triggering scenes, sending notifications, activating scripts, or anything else you'd start with a single tap.

## Setting up a push button

1. Select a button and change its type to **Push Button**.
2. Set a **Label** — this is shown on the button and also sent to Home Assistant as part of the event data.
3. Choose an **Icon** (defaults to a tap gesture icon).

Push buttons don't need an entity ID — they don't control a device directly.

## How it works on the panel

When you tap a push button:

- The button instantly flashes the **on colour** (orange by default).
- The colour fades smoothly back to the **off colour** over 400 ms.
- An event is fired to Home Assistant with the button's label.

## Setting up an automation in Home Assistant

Push buttons fire an event called `esphome.push_button_pressed` on the Home Assistant event bus. The event includes the button's **label** and **slot number**.

To create an automation:

1. In Home Assistant, go to **Settings > Automations & Scenes** and create a new automation.
2. Add a trigger and choose **Event** (under "Other triggers").
3. Set **Event type** to `esphome.push_button_pressed`.
4. Under **Event data**, enter the label of your button:

```yaml
label: Doorbell
```

5. Add whatever actions you want — turn on a light, send a notification, run a script, etc.

::: tip Label-based triggers are resilient
Because the automation triggers on the button's **label** rather than its position, you can freely move the button to a different slot on the grid without breaking any automations.
:::

### Verifying events are firing

If you want to confirm that events are being sent, go to **Developer Tools > Events** in Home Assistant, type `esphome.push_button_pressed` in the "Listen to events" field, and click **Start listening**. Press the push button on your panel — the event should appear with the label and slot number.

### Example event data

When a push button labelled "Doorbell" on slot 3 is pressed, Home Assistant receives:

```yaml
event_type: esphome.push_button_pressed
data:
  label: "Doorbell"
  slot: "3"
```

::: info Requires Home Assistant actions
The panel must be allowed to perform Home Assistant actions for push button events to work. See [Home Assistant Actions](/getting-started/home-assistant-actions) for setup instructions.
:::
