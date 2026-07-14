# Image Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Home Assistant push an image (e.g. a doorbell camera snapshot) to an EspControl panel as a notification, shown full-screen or in a card, with an optional caption, falling back to a text notification on failure.

**Architecture:** A new self-contained module (`common/device/screen_image_notification.yaml` + `components/espcontrol/image_notification_popup.h`) mirrors the existing text notification popup. It reuses the `artwork_image` component's download → JPEG/PNG decode → resize → LVGL pipeline for the image, reuses the cover-art module's discovered HA base URL to resolve relative paths, and reuses the text popup's `notification_fire_event` helper for the ack/expire events. The text notification popup and cover-art module are not modified.

**Tech Stack:** ESPHome (YAML packages + lambdas), LVGL (top-layer overlay widgets), C++ header included via ESPHome's component resource system, the in-repo `artwork_image` external component.

## Global Constraints

- **PRs target `wonderslug/espcontrol` only** — never the upstream `jtenniswood/espcontrol`.
- **No Claude attribution** in commits or PRs (no `Co-Authored-By`, no generated-by footers).
- **Do not modify** `common/device/screen_notification_popup.yaml`, `components/espcontrol/notification_popup.h`, or `common/device/screen_cover_art.yaml`. Reuse them read-only.
- **Device side takes a URL only.** The firmware never resolves camera entities or snapshots; HA supplies a URL string.
- **Event contract is identical to text notifications:** fire `esphome.notification_acknowledged` / `esphome.notification_expired` with payload `device_name` + `message_id`.
- **Memory budget:** the image decode buffer must never exceed each device's proven cover-art decode size. Reuse `${cover_art_decode_size}` for full-screen and a smaller value for card; release the buffer on every dismiss/expire.
- **RGB565 / LITTLE_ENDIAN** image type (matches the cover-art instance on these displays).
- **Config validation command** (the "test" for firmware — there is no unit-test harness): `esphome config devices/<device>/dev.yaml` must succeed. Behavioral checks are the manual matrix in Task 4.
- **Five devices** must all validate: `esp32-p4-86`, `guition-esp32-p4-jc1060p470`, `guition-esp32-p4-jc4880p443`, `guition-esp32-s3-4848s040`, `guition-esp32-p4-jc8012p4a1`.

---

## File Structure

- **Create** `components/espcontrol/image_notification_popup.h` — module state (`message_id`) + event-firing helper. Auto-included into the build by ESPHome's resource system (every `.h` in `components/espcontrol/` is pulled into the generated `esphome.h`). Includes `notification_popup.h` to reuse `notification_fire_event`.
- **Create** `common/device/screen_image_notification.yaml` — globals, the dedicated `artwork_image` instance, the top-layer overlay (root scrim + full-screen group + card group), the two API actions, and the orchestration scripts (show / auto-dismiss / teardown).
- **Modify** each `devices/*/packages.yaml` (×5) — add per-device substitutions (`image_notif_fullscreen_size`, `image_notif_card_size`) and one `!include` line for the new screen.
- **Modify** `README.md` — document the feature under "Added Features".

Reused read-only: `components/artwork_image/*` (download/decode/display), `components/espcontrol/notification_popup.h` (`notification_fire_event`, `notification_popup_show`), `common/device/screen_cover_art.yaml` (`cover_art_home_assistant_base_url` global).

---

### Task 1: Module header + screen file, wired into the 10" P4 device

Delivers the whole feature on one device and the first `esphome config` pass. The header is not testable alone, so it is bundled with the screen file and the device wiring that exercises it.

**Files:**
- Create: `components/espcontrol/image_notification_popup.h`
- Create: `common/device/screen_image_notification.yaml`
- Modify: `devices/guition-esp32-p4-jc8012p4a1/packages.yaml` (substitutions block ~line 51; packages/screens block ~line 146)

