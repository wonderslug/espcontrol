---
title: Built-in Relays
description:
  How Espcontrol exposes the built-in relays on the Guition 4848S040C relay variant in Home Assistant.
---

# Built-in Relays

Some Guition 4-inch 4848S040 panels are sold as a relay variant, often listed as **4848S040C**. These boards include three physical relays that can switch external low-voltage circuits.

## Home Assistant entities

On the 4848S040 firmware, Espcontrol exposes three relay switch entities to Home Assistant:

| Entity name | Relay pin |
|---|---|
| **Relay 1** | GPIO40 |
| **Relay 2** | GPIO2 |
| **Relay 3** | GPIO1 |

They appear as normal Home Assistant switch entities on the Espcontrol device. You can control them from Home Assistant dashboards, automations, scripts, and voice assistants.

## Hardware detection

The relays are controlled directly by GPIO pins. That means there is no separate relay controller chip for the firmware to identify, so Espcontrol cannot reliably auto-detect whether a specific physical board has the relay hardware fitted.

If your board is the relay variant, the entities will control the built-in relays. If your board does not have the relay hardware, the same entities may still appear in Home Assistant but will not switch a physical relay.

## Startup behaviour

The relay outputs default to **off** after startup or restart. This helps avoid a relay turning on unexpectedly when the panel reboots.

## Safety

Check the relay rating printed on your board or supplied by the seller before connecting anything. Do not use the relays for mains voltage unless your specific relay board, wiring, enclosure, and local electrical rules make that safe.
