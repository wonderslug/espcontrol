# Image notifications — send a camera image to the panel like a notification

**Status:** Approved design, ready for implementation planning
**Date:** 2026-07-10
**Approach:** A — dedicated image-notification module (parallel to the text notification popup)

## The short version

Home Assistant can already push a text popup to an EspControl panel
(`send_notification` / `send_expiring_notification`). This feature adds the image
equivalent: HA hands the device an **image URL**, the device downloads, decodes, and
displays it — either full-screen (doorbell-glance) or in a framed card — with an optional
title/message caption. On a doorbell ring, an automation snapshots the front-door camera and
pushes the URL; the panel shows the picture the moment you glance at it.

The device side is deliberately dumb about sourcing: it only ever receives a URL. HA does
whatever it needs (camera proxy, `camera.snapshot` to `/local/`, an external URL) to produce
that URL.

## Why this is a small build

Everything hard already exists in this fork:

- **`artwork_image` component** — downloads an image over HTTP, decodes JPEG/PNG, resizes
  (FIT/COVER), and renders into an LVGL image widget. Public API used here is intact and
  stable: `request_update_url(url)`, `set_target_size(w,h)`, `on_download_finished` /
  `on_error` callbacks, `resize` + `resize_mode`, `release()`. This is the component behind
  the media cover-art screensaver.
- **Text notification popup** — `common/device/screen_notification_popup.yaml` +
  `components/espcontrol/notification_popup.h`. A top-layer LVGL overlay driven by two HA API
  actions, with an auto-dismiss timer and ack/expire events back to HA. Unchanged by this
  feature and reused as the failure fallback.
- **HA base-URL discovery** — the cover-art code already resolves the connected HA base URL
  (`cover_art_home_assistant_base_url`) so relative paths like `/api/camera_proxy/...` work.

So this feature marries the existing image-download pipeline to the existing
notification-popup flow, kept in its own module so the proven text path is untouched.

## Product decisions (locked)

| Decision | Choice |
|----------|--------|
| Presentation | **Both** full-screen and card; caller picks per call via `style`. Default `fullscreen`. |
| Image source | Caller passes a **URL only**. HA does all sourcing. Relative paths resolve against the discovered HA base URL; full `http(s)` passed through. |
| Lifecycle | **Both** persistent (tap to dismiss) and expiring (auto-dismiss after N seconds), matching the text pair. |
| Events | Same contract as text: `notification_acknowledged` / `notification_expired`, payload `device_name` + `message_id`. |
| Caption | Optional `title` and `message`, both may be omitted (image-only is valid). |
| On failure | **Fall back to a text notification** using the same title/message/timeout/message_id; image-only failures show a localized "Image unavailable" body. |

## Architecture & components

Three new pieces, mirroring the text-popup structure, plus one include line per device.

**New files**

- `common/device/screen_image_notification.yaml` — the LVGL `top_layer` overlay (image
  widget + scrim + caption labels), the dedicated `artwork_image` instance, the two HA API
  actions, and the orchestration scripts (resolve URL, size, download, show, fallback).
- `components/espcontrol/image_notification_popup.h` — small state/control header
  (show/hide, auto-dismiss timer, event firing), parallel to `notification_popup.h`. Reuses
  the same event-fire pattern so the ack/expire event shape stays identical.

**Reused as-is (no edits to these)**

- `artwork_image` component — one new instance `image_notification_image` with
  `on_download_finished` / `on_error` callbacks.
- HA base-URL discovery from the cover-art module (read-only reuse of the resolved base).
- `screensaver_wake`; the existing text `notification_popup_show(...)` as the failure fallback.

**Overlay structure** — a single top-layer card containing a full-bleed `image` widget, a
scrim, and title/message labels. Two layout presets (`card`, `fullscreen`) are applied at
show-time by repositioning/resizing the same widgets — one widget set, two geometries, the
way the cover-art responsive layout already works.

**Integration per device** — add one include line to each of the 5 `devices/*/packages.yaml`
files (they all already include `screen_notification_popup.yaml` the same way), e.g.:

```yaml
  screen_image_notification: !include ../../common/device/screen_image_notification.yaml
```

plus the per-device decode-size substitutions described under Memory & decode sizing.

## HA-facing API contract

Two new API actions, parallel to the existing text pair. ESPHome auto-generates
`esphome.<device>_<action>` services in HA.

**Persistent (tap to dismiss):**

```yaml
action: esphome.<device>_send_image_notification
data:
  image_url: "/api/camera_proxy/camera.front_door"   # required; relative or full http(s)
  title: "Front Door"          # optional
  message: "Motion detected"   # optional
  style: "fullscreen"          # optional: "fullscreen" (default) | "card"
  message_id: "doorbell"       # optional, echoed back in events
```

**Auto-dismissing:**

```yaml
action: esphome.<device>_send_expiring_image_notification
data:
  image_url: "..."             # required
  title: "..."                 # optional
  message: "..."               # optional
  style: "..."                 # optional
  timeout: 20                  # seconds until auto-dismiss
  message_id: "..."            # optional
```