**Interfaces:**
- Consumes (read-only, already in the build on every device):
  - `notification_fire_event(const char *event_name, const std::string &message_id)` — from `notification_popup.h`.
  - `notification_popup_show(lv_obj_t *scrim, lv_obj_t *title_lbl, lv_obj_t *body_lbl, const std::string &title, const std::string &body, int timeout_sec, const std::string &message_id)` — from `notification_popup.h`. Widget ids `notification_scrim`, `notification_title_lbl`, `notification_body_lbl` come from `screen_notification_popup.yaml`.
  - `id(cover_art_home_assistant_base_url)` — `std::string` global from `screen_cover_art.yaml`, populated on HA connect (e.g. `http://10.0.0.5:8123`).
  - `espcontrol_i18n(const std::string&)` — from `i18n_generated.h`, returns the localized string or the source text if untranslated.
  - `artwork_image::ArtworkImage` methods: `set_target_size(int w, int h)`, `request_update_url(const std::string &url)`, `std::string get_url() const`. YAML actions `artwork_image.release`. Callbacks `on_download_finished` (arg `bool cached`) and `on_error`.
- Produces (used by Task 2 and by HA):
  - HA actions `esphome.<device>_send_image_notification` and `esphome.<device>_send_expiring_image_notification`.
  - C++ helpers `image_notification_set_msg_id(const std::string&)`, `image_notification_fire(const char *event_name)`, and `image_notification_resolve_url(const std::string &image_url, const std::string &ha_base_url)`.
  - Per-device substitutions `image_notif_fullscreen_size`, `image_notif_card_size` (Task 2 sets these for the other four devices).

- [ ] **Step 1: Create the module header**

Create `components/espcontrol/image_notification_popup.h`:

```cpp
// =============================================================================
// IMAGE NOTIFICATION POPUP - state + event helper for screen_image_notification
// =============================================================================
// Parallel to notification_popup.h. Holds the current image notification's
// message_id and forwards ack/expire events through the shared text-popup
// helper so HA sees an identical event payload for text and image popups.
// Auto-included into the build by ESPHome's component resource system.
// =============================================================================
#pragma once
#include <string>
#include "notification_popup.h"  // reuse notification_fire_event

// Message id of the image notification currently on screen (one at a time).
static std::string s_image_notif_msg_id;

// Record the message_id for the active image notification.
inline void image_notification_set_msg_id(const std::string &message_id) {
  s_image_notif_msg_id = message_id;
}

// Fire a HA event (acknowledged/expired) with device_name + the stored message_id.
inline void image_notification_fire(const char *event_name) {
  notification_fire_event(event_name, s_image_notif_msg_id);
}

// Resolve a caller-supplied image_url against the cover-art HA base URL. Full
// http(s) URLs pass through; relative paths are appended to the base. Pure
// string work — no artwork_image dependency, so it lives in this header.
inline std::string image_notification_resolve_url(const std::string &image_url,
                                                  const std::string &ha_base_url) {
  if (image_url.rfind("http://", 0) == 0 || image_url.rfind("https://", 0) == 0)
    return image_url;
  std::string base = ha_base_url;
  while (!base.empty() && base.back() == '/') base.pop_back();
  if (base.empty()) return image_url;
  if (image_url.empty()) return base;
  return base + (image_url.front() == '/' ? image_url : ("/" + image_url));
}
```

- [ ] **Step 2: Create the screen module file**

Create `common/device/screen_image_notification.yaml`:

