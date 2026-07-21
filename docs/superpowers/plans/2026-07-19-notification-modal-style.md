# Notification Modal Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third image-notification `style`, `"modal"`, that matches the app's shared control-modal look (inset rounded panel, top-right X close button), fills the panel edge-to-edge with the image, and overlays title/message text directly on the image using the camera card's duplicate-label "shadow text" technique instead of a background box.

**Architecture:** Reuse the plain, singleton-free styling helper functions from `components/espcontrol/button_grid_modal.h` (`control_modal_calc_layout`, `control_modal_card_radius`, `control_modal_create_round_button`, `control_modal_style_chrome_button`, `control_modal_style_translucent_chrome_button`) directly from `screen_image_notification.yaml`'s own C++ lambdas, without touching the `control_modal_*` singleton itself — the notification keeps its own independent overlay, timeout, and dismissal lifecycle. Add a new static widget subtree (`image_notif_modal_group`) sized/positioned at runtime, and two static duplicate-label pairs (shadow + real) for title/message, following the same paint-order trick `button_grid_image.h`'s camera-card label already uses, just expressed as static YAML widgets instead of a dynamically-rediscovered pooled pair.

**Tech Stack:** ESPHome YAML (LVGL 9 widgets, `artwork_image` external component), C++17 (ESP-IDF/Arduino via ESPHome codegen).

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-19-notification-modal-style-design.md` — read it before starting; it has the full rationale.
- No test framework exists for this codebase. Validation is `esphome config <path>` (schema/logic validation, seconds) and `esphome compile <path>` (full C++ build, several minutes — only run where a task specifically calls for it).
- Every `esphome` command below is run from the repo root (`/Users/brian/development/espcontrol`).
- Config-validate after every YAML-only task; compile-validate after every task that changes lambda/C++ text (`esphome config` alone does not catch C++ errors inside a lambda body).
- `card` style, and `fullscreen` style's existing `match`/`cover`/`fit` `image_sizing` modes, are unaffected by this whole feature. Do not touch that code path except where explicitly noted.
- **Task 3 is the highest-risk task in this plan.** `components/espcontrol/button_grid_modal.h` is not self-contained on its own — it only compiles when included after `button_grid_display.h`/`button_grid_style.h`/etc., which is why Task 3 adds `#include "button_grid.h"` (the full facade, per ADR `dev-docs/adr/0006-hybrid-compiled-firmware-modules.md`: "`button_grid.h` remains the supported include") rather than including `button_grid_modal.h` directly. Investigation during design couldn't conclusively determine, by static header inspection alone, whether this exact include is already available transitively in `screen_image_notification.yaml`'s translation unit — it's included defensively either way, since being explicit is strictly safer than assuming. If Task 3's compile surfaces a large number of unrelated, pre-existing errors deep inside other `button_grid_*.h` files (not involving anything this plan added), that means pulling in the full grid dashboard code surfaced a pre-existing problem out of scope for this feature — stop and report back rather than trying to fix it.
- Devices with `screen_image_notification.yaml` (6, all affected): `esp32-p4-86`, `guition-esp32-p4-jc8012p4a1`, `guition-esp32-p4-jc8012p4a1-v2`, `guition-esp32-s3-4848s040`, `guition-esp32-p4-jc4880p443`, `guition-esp32-p4-jc1060p470`.

---

## File Structure

