# Image notifications: P4 hardware acceleration + safety guards

## Context

A recent upstream rebase added two ESP32-P4-specific accelerations inside
`components/artwork_image/`, both purely compile-time-gated
(`#if defined(USE_ESP_IDF) && defined(CONFIG_IDF_TARGET_ESP32P4)`, no-op
elsewhere):

- **`hardware_acceleration`** (bool, default `true`) — JPEG hardware decode
  + PPA crop/scale. Already active for `image_notification_image` today
  (never overridden), so this spec makes no change here.
- **`p4_pipeline`** (`DISABLED`/`TILE`/`MODAL`, default `DISABLED`) — offloads
  the HTTP download itself to a dedicated FreeRTOS background task instead
  of the main loop, for URLs that resolve to a local/LAN host
  (`can_use_p4_pipeline()`, `components/artwork_image/artwork_image.cpp:892-899`).
  Currently `DISABLED` for `image_notification_image`.

Camera/image cards (`common/device/image_cards_1.yaml`/`image_cards_6.yaml`,
`components/espcontrol/button_grid_image.h`) already use both, at
`priority: MODAL` / `p4_pipeline: MODAL` for their "tap to expand" modal
download. They pair this with two things the notification path currently
lacks:

1. **Source-resolution capping** — `image_card_sized_url()` appends
   `?width=&height=` query params (capped to
   `IMAGE_CARD_MODAL_MAX_TARGET_SIDE_PX = 800` px on the long side via
   `image_card_limit_target_size()`) to recognized HA camera/image proxy
   URLs before downloading, so HA returns an already-downscaled JPEG. The
   JPEG hardware decoder's workspace scales with the *source* image's
   resolution, not the target size — without this cap, an uncapped doorbell
   snapshot (e.g. 1920×1080) needs a multi-MB decode workspace regardless of
   how small the final on-screen image is.
2. **A memory-availability guard** — `image_card_memory_available()` checks
   free/largest heap blocks against a conservative estimate
   (`image_card_estimated_pipeline_bytes()`: 3× frame bytes + 256KB headroom
   on P4) before starting a download, and skips the refresh if memory is
   tight.

The notification image (`image_notification_image` in
`common/device/screen_image_notification.yaml`) currently downloads at
whatever resolution the source provides, decodes/resizes it into a buffer
sized to the modal panel (up to full-panel dimensions — e.g. 1280×800 on
the largest P4 device, via `control_modal_calc_layout()`), and has no
memory guard before doing so. This spec closes that gap so `p4_pipeline`/
elevated `priority` can be safely enabled.

All four functions being reused
(`image_card_sized_url`, `image_card_limit_target_size`,
`image_card_memory_available`, `image_card_estimated_pipeline_bytes`) are
already pure or accept a nullable context, and are already reachable from
`screen_image_notification.yaml`'s lambdas via the `#include "button_grid.h"`
chain added in `components/espcontrol/image_notification_popup.h` earlier
on this branch (`button_grid.h` → `button_grid_grid.h` →
`button_grid_image.h`).

## Goals

- Set `priority: MODAL` and `p4_pipeline: MODAL` as static config on the
  `image_notification_image` `artwork_image:` resource — the same
  "urgent, user-is-looking-at-this-now" tier the camera modal's own
  download already uses. On S3 (or any non-P4 target) both settings are
  inert no-ops handled entirely inside the existing `#ifdef` guards; no
  per-device branching needed in this file.
- Cap the requested source image to 800px on its long side by reusing
  `IMAGE_CARD_MODAL_MAX_TARGET_SIDE_PX` and `image_card_limit_target_size()`
  verbatim — no new constant.
- Apply the cap via `image_card_sized_url()` verbatim, called on the
  already-resolved URL before `request_update_url()`. This only touches
  recognized HA camera/image proxy URLs (`/api/camera_proxy/`,
  `/api/image_proxy/`); any other URL passes through unchanged, identically
  to how camera cards already behave.
- Add a memory-availability guard before `request_update_url()`, reusing
  `image_card_memory_available()` verbatim with `ctx = nullptr` (the
  function already treats a null context as "skip the optional diagnostic
  logging," per `components/espcontrol/button_grid_image.h:189` and the
  null-safe ternaries in the warning log at lines 613-617 — no code change
  needed to that function). Checked against the *decode target* size
  (`layout.panel_w`/`panel_h` — the actual on-screen RGB565 buffer
  dimensions), not the smaller capped request size, matching how
  `image_card_estimated_pipeline_bytes()`'s 3×-plus-headroom formula is
  already deliberately conservative enough to cover the smaller JPEG decode
  workspace alongside the full target buffer.
- On memory-guard failure, fall back to the text-notification path via the
  existing `image_notif_fallback_to_text` script — the same one already
  used for download/decode failures, so no new failure-handling code, just
  an earlier trigger point for it.