```yaml
# =============================================================================
# SCREEN: IMAGE NOTIFICATION POPUP
# =============================================================================
# Top-layer overlay that shows an HA-pushed image (e.g. a doorbell camera
# snapshot), full-screen or in a card, with an optional title/message caption.
# The device only receives a URL; HA does all image sourcing.
#
# Persistent (tap to dismiss):
#   action: esphome.<device>_send_image_notification
#   data:
#     image_url: "/api/camera_proxy/camera.front_door"   # required; relative or http(s)
#     title: "Front Door"        # optional
#     message: "Motion detected" # optional
#     style: "fullscreen"        # optional: "fullscreen" (default) | "card"
#     message_id: "doorbell"     # optional, echoed in events
#
# Auto-dismissing: esphome.<device>_send_expiring_image_notification (adds timeout: <sec>)
#
# On close fires (same as text notifications): esphome.notification_acknowledged
# (tapped) or esphome.notification_expired (timed out). Payload: device_name, message_id.
# On download/decode failure, falls back to the text notification popup with the
# same title/message/timeout/message_id ("Image unavailable" when image-only).
#
# image_notification_popup.h is auto-included by ESPHome's component resource system.
# Reuses cover_art_home_assistant_base_url (screen_cover_art.yaml) to resolve
# relative URLs, and notification_popup_show (screen_notification_popup.yaml) for fallback.
# =============================================================================

globals:
  - id: image_notif_style
    type: std::string
    initial_value: '"fullscreen"'
  - id: image_notif_timeout
    type: int
    initial_value: '0'
  - id: image_notif_title
    type: std::string
    initial_value: '""'
  - id: image_notif_message
    type: std::string
    initial_value: '""'
  - id: image_notif_expected_url
    type: std::string
    initial_value: '""'

artwork_image:
  - url: "http://127.0.0.1/none.jpg"   # placeholder; never fetched (polling: never)
    id: image_notification_image
    format: AUTO
    type: RGB565
    byte_order: LITTLE_ENDIAN
    buffer_size: 65536
    allow_insecure_local_urls: true
    on_download_finished:
      - if:
          condition:
            lambda: 'return id(image_notification_image)->get_url() == id(image_notif_expected_url);'
          then:
            - script.execute: image_notif_show
    on_error:
      - if:
          condition:
            lambda: 'return id(image_notification_image)->get_url() == id(image_notif_expected_url);'
          then:
            - script.execute: image_notif_fallback_to_text

lvgl:
  top_layer:
    widgets:
      # Root scrim: dark overlay + tap-to-dismiss. Fills screen for card mode;
      # the full-screen group draws its own opaque backdrop over it.
      - obj:
          id: image_notif_root
          x: 0
          y: 0
          width: ${screen_width}
          height: ${screen_height}
          bg_color: 0x000000
          bg_opa: 75%
          radius: 0
          border_width: 0
          pad_all: 0
          scrollable: false
          scrollbar_mode: "off"
          clickable: true
          hidden: true
          on_click:
            then:
              - script.stop: image_notif_autodismiss
              - lambda: 'image_notification_fire("esphome.notification_acknowledged");'
              - script.execute: image_notif_teardown
          widgets:
            # ---- Full-screen group: black backdrop + centered image + bottom caption ----
            - obj:
                id: image_notif_fs_group
                x: 0
                y: 0
                width: ${screen_width}
                height: ${screen_height}
                bg_color: 0x000000
                bg_opa: cover
                radius: 0
                border_width: 0
                pad_all: 0
                scrollable: false
                scrollbar_mode: "off"
                clickable: false
                hidden: true
                widgets:
                  - image:
                      id: image_notif_fs_image
                      align: center
                      width: ${image_notif_fullscreen_size}px
                      height: ${image_notif_fullscreen_size}px
                      src: image_notification_image
                  - obj:
                      id: image_notif_fs_caption
                      align: bottom_mid
                      x: 0
                      y: 0
                      width: ${screen_width}
                      height: SIZE_CONTENT
                      bg_color: 0x000000
                      bg_opa: 60%
                      radius: 0
                      border_width: 0
                      pad_top: 12
                      pad_bottom: 12
                      pad_left: 20
                      pad_right: 20
                      scrollable: false
                      clickable: false
                      hidden: true
                      layout:
                        type: flex
                        flex_flow: COLUMN
                        flex_align_cross: start
                        pad_row: 6
                      widgets:
                        - label:
                            id: image_notif_fs_title
                            text: ""
                            text_font: ${setup_body_font_id}
                            text_color: 0xFFFFFF
                            long_mode: wrap
                            width: 100%
                        - label:
                            id: image_notif_fs_message
                            text: ""
                            text_font: ${label_font}
                            text_color: 0xDDDDDD
                            long_mode: wrap
                            width: 100%
            # ---- Card group: centered panel with image on top, caption below ----
            - obj:
                id: image_notif_card_group
                align: center
                width: ${content_width}
                height: SIZE_CONTENT
                bg_color: 0x1E1E1E
                bg_opa: cover
                radius: 16
                border_width: 0
                pad_top: 24
                pad_bottom: 24
                pad_left: 24
                pad_right: 24
                scrollable: false
                clickable: false
                hidden: true
                layout:
                  type: flex
                  flex_flow: COLUMN
                  flex_align_main: center
                  flex_align_cross: center
                  pad_row: 12
                widgets:
                  - image:
                      id: image_notif_card_image
                      width: ${image_notif_card_size}px
                      height: ${image_notif_card_size}px
                      src: image_notification_image
                  - label:
                      id: image_notif_card_title
                      text: ""
                      text_font: ${setup_body_font_id}
                      text_color: 0xFFFFFF
                      long_mode: wrap
                      width: 100%
                  - label:
                      id: image_notif_card_message
                      text: ""
                      text_font: ${label_font}
                      text_color: 0xAAAAAA
                      long_mode: wrap
                      width: 100%

script:
  # Show the decoded image in the active style's group. Called from
  # on_download_finished once the loaded URL matches the expected URL.
  - id: image_notif_show
    mode: restart
    then:
      - script.stop: image_notif_autodismiss
      - lambda: |-
          const bool card = id(image_notif_style) == "card";

          // Captions (empty labels are hidden).
          lv_obj_t *title_lbl = card ? id(image_notif_card_title) : id(image_notif_fs_title);
          lv_obj_t *msg_lbl   = card ? id(image_notif_card_message) : id(image_notif_fs_message);
          if (id(image_notif_title).empty()) {
            lv_obj_add_flag(title_lbl, LV_OBJ_FLAG_HIDDEN);
          } else {
            lv_label_set_text(title_lbl, id(image_notif_title).c_str());
            lv_obj_clear_flag(title_lbl, LV_OBJ_FLAG_HIDDEN);
          }
          if (id(image_notif_message).empty()) {
            lv_obj_add_flag(msg_lbl, LV_OBJ_FLAG_HIDDEN);
          } else {
            lv_label_set_text(msg_lbl, id(image_notif_message).c_str());
            lv_obj_clear_flag(msg_lbl, LV_OBJ_FLAG_HIDDEN);
          }

          // Full-screen caption strip hides entirely when there is no text.
          if (!card) {
            if (id(image_notif_title).empty() && id(image_notif_message).empty()) {
              lv_obj_add_flag(id(image_notif_fs_caption), LV_OBJ_FLAG_HIDDEN);
            } else {
              lv_obj_clear_flag(id(image_notif_fs_caption), LV_OBJ_FLAG_HIDDEN);
            }
          }

          // Show the active group, hide the other.
          if (card) {
            lv_obj_add_flag(id(image_notif_fs_group), LV_OBJ_FLAG_HIDDEN);
            lv_obj_clear_flag(id(image_notif_card_group), LV_OBJ_FLAG_HIDDEN);
          } else {
            lv_obj_add_flag(id(image_notif_card_group), LV_OBJ_FLAG_HIDDEN);
            lv_obj_clear_flag(id(image_notif_fs_group), LV_OBJ_FLAG_HIDDEN);
          }
      # Refresh the active image widget from the decoded buffer.
      - lvgl.image.update:
          id: image_notif_fs_image
          src: image_notification_image
      - lvgl.image.update:
          id: image_notif_card_image
          src: image_notification_image
      # Reveal root above everything else, and mutually exclude the text popup.
      - lvgl.widget.hide: notification_scrim
      - lvgl.widget.show: image_notif_root
      - lambda: 'lv_obj_move_foreground(id(image_notif_root));'
      - if:
          condition:
            lambda: 'return id(image_notif_timeout) > 0;'
          then:
            - script.execute: image_notif_autodismiss

  # Auto-dismiss after image_notif_timeout seconds (expiring notifications only).
  - id: image_notif_autodismiss
    mode: restart
    then:
      - delay: !lambda 'return (uint32_t) id(image_notif_timeout) * 1000u;'
      - lambda: 'image_notification_fire("esphome.notification_expired");'
      - script.execute: image_notif_teardown

  # Hide the overlay and free the decode buffer.
  - id: image_notif_teardown
    mode: restart
    then:
      - lvgl.widget.hide: image_notif_root
      - lvgl.widget.hide: image_notif_fs_group
      - lvgl.widget.hide: image_notif_card_group
      - artwork_image.release: image_notification_image

  # Download/decode failed: free the buffer and hand off to the text popup with
  # the same title/message/timeout/message_id (localized "Image unavailable" if
  # there is no text). The text popup then owns dismissal and fires the events.
  - id: image_notif_fallback_to_text
    mode: restart
    then:
      - script.stop: image_notif_autodismiss
      - script.execute: image_notif_teardown
      - script.execute: screensaver_wake
      - lambda: |-
          std::string body = id(image_notif_message);
          if (id(image_notif_title).empty() && body.empty()) {
            body = espcontrol_i18n(std::string("Image unavailable"));
          }
          notification_popup_show(
            id(notification_scrim),
            id(notification_title_lbl),
            id(notification_body_lbl),
            id(image_notif_title), body,
            id(image_notif_timeout),
            s_image_notif_msg_id);

api:
  actions:
    - action: send_image_notification
      variables:
        image_url: string
        title: string
        message: string
        style: string
        message_id: string
      then:
        - script.execute: screensaver_wake
        - lambda: |-
            id(image_notif_title)   = title;
            id(image_notif_message) = message;
            id(image_notif_style)   = style.empty() ? std::string("fullscreen") : style;
            id(image_notif_timeout) = 0;
            image_notification_set_msg_id(message_id);
            std::string url = image_notification_resolve_url(
                image_url, id(cover_art_home_assistant_base_url));
            id(image_notif_expected_url) = url;
            auto *img = id(image_notification_image);
            if (id(image_notif_style) == "card") {
              img->set_target_size(${image_notif_card_size}, ${image_notif_card_size});
            } else {
              img->set_target_size(${image_notif_fullscreen_size}, ${image_notif_fullscreen_size});
            }
            img->request_update_url(url);
    - action: send_expiring_image_notification
      variables:
        image_url: string
        title: string
        message: string
        style: string
        timeout: int
        message_id: string
      then:
        - script.execute: screensaver_wake
        - lambda: |-
            id(image_notif_title)   = title;
            id(image_notif_message) = message;
            id(image_notif_style)   = style.empty() ? std::string("fullscreen") : style;
            id(image_notif_timeout) = timeout;
            image_notification_set_msg_id(message_id);
            std::string url = image_notification_resolve_url(
                image_url, id(cover_art_home_assistant_base_url));
            id(image_notif_expected_url) = url;
            auto *img = id(image_notification_image);
            if (id(image_notif_style) == "card") {
              img->set_target_size(${image_notif_card_size}, ${image_notif_card_size});
            } else {
              img->set_target_size(${image_notif_fullscreen_size}, ${image_notif_fullscreen_size});
            }
            img->request_update_url(url);
```