**Events fired on close (identical to text notifications):**

- `esphome.notification_acknowledged` — user tapped. Payload: `device_name`, `message_id`.
- `esphome.notification_expired` — timeout elapsed (or the fallback text popup expired).
  Payload: `device_name`, `message_id`.

**Contract notes**

- `image_url` is the only required field. Relative paths resolve against the discovered HA
  base URL; full `http(s)://` URLs pass through unchanged.
- `style` defaults to `fullscreen`; `card` gives a smaller framed view over the scrim.
- All text is optional, so image-only is valid. On failure with no text, the fallback body is
  a localized "Image unavailable".

## Data flow

```
HA action ─▶ screensaver_wake
          ─▶ store {title, message, message_id, style, timeout, request_gen++}
          ─▶ resolve image_url against HA base
          ─▶ image_notification_image.set_target_size(style)   # card vs fullscreen decode size
          ─▶ request_update_url(url)  ── async download + decode ──┐
                                                                   │
        ┌──────────────── on_download_finished ───────────────────┤
        │  (ignore if request_gen is stale)                        │
        ▼                                                  on_error / stall-timeout
  apply layout (card|fullscreen)                            (ignore if request_gen stale)
  set image src, show caption labels                               │
  show overlay, move to foreground                                 ▼
  start auto-dismiss timer (expiring only)              release() image buffer, hide overlay
        │                                               notification_popup_show(
        ▼                                                 title, message|"Image unavailable",
  tap ─▶ dismiss ─▶ notification_acknowledged             timeout, message_id)
  timeout ─▶ notification_expired                       (text popup then owns dismissal/events)
```

**Race handling** — a per-request generation counter (like cover-art's `request_id`). A
`on_download_finished` or `on_error` whose generation no longer matches the active request is
ignored, so a late callback from a superseded request can't tear down a newer popup.

**One popup at a time** — a new image notification replaces any active popup (text or image)
and resets the timer.

## Memory & decode sizing

Camera frames are large (1080p JPEG), but the full frame is never held: `artwork_image`
decodes straight into a fixed-size RGB565 buffer, exactly as cover-art does. Upstream has
done extensive S3 heap-pressure work on cover-art, so the S3 panel must stay conservative.

New per-device substitutions in each `devices/*/packages.yaml`:

- `image_notif_fullscreen_size` — capped to the panel's short edge. ~800 on the P4-8012,
  **320 on the S3** (matching its cover-art decode budget).
- `image_notif_card_size` — smaller, since the card is a fraction of the screen (~400,
  ~240 on S3).

At show-time, `set_target_size()` is called for the chosen style *before*
`request_update_url()`, so only one decode buffer of the needed size is allocated. On dismiss
the instance is `release()`d promptly (mirroring the S3 cover-art teardown) so an idle image
notification does not sit on PSRAM. `resize_mode: COVER` for full-screen (fill, crop
overflow); `FIT` for card (whole frame visible).

## Failure fallback (detail)

`on_error` fires on HTTP failure, decode failure, or the pipeline's existing stall timeout
(~10s). On a failure whose generation is still current:

1. `release()` the image instance and hide the image overlay.
2. Call the existing `notification_popup_show(...)` with the same `title` / `message` /
   `timeout` / `message_id`. If both title and message are empty (image-only call), pass a
   localized "Image unavailable" body.
3. The text popup then owns dismissal and fires the same
   `notification_acknowledged` / `notification_expired` events — HA correlation is identical
   whether the image showed or not.

## Concurrency & layering

- **One popup at a time** across text and image: showing one hides the other's scrim, so
  top-layer overlays never stack.
- **Vs. the cover-art screensaver**: image notifications live on the same LVGL `top_layer`
  and are shown after `screensaver_wake`, rendering above cover-art. If media cover-art is
  active, the notification overlays it; on dismiss, cover-art remains as it was. Cover-art's
  own foreground/scrim conventions are reused; the cover-art module itself is not modified.
- **Screensaver wake** is the same first step as text notifications — the arriving image
  wakes the display.

## Testing

Firmware for these panels cannot be unit-tested in isolation, so verification mirrors the
existing notification feature:

- **Config validation** — `esphome config` compiles for each of the 5 devices with the new
  screen included (catches YAML/substitution errors).
- **Manual on-device matrix** — persistent + expiring × card + fullscreen × {valid URL, bad
  URL (fallback), image-only}; confirm `notification_acknowledged` / `notification_expired`
  land in HA with the right `message_id`; confirm the S3 does not OOM on repeated large
  images (repeated show/dismiss cycles).

## Out of scope (YAGNI)

- Resolving a camera `entity_id` on the device (caller passes a URL only).
- Multiple simultaneous / stacked notifications.
- Image caching across notifications or a history/gallery view.
- GPU blur behind the card (not available on ESP32).
- Any change to the text notification actions or to the cover-art module.