- Applies uniformly regardless of `image_sizing` (`cover`/`fit`) — the
  cap/guard concerns the download/decode step, orthogonal to how the
  resulting buffer is cropped or letterboxed afterward.

## Non-goals

- No change to `ArtworkImage`, `image_service.h`, or any P4/S3 branching
  logic itself — every reused function already has the right guards from
  the camera-card work.
- No new C++ helper functions or constants — 100% reuse of existing,
  already-tested `button_grid_image.h` functions from a new call site.
- No cap applied to non-HA-proxy URLs (arbitrary external `http(s)` image
  URLs, which `send_image_notification`'s docs explicitly allow) — same
  limitation camera cards already have. The memory guard still protects
  against catastrophic failure for those; they just don't get the
  source-size win.
- No change to the accent-tint, shadow-text, panel/chrome, or dismiss
  mechanics — untouched.
- No change to `buffer_size: 65536` on the `artwork_image:` resource (an
  HTTP streaming chunk size, unrelated to final image dimensions — camera
  cards' own `MODAL` download entries use a smaller `buffer_size: 8192` for
  the same reason: it's independent of target/source resolution).

## Runtime mechanics

### `artwork_image:` resource

Add two keys to `image_notification_image`
(`common/device/screen_image_notification.yaml`, current lines 47-54):

```yaml
artwork_image:
  - url: "http://127.0.0.1/none.jpg"   # placeholder; never fetched (polling: never)
    id: image_notification_image
    format: AUTO
    type: RGB565
    byte_order: LITTLE_ENDIAN
    buffer_size: 65536
    allow_insecure_local_urls: true
    priority: MODAL
    p4_pipeline: MODAL
    on_download_finished: ...
    on_error: ...
```

### Both API actions

In `send_image_notification` and `send_expiring_image_notification`
(current lines 330-428), insert the cap/guard right after `layout` is
computed and before any widget mutation begins — so a failed memory check
touches nothing:

```cpp
auto *img = id(image_notification_image);
auto layout = control_modal_calc_layout(100);
if (!image_card_memory_available(nullptr, "notification", layout.panel_w, layout.panel_h)) {
  id(image_notif_fallback_to_text).execute();
  return;
}
int request_w, request_h;
image_card_limit_target_size(layout.panel_w, layout.panel_h, &request_w, &request_h);
url = image_card_sized_url(url, request_w, request_h);
int target_w = layout.panel_w;
int target_h = layout.panel_h;
auto mode = esphome::artwork_image::ImageResizeMode::COVER;
// ...existing image_sizing/widget-setup code, unchanged...
```

`url` is declared `std::string url = image_notification_resolve_url(...)`
just above this block already, so reassigning it via `image_card_sized_url()`
is a normal mutation of an existing local, not a new declaration. The rest
of the lambda (fit/cover branch, panel/close-button/caption setup,
`img->set_target_size()`/`set_resize_mode()`/`request_update_url()`) is
unchanged — `target_w`/`target_h` continue to be the full panel dimensions
for the decode/display buffer; only the *requested* URL's size hint and the
pre-flight memory check are new.

A bare `return;` mid-lambda is an established pattern already used
elsewhere in this codebase's inline lambdas (e.g.
`components/espcontrol/button_grid_image.h:134,657,695,702,705`); ESPHome
action lambdas compile to a void-returning callable, so this exits the
action handler cleanly without executing any of the subsequent widget
setup or download call.

## Testing plan

- `esphome config` on all 6 devices (schema validation — confirms
  `priority`/`p4_pipeline` are accepted keys and the new lambda code
  parses).
- `esphome compile` on at least one S3 device and one P4 device, to confirm
  `image_card_sized_url`/`image_card_limit_target_size`/
  `image_card_memory_available` resolve correctly from this file's lambdas
  on both target types (the `#ifdef CONFIG_IDF_TARGET_ESP32P4` branches
  inside those functions differ per target, so compiling both is the way
  to exercise each path).
- Manual on-device verification (by the user):
  - On a P4 device: a `send_image_notification` call with a real HA camera
    proxy URL still renders correctly, and (if inspectable via logs) the
    download visibly uses the P4 background pipeline / hardware decode
    path rather than the main-loop software path.
  - On an S3 device: the same call still works identically to before this
    change (no observable behavior difference — confirms the P4-only
    settings are true no-ops there).
  - Confirm the requested image URL now carries `?width=&height=` query
    params (capped to ≤800 on the long side) when pointed at a real HA
    camera/image proxy entity.
  - Force a low-memory condition (or reason about it via the existing
    free-heap sensor) to confirm the memory guard correctly falls back to
    a text notification rather than attempting — and potentially
    failing/crashing — an oversized decode.