- [ ] **Step 3: Add substitutions to the 10" P4 device**

Edit `devices/guition-esp32-p4-jc8012p4a1/packages.yaml`. In the `substitutions:` block, immediately after the `cover_art_decode_size: "800"` line (~line 51), add:

```yaml
  image_notif_fullscreen_size: "${cover_art_decode_size}"
  image_notif_card_size: "520"
```

- [ ] **Step 4: Include the new screen on the 10" P4 device**

Edit `devices/guition-esp32-p4-jc8012p4a1/packages.yaml`. In the `packages:` block, immediately after the `screen_notification: !include ../../common/device/screen_notification_popup.yaml` line (~line 146), add:

```yaml
  screen_image_notification: !include ../../common/device/screen_image_notification.yaml
```

- [ ] **Step 5: Validate the config compiles**

Run: `esphome config devices/guition-esp32-p4-jc8012p4a1/dev.yaml`
Expected: exits 0 and prints the fully-rendered config with no errors. If it fails with a missing-secret error for `wifi_ssid`/`wifi_password`, create `devices/guition-esp32-p4-jc8012p4a1/secrets.yaml` with placeholder values (`wifi_ssid: "x"` / `wifi_password: "xxxxxxxx"`) and re-run — that is an environment gap, not a plan error.

- [ ] **Step 6: Commit**