- `common/device/screen_image_notification.yaml` — the whole feature: new widget subtree (Task 1), dismiss-script refactor (Task 2), runtime panel/image/close-button setup in both API actions (Task 4), and `image_notif_show`/`image_notif_teardown` branching (Task 5).
- `components/espcontrol/image_notification_popup.h` — gains `#include "button_grid.h"` and one small helper function that caches the modal close button's `lv_obj_t*` across calls (Task 3), following the exact pattern `button_grid_modal.h`'s own `control_modal_active()`/`image_card_modal_ui()` already use for the same purpose (a function-local `static`, not an ESPHome `globals:` entry — there's no precedent anywhere in this codebase for storing a raw pointer in `globals:`, and this file already has the equivalent idiom to copy).

No other files change. This feature needs no per-device substitutions (unlike the prior `match`-mode spec) because panel geometry comes entirely from the already-per-device-tuned `control_modal_calc_layout()`.

---

### Task 1: Static `modal` widget tree

**Files:**
- Modify: `common/device/screen_image_notification.yaml:231` (insert after `image_notif_card_group`, before `script:`)

**Interfaces:**
- Produces: widget IDs `image_notif_modal_group`, `image_notif_modal_frame`, `image_notif_modal_image`, `image_notif_modal_caption`, `image_notif_modal_title_row`, `image_notif_modal_title`, `image_notif_modal_title_shadow`, `image_notif_modal_message_row`, `image_notif_modal_message`, `image_notif_modal_message_shadow`. All hidden by default, at placeholder sizes — consumed and resized at runtime by Task 4, shown/hidden by Task 5.

- [ ] **Step 1: Read the current insertion point**

```bash
sed -n '218,233p' common/device/screen_image_notification.yaml
```

Expected output (current state — end of `image_notif_card_group`, then blank line, then `script:`):
```yaml
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
```

- [ ] **Step 2: Insert the new widget group**

Using the Edit tool, find:
```yaml
                  - label:
                      id: image_notif_card_message
                      text: ""
                      text_font: ${label_font}
                      text_color: 0xAAAAAA
                      long_mode: wrap
                      width: 100%

script:
```

Replace with:
```yaml
                  - label:
                      id: image_notif_card_message
                      text: ""
                      text_font: ${label_font}
                      text_color: 0xAAAAAA
                      long_mode: wrap
                      width: 100%
            # ---- Modal group: shared control-modal panel look, image fills the
            # panel edge-to-edge, text sits directly on it (no background box). ----
            - obj:
                id: image_notif_modal_group
                x: 0
                y: 0
                width: ${screen_width}
                height: ${screen_height}
                bg_opa: 0%
                radius: 0
                border_width: 0
                pad_all: 0
                scrollable: false
                scrollbar_mode: "off"
                clickable: false
                hidden: true
                widgets:
                  # Panel geometry (size/position/radius) is computed at runtime
                  # from control_modal_calc_layout() — see Task 4. These are
                  # just placeholder values so the widget tree is valid before
                  # the first notification resizes it.
                  - obj:
                      id: image_notif_modal_frame
                      x: 0
                      y: 0
                      width: 10px
                      height: 10px
                      bg_color: 0x1E1E1E
                      bg_opa: cover
                      radius: 18
                      border_width: 0
                      pad_all: 0
                      clip_corner: true
                      scrollable: false
                      widgets:
                        - image:
                            id: image_notif_modal_image
                            x: 0
                            y: 0
                            width: 10px
                            height: 10px
                            radius: 18
                            clip_corner: true
                            src: image_notification_image
                        - obj:
                            id: image_notif_modal_caption
                            align: bottom_left
                            width: 100%
                            height: SIZE_CONTENT
                            bg_opa: 0%
                            border_width: 0
                            pad_all: 0
                            scrollable: false
                            clickable: false
                            hidden: true
                            layout:
                              type: flex
                              flex_flow: COLUMN
                              pad_row: 6
                            widgets:
                              - obj:
                                  id: image_notif_modal_title_row
                                  width: 100%
                                  height: SIZE_CONTENT
                                  bg_opa: 0%
                                  border_width: 0
                                  pad_all: 0
                                  scrollable: false
                                  clickable: false
                                  hidden: true
                                  widgets:
                                    - label:
                                        id: image_notif_modal_title_shadow
                                        align: top_left
                                        x: 1
                                        y: 1
                                        text: ""
                                        text_font: ${setup_body_font_id}
                                        text_color: 0x000000
                                        text_opa: 50%
                                        long_mode: wrap
                                        width: 100%
                                    - label:
                                        id: image_notif_modal_title
                                        align: top_left
                                        x: 0
                                        y: 0
                                        text: ""
                                        text_font: ${setup_body_font_id}
                                        text_color: 0xFFFFFF
                                        long_mode: wrap
                                        width: 100%
                              - obj:
                                  id: image_notif_modal_message_row
                                  width: 100%
                                  height: SIZE_CONTENT
                                  bg_opa: 0%
                                  border_width: 0
                                  pad_all: 0
                                  scrollable: false
                                  clickable: false
                                  hidden: true
                                  widgets:
                                    - label:
                                        id: image_notif_modal_message_shadow
                                        align: top_left
                                        x: 1
                                        y: 1
                                        text: ""
                                        text_font: ${label_font}
                                        text_color: 0x000000
                                        text_opa: 50%
                                        long_mode: wrap
                                        width: 100%
                                    - label:
                                        id: image_notif_modal_message
                                        align: top_left
                                        x: 0
                                        y: 0
                                        text: ""
                                        text_font: ${label_font}
                                        text_color: 0xDDDDDD
                                        long_mode: wrap
                                        width: 100%

script:
```

- [ ] **Step 3: Validate**

```bash
esphome config devices/guition-esp32-s3-4848s040/esphome.yaml
```
Expected: ends with `INFO Configuration is valid!`. Nothing references these new
widgets yet, so this is a pure YAML/indentation/schema check — this is exactly
the step that would catch an indentation mistake in the deeply-nested block
above (compare against `image_notif_card_group`'s indentation if it fails).

If `text_opa: 50%` is rejected as an unknown key, that means this LVGL YAML
schema version doesn't support it declaratively. Fallback: remove the two
`text_opa: 50%` lines from the YAML above, and instead set them in Task 4's
lambda right after the widget tree first exists, e.g. immediately after the
close-button creation block:
```cpp
lv_obj_set_style_text_opa(id(image_notif_modal_title_shadow), LV_OPA_50, LV_PART_MAIN);
lv_obj_set_style_text_opa(id(image_notif_modal_message_shadow), LV_OPA_50, LV_PART_MAIN);
```

- [ ] **Step 4: Commit**

```bash
git add common/device/screen_image_notification.yaml
git commit -m "Add static widget tree for image notification modal style"
```

---

### Task 2: Extract tap-to-dismiss into a shared script

**Files:**
- Modify: `common/device/screen_image_notification.yaml:92-96` (`image_notif_root`'s `on_click`)
- Modify: `common/device/screen_image_notification.yaml:316-321` region (insert new script after `image_notif_autodismiss`)

**Interfaces:**
- Produces: script `image_notif_dismiss_tap` — stops autodismiss, fires `esphome.notification_acknowledged`, runs `image_notif_teardown`. Consumed by `image_notif_root`'s `on_click` (this task) and by the modal close button (Task 4).

- [ ] **Step 1: Replace `image_notif_root`'s inline `on_click` body**

Find:
```yaml
          on_click:
            then:
              - script.stop: image_notif_autodismiss
              - lambda: 'image_notification_fire("esphome.notification_acknowledged");'
              - script.execute: image_notif_teardown
```

Replace with:
```yaml
          on_click:
            then:
              - script.execute: image_notif_dismiss_tap
```

- [ ] **Step 2: Add the new script**

Find (the end of `image_notif_autodismiss`, right before `image_notif_teardown`):
```yaml
  # Auto-dismiss after image_notif_timeout seconds (expiring notifications only).
  - id: image_notif_autodismiss
    mode: restart
    then:
      - delay: !lambda 'return (uint32_t) id(image_notif_timeout) * 1000u;'
      - lambda: 'image_notification_fire("esphome.notification_expired");'
      - script.execute: image_notif_teardown

  # Hide the overlay and free the decode buffer.
  - id: image_notif_teardown
```

Replace with:
```yaml
  # Auto-dismiss after image_notif_timeout seconds (expiring notifications only).
  - id: image_notif_autodismiss
    mode: restart
    then:
      - delay: !lambda 'return (uint32_t) id(image_notif_timeout) * 1000u;'
      - lambda: 'image_notification_fire("esphome.notification_expired");'
      - script.execute: image_notif_teardown

  # Tap-anywhere-on-panel or X-button dismissal: acknowledge and tear down.
  # Shared by image_notif_root's on_click (all styles) and, for "modal" style,
  # the close button created in image_notif_modal_frame.
  - id: image_notif_dismiss_tap
    mode: restart
    then:
      - script.stop: image_notif_autodismiss
      - lambda: 'image_notification_fire("esphome.notification_acknowledged");'
      - script.execute: image_notif_teardown

  # Hide the overlay and free the decode buffer.
  - id: image_notif_teardown
```

- [ ] **Step 3: Validate**

```bash
esphome config devices/guition-esp32-s3-4848s040/esphome.yaml
```
Expected: `INFO Configuration is valid!`

```bash
esphome compile devices/guition-esp32-s3-4848s040/esphome.yaml
```
Expected: `INFO Successfully compiled program.` (proves the refactor is
behavior-preserving C++ — same three actions, just called through one more
level of indirection).

- [ ] **Step 4: Commit**

```bash
git add common/device/screen_image_notification.yaml
git commit -m "Extract notification tap-to-dismiss into a shared script"
```

---

### Task 3: `button_grid.h` include + close-button cache helper

**Files:**
- Modify: `components/espcontrol/image_notification_popup.h`

**Interfaces:**
- Produces: `inline lv_obj_t *&image_notif_modal_close_btn()` — returns a
  reference to a function-local `static lv_obj_t *`, initially `nullptr`,
  so callers can both read and assign through it
  (`image_notif_modal_close_btn() = ...`). Also makes every
  `button_grid_modal.h` symbol (`control_modal_calc_layout`,
  `control_modal_card_radius`, `control_modal_create_round_button`,
  `control_modal_style_chrome_button`,
  `control_modal_style_translucent_chrome_button`, `ControlModalLayout`, and
  the color constants `DARK_BORDER`/`SECONDARY_GREY`) visible to
  `screen_image_notification.yaml`'s lambdas. Consumed by Task 4.

- [ ] **Step 1: Read the current file**

```bash
cat components/espcontrol/image_notification_popup.h
```

Expected (current state, 39 lines):
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

- [ ] **Step 2: Add the include**

Find:
```cpp
#pragma once
#include <string>
#include "notification_popup.h"  // reuse notification_fire_event
```

Replace with:
```cpp
#pragma once
#include <string>
#include "notification_popup.h"  // reuse notification_fire_event
// Full grid-dashboard facade, not just button_grid_modal.h: button_grid_modal.h
// is not self-contained (it depends on types/constants from button_grid_display.h,
// button_grid_style.h, etc. that it doesn't include itself — see ADR
// dev-docs/adr/0006-hybrid-compiled-firmware-modules.md, "button_grid.h remains
// the supported include"). Reused here for the "modal" notification style's
// control_modal_* panel/chrome helpers.
#include "button_grid.h"
```

- [ ] **Step 3: Add the close-button cache helper**

Find the end of the file:
```cpp
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

Replace with (appending the new helper after it):
```cpp
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

// Lazily-created, cached close button for the "modal" notification style.
// Same pattern as control_modal_active() / image_card_modal_ui() in
// button_grid_modal.h / button_grid_image.h: a function-local static, not an
// ESPHome `globals:` entry — there's no precedent anywhere in this codebase
// for storing a raw lv_obj_t* in `globals:`, and both of those existing
// helpers already establish this exact idiom for the same kind of value.
inline lv_obj_t *&image_notif_modal_close_btn() {
  static lv_obj_t *btn = nullptr;
  return btn;
}
```

- [ ] **Step 4: Validate**

```bash
esphome config devices/guition-esp32-s3-4848s040/esphome.yaml
```
Expected: `INFO Configuration is valid!`

```bash
esphome compile devices/guition-esp32-s3-4848s040/esphome.yaml
```
Expected: `INFO Successfully compiled program.` This is the critical check —
see the Global Constraints note on Task 3 risk above. Nothing calls
`image_notif_modal_close_btn()` or any `control_modal_*` symbol yet, so a
successful compile here proves specifically that `#include "button_grid.h"`
itself is safe to add to this file (no redefinition/circular-include
errors), before Task 4 adds code that actually depends on its contents being
visible and correct.

If this fails with errors inside `button_grid_*.h` files unrelated to
anything in this task, stop and report back per the Global Constraints note
— do not attempt to fix pre-existing issues in unrelated card types.

- [ ] **Step 5: Commit**

```bash
git add components/espcontrol/image_notification_popup.h
git commit -m "Make control_modal_* helpers available to image notifications"
```

---

### Task 4: Runtime modal panel, image, and close-button setup

**Files:**
- Modify: `common/device/screen_image_notification.yaml:14-15` (header doc comment)
- Modify: `common/device/screen_image_notification.yaml:356-401` (`send_image_notification` action, exact line range before this plan's earlier tasks — locate by content, not line number, since Tasks 1-2 shifted things below their insertion points)
- Modify: `common/device/screen_image_notification.yaml:402-448` (`send_expiring_image_notification` action, same caveat)

**Interfaces:**
- Consumes: `image_notif_modal_close_btn()`, `control_modal_calc_layout()`,
  `control_modal_card_radius()`, `control_modal_create_round_button()`,
  `control_modal_style_chrome_button()`,
  `control_modal_style_translucent_chrome_button()` (Task 3);
  `image_notif_dismiss_tap` script (Task 2); widget IDs
  `image_notif_modal_frame`, `image_notif_modal_image`,
  `image_notif_modal_caption` (Task 1).
- Produces: for `style == "modal"`, `target_w`/`target_h`/`mode` set from the
  panel's own computed size (`ImageResizeMode::COVER`), and the modal panel
  fully positioned/sized/chromed — ready for Task 5 to reveal it.

- [ ] **Step 1: Update the header doc comment**

Find:
```yaml
#     style: "fullscreen"        # optional: "fullscreen" (default) | "card"
#     image_sizing: "match"      # optional, fullscreen style only: "match" (default, crops to fill a screen-aspect box) | "cover" (crops to fill a square box) | "fit" (shows whole image, tinted letterbox bars)
#                                 # card style always crops to fill its fixed square panel, regardless of image_sizing
```

Replace with:
```yaml
#     style: "fullscreen"        # optional: "fullscreen" (default) | "card" | "modal"
#     image_sizing: "match"      # optional, fullscreen style only: "match" (default, crops to fill a screen-aspect box) | "cover" (crops to fill a square box) | "fit" (shows whole image, tinted letterbox bars)
#                                 # card and modal styles always crop to fill their panel, regardless of image_sizing.
#                                 # modal style uses the same inset rounded panel as every other control modal in
#                                 # the app, with a top-right X close button and shadow-text title/message overlaid
#                                 # directly on the image (no background box).
```

- [ ] **Step 2: Rewrite `send_image_notification`'s lambda**

Find:
```yaml
        - lambda: |-
            id(image_notif_title)   = title;
            id(image_notif_message) = message;
            id(image_notif_style)   = style.empty() ? std::string("fullscreen") : style;
            id(image_notif_timeout) = 0;
            image_notification_set_msg_id(message_id);
            std::string url = image_notification_resolve_url(
                image_url, id(cover_art_home_assistant_base_url));
            auto *img = id(image_notification_image);
            bool card = id(image_notif_style) == "card";
            int target_w = ${image_notif_card_size};
            int target_h = ${image_notif_card_size};
            auto mode = esphome::artwork_image::ImageResizeMode::COVER;
            id(image_notif_used_fit) = false;
            if (!card) {
              if (image_sizing == "cover") {
                target_w = ${image_notif_fullscreen_size};
                target_h = ${image_notif_fullscreen_size};
              } else if (image_sizing == "fit") {
                target_w = ${image_notif_match_width};
                target_h = ${image_notif_match_height};
                mode = esphome::artwork_image::ImageResizeMode::FIT;
                id(image_notif_used_fit) = true;
              } else {
                target_w = ${image_notif_match_width};
                target_h = ${image_notif_match_height};
              }
              lv_obj_set_size(id(image_notif_fs_frame), target_w, target_h);
              lv_obj_set_size(id(image_notif_fs_image), target_w, target_h);
            }
            img->set_target_size(target_w, target_h);
            img->set_resize_mode(mode);
            id(image_notif_expected_url) = img->request_update_url(url);
            if (id(image_notif_expected_url).empty()) {
              id(image_notif_fallback_to_text).execute();
            }
```

Replace with:
```yaml
        - lambda: |-
            id(image_notif_title)   = title;
            id(image_notif_message) = message;
            id(image_notif_style)   = style.empty() ? std::string("fullscreen") : style;
            id(image_notif_timeout) = 0;
            image_notification_set_msg_id(message_id);
            std::string url = image_notification_resolve_url(
                image_url, id(cover_art_home_assistant_base_url));
            auto *img = id(image_notification_image);
            bool card = id(image_notif_style) == "card";
            bool modal = id(image_notif_style) == "modal";
            int target_w = ${image_notif_card_size};
            int target_h = ${image_notif_card_size};
            auto mode = esphome::artwork_image::ImageResizeMode::COVER;
            id(image_notif_used_fit) = false;
            if (modal) {
              auto layout = control_modal_calc_layout(100);
              target_w = layout.panel_w;
              target_h = layout.panel_h;
              lv_coord_t radius = control_modal_card_radius(nullptr);
              lv_obj_set_size(id(image_notif_modal_frame), target_w, target_h);
              lv_obj_set_pos(id(image_notif_modal_frame), layout.panel_x, layout.panel_y);
              lv_obj_set_style_radius(id(image_notif_modal_frame), radius, LV_PART_MAIN);
              lv_obj_set_size(id(image_notif_modal_image), target_w, target_h);
              lv_obj_set_style_radius(id(image_notif_modal_image), radius, LV_PART_MAIN);
              if (image_notif_modal_close_btn() == nullptr) {
                image_notif_modal_close_btn() = control_modal_create_round_button(
                    id(image_notif_modal_frame), 32, "\U000F0156",
                    id(font_icon_main)->get_lv_font(), DARK_BORDER, SECONDARY_GREY, 100);
                lv_obj_add_event_cb(image_notif_modal_close_btn(), [](lv_event_t *) {
                  id(image_notif_dismiss_tap).execute();
                }, LV_EVENT_CLICKED, nullptr);
              }
              control_modal_style_chrome_button(image_notif_modal_close_btn(), layout, true);
              control_modal_style_translucent_chrome_button(image_notif_modal_close_btn());
              lv_coord_t content_w = layout.panel_w - layout.inset * 2;
              if (content_w < 120) content_w = layout.panel_w;
              lv_obj_set_width(id(image_notif_modal_caption), content_w);
              lv_obj_align(id(image_notif_modal_caption), LV_ALIGN_BOTTOM_LEFT, layout.inset, -layout.inset);
            } else if (!card) {
              if (image_sizing == "cover") {
                target_w = ${image_notif_fullscreen_size};
                target_h = ${image_notif_fullscreen_size};
              } else if (image_sizing == "fit") {
                target_w = ${image_notif_match_width};
                target_h = ${image_notif_match_height};
                mode = esphome::artwork_image::ImageResizeMode::FIT;
                id(image_notif_used_fit) = true;
              } else {
                target_w = ${image_notif_match_width};
                target_h = ${image_notif_match_height};
              }
              lv_obj_set_size(id(image_notif_fs_frame), target_w, target_h);
              lv_obj_set_size(id(image_notif_fs_image), target_w, target_h);
            }
            img->set_target_size(target_w, target_h);
            img->set_resize_mode(mode);
            id(image_notif_expected_url) = img->request_update_url(url);
            if (id(image_notif_expected_url).empty()) {
              id(image_notif_fallback_to_text).execute();
            }
```

- [ ] **Step 3: Rewrite `send_expiring_image_notification`'s lambda**

Find:
```yaml
        - lambda: |-
            id(image_notif_title)   = title;
            id(image_notif_message) = message;
            id(image_notif_style)   = style.empty() ? std::string("fullscreen") : style;
            id(image_notif_timeout) = timeout;
            image_notification_set_msg_id(message_id);
            std::string url = image_notification_resolve_url(
                image_url, id(cover_art_home_assistant_base_url));
            auto *img = id(image_notification_image);
            bool card = id(image_notif_style) == "card";
            int target_w = ${image_notif_card_size};
            int target_h = ${image_notif_card_size};
            auto mode = esphome::artwork_image::ImageResizeMode::COVER;
            id(image_notif_used_fit) = false;
            if (!card) {
              if (image_sizing == "cover") {
                target_w = ${image_notif_fullscreen_size};
                target_h = ${image_notif_fullscreen_size};
              } else if (image_sizing == "fit") {
                target_w = ${image_notif_match_width};
                target_h = ${image_notif_match_height};
                mode = esphome::artwork_image::ImageResizeMode::FIT;
                id(image_notif_used_fit) = true;
              } else {
                target_w = ${image_notif_match_width};
                target_h = ${image_notif_match_height};
              }
              lv_obj_set_size(id(image_notif_fs_frame), target_w, target_h);
              lv_obj_set_size(id(image_notif_fs_image), target_w, target_h);
            }
            img->set_target_size(target_w, target_h);
            img->set_resize_mode(mode);
            id(image_notif_expected_url) = img->request_update_url(url);
            if (id(image_notif_expected_url).empty()) {
              id(image_notif_fallback_to_text).execute();
            }
```

Replace with (identical shape to Step 2, `id(image_notif_timeout) = timeout;` unchanged):
```yaml
        - lambda: |-
            id(image_notif_title)   = title;
            id(image_notif_message) = message;
            id(image_notif_style)   = style.empty() ? std::string("fullscreen") : style;
            id(image_notif_timeout) = timeout;
            image_notification_set_msg_id(message_id);
            std::string url = image_notification_resolve_url(
                image_url, id(cover_art_home_assistant_base_url));
            auto *img = id(image_notification_image);
            bool card = id(image_notif_style) == "card";
            bool modal = id(image_notif_style) == "modal";
            int target_w = ${image_notif_card_size};
            int target_h = ${image_notif_card_size};
            auto mode = esphome::artwork_image::ImageResizeMode::COVER;
            id(image_notif_used_fit) = false;
            if (modal) {
              auto layout = control_modal_calc_layout(100);
              target_w = layout.panel_w;
              target_h = layout.panel_h;
              lv_coord_t radius = control_modal_card_radius(nullptr);
              lv_obj_set_size(id(image_notif_modal_frame), target_w, target_h);
              lv_obj_set_pos(id(image_notif_modal_frame), layout.panel_x, layout.panel_y);
              lv_obj_set_style_radius(id(image_notif_modal_frame), radius, LV_PART_MAIN);
              lv_obj_set_size(id(image_notif_modal_image), target_w, target_h);
              lv_obj_set_style_radius(id(image_notif_modal_image), radius, LV_PART_MAIN);
              if (image_notif_modal_close_btn() == nullptr) {
                image_notif_modal_close_btn() = control_modal_create_round_button(
                    id(image_notif_modal_frame), 32, "\U000F0156",
                    id(font_icon_main)->get_lv_font(), DARK_BORDER, SECONDARY_GREY, 100);
                lv_obj_add_event_cb(image_notif_modal_close_btn(), [](lv_event_t *) {
                  id(image_notif_dismiss_tap).execute();
                }, LV_EVENT_CLICKED, nullptr);
              }
              control_modal_style_chrome_button(image_notif_modal_close_btn(), layout, true);
              control_modal_style_translucent_chrome_button(image_notif_modal_close_btn());
              lv_coord_t content_w = layout.panel_w - layout.inset * 2;
              if (content_w < 120) content_w = layout.panel_w;
              lv_obj_set_width(id(image_notif_modal_caption), content_w);
              lv_obj_align(id(image_notif_modal_caption), LV_ALIGN_BOTTOM_LEFT, layout.inset, -layout.inset);
            } else if (!card) {
              if (image_sizing == "cover") {
                target_w = ${image_notif_fullscreen_size};
                target_h = ${image_notif_fullscreen_size};
              } else if (image_sizing == "fit") {
                target_w = ${image_notif_match_width};
                target_h = ${image_notif_match_height};
                mode = esphome::artwork_image::ImageResizeMode::FIT;
                id(image_notif_used_fit) = true;
              } else {
                target_w = ${image_notif_match_width};
                target_h = ${image_notif_match_height};
              }
              lv_obj_set_size(id(image_notif_fs_frame), target_w, target_h);
              lv_obj_set_size(id(image_notif_fs_image), target_w, target_h);
            }
            img->set_target_size(target_w, target_h);
            img->set_resize_mode(mode);
            id(image_notif_expected_url) = img->request_update_url(url);
            if (id(image_notif_expected_url).empty()) {
              id(image_notif_fallback_to_text).execute();
            }
```

- [ ] **Step 4: Validate**

```bash
esphome config devices/guition-esp32-s3-4848s040/esphome.yaml
esphome config devices/guition-esp32-p4-jc8012p4a1/esphome.yaml
```
Expected: both end with `INFO Configuration is valid!`

```bash
esphome compile devices/guition-esp32-s3-4848s040/esphome.yaml
```
Expected: `INFO Successfully compiled program.` This proves
`control_modal_calc_layout`/`control_modal_card_radius`/
`control_modal_create_round_button`/`control_modal_style_chrome_button`/
`control_modal_style_translucent_chrome_button`/`ControlModalLayout`/
`DARK_BORDER`/`SECONDARY_GREY`/`id(font_icon_main)` all resolve correctly
from this file, and that the new lambda branches compile.

- [ ] **Step 5: Commit**

```bash
git add common/device/screen_image_notification.yaml
git commit -m "Add modal style runtime panel, image, and close-button setup"
```

---

### Task 5: Reveal/hide the modal group and update its text

**Files:**
- Modify: `common/device/screen_image_notification.yaml` (`image_notif_show` script, and `image_notif_teardown` script)

**Interfaces:**
- Consumes: widget IDs from Task 1, `card`/`modal` style distinction pattern
  from Task 4.

- [ ] **Step 1: Rewrite the caption/show logic in `image_notif_show`**

Find:
```yaml
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
```

Replace with:
```yaml
      - lambda: |-
          const bool card = id(image_notif_style) == "card";
          const bool modal = id(image_notif_style) == "modal";

          if (modal) {
            const bool has_title = !id(image_notif_title).empty();
            const bool has_message = !id(image_notif_message).empty();
            lv_label_set_text(id(image_notif_modal_title), id(image_notif_title).c_str());
            lv_label_set_text(id(image_notif_modal_title_shadow), id(image_notif_title).c_str());
            lv_label_set_text(id(image_notif_modal_message), id(image_notif_message).c_str());
            lv_label_set_text(id(image_notif_modal_message_shadow), id(image_notif_message).c_str());
            if (has_title) {
              lv_obj_clear_flag(id(image_notif_modal_title_row), LV_OBJ_FLAG_HIDDEN);
            } else {
              lv_obj_add_flag(id(image_notif_modal_title_row), LV_OBJ_FLAG_HIDDEN);
            }
            if (has_message) {
              lv_obj_clear_flag(id(image_notif_modal_message_row), LV_OBJ_FLAG_HIDDEN);
            } else {
              lv_obj_add_flag(id(image_notif_modal_message_row), LV_OBJ_FLAG_HIDDEN);
            }
            if (has_title || has_message) {
              lv_obj_clear_flag(id(image_notif_modal_caption), LV_OBJ_FLAG_HIDDEN);
            } else {
              lv_obj_add_flag(id(image_notif_modal_caption), LV_OBJ_FLAG_HIDDEN);
            }
          } else {
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
          }

          // Show the active group, hide the other two.
          lv_obj_add_flag(id(image_notif_fs_group), LV_OBJ_FLAG_HIDDEN);
          lv_obj_add_flag(id(image_notif_card_group), LV_OBJ_FLAG_HIDDEN);
          lv_obj_add_flag(id(image_notif_modal_group), LV_OBJ_FLAG_HIDDEN);
          if (modal) {
            lv_obj_clear_flag(id(image_notif_modal_group), LV_OBJ_FLAG_HIDDEN);
          } else if (card) {
            lv_obj_clear_flag(id(image_notif_card_group), LV_OBJ_FLAG_HIDDEN);
          } else {
            lv_obj_clear_flag(id(image_notif_fs_group), LV_OBJ_FLAG_HIDDEN);
          }
```

(The accent-tint `if` block right after this, keyed on
`id(image_notif_style) != "card" && id(image_notif_used_fit)`, needs no
change — `modal` never sets `image_notif_used_fit`, set to `false`
unconditionally at the top of both API actions, so that block is already a
no-op for `modal` style.)

- [ ] **Step 2: Refresh the modal image widget too**

Find:
```yaml
      # Refresh the active image widget from the decoded buffer.
      - lvgl.image.update:
          id: image_notif_fs_image
          src: image_notification_image
      - lvgl.image.update:
          id: image_notif_card_image
          src: image_notification_image
```

Replace with:
```yaml
      # Refresh the active image widget from the decoded buffer.
      - lvgl.image.update:
          id: image_notif_fs_image
          src: image_notification_image
      - lvgl.image.update:
          id: image_notif_card_image
          src: image_notification_image
      - lvgl.image.update:
          id: image_notif_modal_image
          src: image_notification_image
```

- [ ] **Step 3: Hide the modal group on teardown**

Find:
```yaml
  - id: image_notif_teardown
    mode: restart
    then:
      - lvgl.widget.hide: image_notif_root
      - lvgl.widget.hide: image_notif_fs_group
      - lvgl.widget.hide: image_notif_card_group
      - artwork_image.release: image_notification_image
```

Replace with:
```yaml
  - id: image_notif_teardown
    mode: restart
    then:
      - lvgl.widget.hide: image_notif_root
      - lvgl.widget.hide: image_notif_fs_group
      - lvgl.widget.hide: image_notif_card_group
      - lvgl.widget.hide: image_notif_modal_group
      - artwork_image.release: image_notification_image
```

- [ ] **Step 4: Validate**

```bash
esphome config devices/guition-esp32-s3-4848s040/esphome.yaml
```
Expected: `INFO Configuration is valid!`

```bash
esphome compile devices/guition-esp32-s3-4848s040/esphome.yaml
```
Expected: `INFO Successfully compiled program.`

- [ ] **Step 5: Commit**

```bash
git add common/device/screen_image_notification.yaml
git commit -m "Wire modal style into image_notif_show and teardown"
```

---

### Task 6: Full validation across all devices

**Files:** none (validation only)

- [ ] **Step 1: Config-validate every device**

```bash
esphome config devices/esp32-p4-86/esphome.yaml
esphome config devices/guition-esp32-p4-jc8012p4a1/esphome.yaml
esphome config devices/guition-esp32-p4-jc8012p4a1-v2/esphome.yaml
esphome config devices/guition-esp32-s3-4848s040/esphome.yaml
esphome config devices/guition-esp32-p4-jc4880p443/esphome.yaml
esphome config devices/guition-esp32-p4-jc1060p470/esphome.yaml
```
Expected: all six end with `INFO Configuration is valid!`

- [ ] **Step 2: Compile a portrait device (different `control_modal_calc_layout` tuning than the square/landscape devices already compiled)**

```bash
esphome compile devices/guition-esp32-p4-jc4880p443/esphome.yaml
```
Expected: `INFO Successfully compiled program.`

- [ ] **Step 3: Compile one more landscape P4 device, for breadth**

```bash
esphome compile devices/guition-esp32-p4-jc1060p470/esphome.yaml
```
Expected: `INFO Successfully compiled program.`

- [ ] **Step 4: Report what needs on-device (manual) verification**

No further automated step — flag to the user that these need a real device
flash to visually confirm, per the spec's testing plan:
- `modal` style panel geometry matches other control modals' look (inset,
  rounded corners) on both a square/landscape device and the portrait
  `jc4880p443`.
- Image fills the panel edge-to-edge with no letterbox bars, cropped center,
  using a source image with a different aspect ratio than the panel.
- Title/message text is readable against both a bright and a dark region of
  a test image; the 1px shadow offset is visible on close inspection but not
  distracting at normal viewing distance.
- X button dismisses and fires `esphome.notification_acknowledged`; tapping
  elsewhere on the panel also dismisses and fires the same event.
- An expiring `modal`-style notification still auto-dismisses and fires
  `esphome.notification_expired` after `timeout` seconds.
- `fullscreen` and `card` styles are visually unchanged from before this
  feature.

- [ ] **Step 5: Commit (only if any fixups were needed above)**

If Steps 1-3 all passed with no changes needed, there's nothing to commit —
this task is validation-only. If a fix was needed, commit it with a message
describing what validation caught.