```bash
git add components/espcontrol/image_notification_popup.h \
        common/device/screen_image_notification.yaml \
        devices/guition-esp32-p4-jc8012p4a1/packages.yaml
git commit -m "Add image notification popup module (10\" P4)"
```

---

### Task 2: Wire the remaining four devices

**Files:**
- Modify: `devices/esp32-p4-86/packages.yaml`
- Modify: `devices/guition-esp32-p4-jc1060p470/packages.yaml`
- Modify: `devices/guition-esp32-p4-jc4880p443/packages.yaml`
- Modify: `devices/guition-esp32-s3-4848s040/packages.yaml`

**Interfaces:**
- Consumes: the `screen_image_notification.yaml` module and its `image_notif_fullscreen_size` / `image_notif_card_size` substitution contract from Task 1.
- Produces: the two HA actions available on all five devices.

- [ ] **Step 1: Add substitutions + include to `esp32-p4-86`**

Edit `devices/esp32-p4-86/packages.yaml`. After the `cover_art_decode_size: "720"` line in `substitutions:`, add:

```yaml
  image_notif_fullscreen_size: "${cover_art_decode_size}"
  image_notif_card_size: "460"
```

Then, in `packages:`, after its `screen_notification: !include ../../common/device/screen_notification_popup.yaml` line, add:

```yaml
  screen_image_notification: !include ../../common/device/screen_image_notification.yaml
```

- [ ] **Step 2: Validate `esp32-p4-86`**

Run: `esphome config devices/esp32-p4-86/dev.yaml`
Expected: exits 0, no errors.

- [ ] **Step 3: Add substitutions + include to `guition-esp32-p4-jc1060p470`**

Edit `devices/guition-esp32-p4-jc1060p470/packages.yaml`. After `cover_art_decode_size: "600"`, add:

```yaml
  image_notif_fullscreen_size: "${cover_art_decode_size}"
  image_notif_card_size: "440"
```

Then, in `packages:`, after its `screen_notification:` include line, add:

```yaml
  screen_image_notification: !include ../../common/device/screen_image_notification.yaml
```

- [ ] **Step 4: Validate `guition-esp32-p4-jc1060p470`**

Run: `esphome config devices/guition-esp32-p4-jc1060p470/dev.yaml`
Expected: exits 0, no errors.

- [ ] **Step 5: Add substitutions + include to `guition-esp32-p4-jc4880p443`**

Edit `devices/guition-esp32-p4-jc4880p443/packages.yaml`. After `cover_art_decode_size: "480"`, add:

```yaml
  image_notif_fullscreen_size: "${cover_art_decode_size}"
  image_notif_card_size: "360"
```

Then, in `packages:`, after its `screen_notification:` include line, add:

```yaml
  screen_image_notification: !include ../../common/device/screen_image_notification.yaml
```

- [ ] **Step 6: Validate `guition-esp32-p4-jc4880p443`**

Run: `esphome config devices/guition-esp32-p4-jc4880p443/dev.yaml`
Expected: exits 0, no errors.

- [ ] **Step 7: Add substitutions + include to `guition-esp32-s3-4848s040`**

Edit `devices/guition-esp32-s3-4848s040/packages.yaml`. After `cover_art_decode_size: "320"`, add (the S3 is memory-constrained — keep both values at/under the cover-art budget):

```yaml
  image_notif_fullscreen_size: "${cover_art_decode_size}"
  image_notif_card_size: "300"
```

Then, in `packages:`, after its `screen_notification:` include line, add:

```yaml
  screen_image_notification: !include ../../common/device/screen_image_notification.yaml
```

- [ ] **Step 8: Validate `guition-esp32-s3-4848s040`**

Run: `esphome config devices/guition-esp32-s3-4848s040/dev.yaml`
Expected: exits 0, no errors.

- [ ] **Step 9: Commit**

```bash
git add devices/esp32-p4-86/packages.yaml \
        devices/guition-esp32-p4-jc1060p470/packages.yaml \
        devices/guition-esp32-p4-jc4880p443/packages.yaml \
        devices/guition-esp32-s3-4848s040/packages.yaml
git commit -m "Enable image notifications on remaining four devices"
```

---

### Task 3: Documentation

**Files:**
- Modify: `README.md` (the "Added Features" section, after the existing "HA-driven notification popups" entry)

**Interfaces:**
- Consumes: the finalized HA action names and parameters from Task 1.
- Produces: user-facing docs.

- [ ] **Step 1: Add the feature to README "Added Features"**

Edit `README.md`. Immediately after the "HA-driven notification popups" subsection (which ends before "Fully-local web UI"), insert:

```markdown
### HA-driven image notifications

Home Assistant can push an image to the screen — for example a doorbell camera
snapshot — using two new ESPHome API actions:

- `esphome.<device>_send_image_notification` — persistent, stays until tapped
- `esphome.<device>_send_expiring_image_notification` — auto-dismisses after `timeout` seconds

Both accept `image_url` (required; a relative HA path such as
`/api/camera_proxy/camera.front_door`, or any `http(s)` image URL), plus optional
`title`, `message`, `style` (`fullscreen` — the default — or `card`), and `message_id`.
The device downloads and decodes the image (JPEG/PNG); Home Assistant does all the
sourcing. Arriving notifications wake the screensaver. If the image can't be fetched
or decoded, the panel falls back to a text notification so the alert still gets through.
On dismiss the device fires `esphome.notification_acknowledged` or
`esphome.notification_expired`, carrying `device_name` and `message_id`, for HA correlation.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Document image notification actions in README"
```

---

### Task 4: Manual on-device verification

There is no automated harness for LVGL/firmware behavior, so verify on real hardware after flashing. This task has no code; it gates the feature as working.

**Files:** none.

- [ ] **Step 1: Flash a P4 device and a caption-capable HA automation**

Flash one P4 panel: `esphome run devices/guition-esp32-p4-jc8012p4a1/dev.yaml`. In HA Developer Tools → Actions, prepare calls to `esphome.<device>_send_image_notification` and the expiring variant.

- [ ] **Step 2: Run the presentation matrix**

For each combination, confirm the described result:

- `style: fullscreen`, valid `image_url`, with `title` + `message` → image fills/centers on black, caption strip at bottom shows both lines; tap dismisses.
- `style: card`, valid `image_url`, title only → framed card centered over dark scrim, image on top, title below, no message line.
- image-only (no `title`/`message`), fullscreen → image with no caption strip.
- expiring (`timeout: 10`) → auto-dismisses after ~10s without a tap.
- bad `image_url` (e.g. `/api/camera_proxy/camera.does_not_exist`) with `title` + `message` → after the stall/error, a **text** popup appears with the same title/message.
- bad `image_url`, image-only → text popup with body "Image unavailable".

- [ ] **Step 3: Confirm events reach HA**

In HA Developer Tools → Events, listen for `esphome.notification_acknowledged` and `esphome.notification_expired`. Tap-dismiss fires acknowledged; letting an expiring one time out fires expired. Both carry the `message_id` you sent.

- [ ] **Step 4: S3 memory soak**

Flash `guition-esp32-s3-4848s040` and send ~20 image notifications in a row (mix of fullscreen/card, dismissing each). Watch the memory-diagnostics sensor / logs for free-heap stability — it should return to baseline after each dismiss (buffer released), with no downward drift or allocation failures.

- [ ] **Step 5: Record results**

Note any failures against the matrix. If all pass, the feature is complete; proceed to the finishing-a-development-branch skill to open a PR against `wonderslug/espcontrol`.

---

## Notes for the implementer

- **Why the image widget size equals the decode size:** `set_target_size(n, n)` makes the decoder produce an `n×n` RGB565 buffer; the LVGL image widget is fixed at the same `n×n` (from the substitution) so the decoded buffer displays 1:1 with no runtime zoom math. `resize_mode` defaults to `FIT`, so a non-square camera frame is aspect-fit (letterboxed) inside that box — the whole frame stays visible.
- **Why `${image_notif_fullscreen_size}` reuses `${cover_art_decode_size}`:** that value is already tuned per device for heap safety (e.g. 320 on the S3, 800 on the 10" P4). Reusing it keeps the image-notification buffer within the same proven budget.
- **Race guard:** `image_notif_expected_url` is set on every new request. Both `on_download_finished` and `on_error` no-op unless the instance's loaded URL still equals it, so a late callback from a superseded request can't show or tear down the wrong popup.
- **Mutual exclusion:** showing an image notification hides `notification_scrim` (the text popup). The reverse (a text popup arriving over a visible image notification) is not force-hidden — an acceptable edge case for v1; both are top-layer and the newer is moved to the foreground.
```
