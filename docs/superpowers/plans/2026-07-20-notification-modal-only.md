# Image Notifications: Modal-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `fullscreen` and `card` image-notification styles entirely, leaving `modal` as the only rendering path, with `image_sizing` still offering `cover`/`fit` (no `match`).

**Architecture:** This is a deletion-focused simplification of already-implemented, already-reviewed code — no new mechanics. Work top-to-bottom through what currently branches on `style`/`card`/`modal`, collapsing each branch point to its `modal`-only body, in an order where every intermediate commit still compiles (script logic simplified first, then the API surface, then the now-fully-unreferenced widgets, then the now-fully-unreferenced per-device substitutions).

**Tech Stack:** ESPHome YAML (LVGL 9 widgets, `artwork_image` external component), C++17 (ESP-IDF/Arduino via ESPHome codegen).

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-20-notification-modal-only-design.md` — read it before starting; it has the full rationale and the exact removal inventory.
- No test framework exists for this codebase. Validation is `esphome config <path>` (schema/logic validation, seconds) and `esphome compile <path>` (full C++ build, several minutes — only run where a task specifically calls for it).
- Every `esphome` command below is run from the repo root of this worktree (`/Users/brian/development/espcontrol/.worktrees/notification-modal-style`).
- **Task order matters and must not be reordered or parallelized.** Each task removes references before a later task removes the thing being referenced (script logic before the API surface that sets it, both before the widgets they touch, widgets before the substitutions only they used). Running them out of order will produce a broken intermediate state (`esphome config`/`compile` failures from dangling references).
- Devices affected (all 6 currently including `screen_image_notification.yaml`): `esp32-p4-86`, `guition-esp32-p4-jc8012p4a1`, `guition-esp32-p4-jc8012p4a1-v2`, `guition-esp32-s3-4848s040`, `guition-esp32-p4-jc4880p443`, `guition-esp32-p4-jc1060p470`.
- The two untracked `localdev/*/packages.yaml` personal test configs (gitignored) are out of scope — do not touch them.

---

## File Structure

- `common/device/screen_image_notification.yaml` — all four code-removal tasks (script simplification, API de-branch + header rewrite, widget-tree removal).
- `devices/*/packages.yaml` (6 files) — dead substitution removal.

No files are created. No files outside these are touched (verified during design: no other tracked file references `image_notif_style`, `image_notif_fullscreen_size`, `image_notif_card_size`, `image_notif_match_width`, `image_notif_match_height`, or the `image_notif_fs_*`/`image_notif_card_*` widget IDs).

---

### Task 1: Simplify `image_notif_show` and `image_notif_teardown`

**Files:**
- Modify: `common/device/screen_image_notification.yaml` (`image_notif_show` script, `image_notif_teardown` script)

**Interfaces:**
- Consumes: nothing new — same widget IDs (`image_notif_modal_*`) and globals (`image_notif_title`, `image_notif_message`, `image_notif_used_fit`, `image_notif_timeout`) already in place from the prior `modal`-style work.
- Produces: `image_notif_show` no longer reads `id(image_notif_style)` anywhere, and no longer references `image_notif_fs_*`/`image_notif_card_*` widget IDs. `image_notif_teardown` only hides `image_notif_root`. This leaves `image_notif_fs_group`/`image_notif_card_group` widgets fully unreferenced (still declared, to be deleted in Task 3) and `image_notif_style` fully unreferenced *within this script* (still declared and still written by the API actions, to be deleted in Task 2) — both are safe, valid intermediate states.

- [ ] **Step 1: Collapse `image_notif_show`'s card/modal branch**

Find:
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
      # Tint FIT-mode letterbox padding with a color sampled from the image
      # itself, instead of leaving it at the decode buffer's default black.
      - if:
          condition:
            lambda: 'return id(image_notif_style) != "card" && id(image_notif_used_fit);'
          then:
```

Replace with:
```yaml
      - lambda: |-
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
      # Tint FIT-mode letterbox padding with a color sampled from the image
      # itself, instead of leaving it at the decode buffer's default black.
      - if:
          condition:
            lambda: 'return id(image_notif_used_fit);'
          then:
```

- [ ] **Step 2: Drop the now-obsolete `fs`/`card` image refreshes**

Find:
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

Replace with:
```yaml
      # Refresh the image widget from the decoded buffer.
      - lvgl.image.update:
          id: image_notif_modal_image
          src: image_notification_image
```

- [ ] **Step 3: Simplify `image_notif_teardown`**

Find:
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

Replace with:
```yaml
  - id: image_notif_teardown
    mode: restart
    then:
      - lvgl.widget.hide: image_notif_root
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
Expected: `INFO Successfully compiled program.` (`image_notif_fs_group`/`image_notif_card_group`/`image_notif_style` are all still declared elsewhere in the file at this point, just unreferenced by this script now — that's fine, ESPHome doesn't error on unused-but-declared LVGL widgets or globals.)

- [ ] **Step 5: Commit**

```bash
git add common/device/screen_image_notification.yaml
git commit -m "Simplify image_notif_show/teardown to modal-only"
```

---

### Task 2: Remove `style` from the API and de-branch the actions

**Files:**
- Modify: `common/device/screen_image_notification.yaml` (header doc-comment, `globals:` block, both `api.actions` lambdas)

**Interfaces:**
- Consumes: nothing new.
- Produces: `send_image_notification`/`send_expiring_image_notification` no longer accept `style`. Neither reads nor writes `id(image_notif_style)` anywhere — combined with Task 1, this makes `image_notif_style` fully unreferenced everywhere in the file, so its `globals:` declaration is removed in this same task. `image_notif_fs_frame`/`image_notif_fs_image` become fully unreferenced too (their only remaining references were in the now-deleted `else if (!card)` branch), ready for Task 3 to delete the widgets.

- [ ] **Step 1: Rewrite the header doc-comment**

Find:
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
#     style: "fullscreen"        # optional: "fullscreen" (default) | "card" | "modal"
#     image_sizing: "match"      # optional: fullscreen style: "match" (default, crops to fill a screen-aspect box) | "cover" (crops to fill a square box) | "fit" (shows whole image, tinted letterbox bars)
#                                 # modal style: "cover" (default, crops to fill the panel) | "fit" (shows whole image, tinted letterbox bars) — same two options as the camera card's modal view
#                                 # card style always crops to fill its fixed square panel, regardless of image_sizing.
#                                 # modal style uses the same inset rounded panel as every other control modal in
#                                 # the app, with a top-right X close button and shadow-text title/message overlaid
#                                 # directly on the image (no background box).
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
```

Replace with:
```yaml
# =============================================================================
# SCREEN: IMAGE NOTIFICATION POPUP
# =============================================================================
# Top-layer overlay that shows an HA-pushed image (e.g. a doorbell camera
# snapshot) in the same inset rounded panel every other control modal in the
# app uses, with a top-right X close button and shadow-text title/message
# overlaid directly on the image (no background box). The device only
# receives a URL; HA does all image sourcing.
#
# Persistent (tap to dismiss):
#   action: esphome.<device>_send_image_notification
#   data:
#     image_url: "/api/camera_proxy/camera.front_door"   # required; relative or http(s)
#     title: "Front Door"        # optional
#     message: "Motion detected" # optional
#     image_sizing: "cover"      # optional: "cover" (default, crops to fill the panel) | "fit" (shows whole image, tinted letterbox bars)
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
```

- [ ] **Step 2: Remove the `image_notif_style` global**

Find:
```yaml
globals:
  - id: image_notif_style
    type: std::string
    initial_value: '"fullscreen"'
  - id: image_notif_timeout
    type: int
    initial_value: '0'
```

Replace with:
```yaml
globals:
  - id: image_notif_timeout
    type: int
    initial_value: '0'
```

- [ ] **Step 3: De-branch `send_image_notification`**

Find:
```yaml
    - action: send_image_notification
      variables:
        image_url: string
        title: string
        message: string
        style: string
        image_sizing: string
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
              if (image_sizing == "fit") {
                mode = esphome::artwork_image::ImageResizeMode::FIT;
                id(image_notif_used_fit) = true;
              } else {
                mode = esphome::artwork_image::ImageResizeMode::COVER;
              }
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

Replace with:
```yaml
    - action: send_image_notification
      variables:
        image_url: string
        title: string
        message: string
        image_sizing: string
        message_id: string
      then:
        - script.execute: screensaver_wake
        - lambda: |-
            id(image_notif_title)   = title;
            id(image_notif_message) = message;
            id(image_notif_timeout) = 0;
            image_notification_set_msg_id(message_id);
            std::string url = image_notification_resolve_url(
                image_url, id(cover_art_home_assistant_base_url));
            auto *img = id(image_notification_image);
            auto layout = control_modal_calc_layout(100);
            int target_w = layout.panel_w;
            int target_h = layout.panel_h;
            auto mode = esphome::artwork_image::ImageResizeMode::COVER;
            id(image_notif_used_fit) = false;
            if (image_sizing == "fit") {
              mode = esphome::artwork_image::ImageResizeMode::FIT;
              id(image_notif_used_fit) = true;
            }
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
            img->set_target_size(target_w, target_h);
            img->set_resize_mode(mode);
            id(image_notif_expected_url) = img->request_update_url(url);
            if (id(image_notif_expected_url).empty()) {
              id(image_notif_fallback_to_text).execute();
            }
```

- [ ] **Step 4: De-branch `send_expiring_image_notification`**

Find:
```yaml
    - action: send_expiring_image_notification
      variables:
        image_url: string
        title: string
        message: string
        style: string
        image_sizing: string
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
              if (image_sizing == "fit") {
                mode = esphome::artwork_image::ImageResizeMode::FIT;
                id(image_notif_used_fit) = true;
              } else {
                mode = esphome::artwork_image::ImageResizeMode::COVER;
              }
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

Replace with:
```yaml
    - action: send_expiring_image_notification
      variables:
        image_url: string
        title: string
        message: string
        image_sizing: string
        timeout: int
        message_id: string
      then:
        - script.execute: screensaver_wake
        - lambda: |-
            id(image_notif_title)   = title;
            id(image_notif_message) = message;
            id(image_notif_timeout) = timeout;
            image_notification_set_msg_id(message_id);
            std::string url = image_notification_resolve_url(
                image_url, id(cover_art_home_assistant_base_url));
            auto *img = id(image_notification_image);
            auto layout = control_modal_calc_layout(100);
            int target_w = layout.panel_w;
            int target_h = layout.panel_h;
            auto mode = esphome::artwork_image::ImageResizeMode::COVER;
            id(image_notif_used_fit) = false;
            if (image_sizing == "fit") {
              mode = esphome::artwork_image::ImageResizeMode::FIT;
              id(image_notif_used_fit) = true;
            }
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
            img->set_target_size(target_w, target_h);
            img->set_resize_mode(mode);
            id(image_notif_expected_url) = img->request_update_url(url);
            if (id(image_notif_expected_url).empty()) {
              id(image_notif_fallback_to_text).execute();
            }
```

- [ ] **Step 5: Validate**

```bash
esphome config devices/guition-esp32-s3-4848s040/esphome.yaml
esphome config devices/guition-esp32-p4-jc8012p4a1/esphome.yaml
```
Expected: both end with `INFO Configuration is valid!`

```bash
esphome compile devices/guition-esp32-s3-4848s040/esphome.yaml
```
Expected: `INFO Successfully compiled program.`

- [ ] **Step 6: Commit**

```bash
git add common/device/screen_image_notification.yaml
git commit -m "Remove style parameter from image notification actions"
```

---

### Task 3: Remove the `fullscreen`/`card` widget trees

**Files:**
- Modify: `common/device/screen_image_notification.yaml` (widget tree under `image_notif_root`)

**Interfaces:**
- Consumes: nothing — by the end of Task 2, `image_notif_fs_group`/`image_notif_card_group` and everything inside them are completely unreferenced anywhere in the file.
- Produces: only `image_notif_modal_group` remains as a child of `image_notif_root`. `image_notif_modal_group` is now permanently visible (no `hidden` flag) — its visibility follows `image_notif_root`'s alone.

- [ ] **Step 1: Delete the `fs_group`/`card_group` widget subtrees**

Find:
```yaml
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
                  # LVGL 9 only clips an image's own pixels if radius + clip_corner
                  # are set on the image widget itself, not just its parent — so
                  # both the frame and the image get matching radius + clip_corner.
                  - obj:
                      id: image_notif_fs_frame
                      align: center
                      width: ${image_notif_fullscreen_size}px
                      height: ${image_notif_fullscreen_size}px
                      bg_opa: 0%
                      border_width: 0
                      pad_all: 0
                      radius: $radius
                      clip_corner: true
                      scrollable: false
                      widgets:
                        - image:
                            id: image_notif_fs_image
                            align: center
                            width: ${image_notif_fullscreen_size}px
                            height: ${image_notif_fullscreen_size}px
                            radius: $radius
                            clip_corner: true
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
                  # No rounding here — only the card panel itself is rounded;
                  # the image inside it keeps square corners.
                  - obj:
                      id: image_notif_card_frame
                      width: ${image_notif_card_size}px
                      height: ${image_notif_card_size}px
                      bg_opa: 0%
                      border_width: 0
                      pad_all: 0
                      radius: 0
                      scrollable: false
                      widgets:
                        - image:
                            id: image_notif_card_image
                            align: center
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
            # ---- Modal group: shared control-modal panel look, image fills the
```

Replace with:
```yaml
            # ---- Modal group: shared control-modal panel look, image fills the
```

- [ ] **Step 2: Drop `image_notif_modal_group`'s `hidden` flag**

Find:
```yaml
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
```

Replace with:
```yaml
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
                widgets:
```

- [ ] **Step 3: Validate**

```bash
esphome config devices/guition-esp32-s3-4848s040/esphome.yaml
```
Expected: `INFO Configuration is valid!` — this is the step that would catch a broken indentation join from Step 1's deletion (compare the join point against Step 1's "Replace with" if it fails).

```bash
esphome compile devices/guition-esp32-s3-4848s040/esphome.yaml
```
Expected: `INFO Successfully compiled program.`

- [ ] **Step 4: Commit**

```bash
git add common/device/screen_image_notification.yaml
git commit -m "Remove fullscreen/card widget trees from image notification"
```

---

### Task 4: Remove dead per-device substitutions

**Files:**
- Modify: `devices/esp32-p4-86/packages.yaml`
- Modify: `devices/guition-esp32-p4-jc8012p4a1/packages.yaml`
- Modify: `devices/guition-esp32-p4-jc8012p4a1-v2/packages.yaml`
- Modify: `devices/guition-esp32-s3-4848s040/packages.yaml`
- Modify: `devices/guition-esp32-p4-jc4880p443/packages.yaml`
- Modify: `devices/guition-esp32-p4-jc1060p470/packages.yaml`

**Interfaces:**
- Consumes: nothing — by the end of Task 3, none of these substitutions are referenced anywhere in `screen_image_notification.yaml`.
- Produces: nothing new. Pure dead-code removal.

Each device has the identical 4-line block, immediately after
`cover_art_live_image_updates: "false"` and immediately before a blank line
then `packages:`. Only the values differ per device.

- [ ] **Step 1: `esp32-p4-86`**

Find:
```yaml
  cover_art_live_image_updates: "false"
  image_notif_fullscreen_size: "${cover_art_decode_size}"
  image_notif_card_size: "460"
  image_notif_match_width: "${image_notif_fullscreen_size}"
  image_notif_match_height: "${image_notif_fullscreen_size}"

packages:
```
Replace with:
```yaml
  cover_art_live_image_updates: "false"

packages:
```

- [ ] **Step 2: `guition-esp32-p4-jc8012p4a1`**

Find:
```yaml
  cover_art_live_image_updates: "false"
  image_notif_fullscreen_size: "${cover_art_decode_size}"
  image_notif_card_size: "520"
  image_notif_match_width: "960"
  image_notif_match_height: "600"

packages:
```
Replace with:
```yaml
  cover_art_live_image_updates: "false"

packages:
```

- [ ] **Step 3: `guition-esp32-p4-jc8012p4a1-v2`**

Find:
```yaml
  cover_art_live_image_updates: "false"
  image_notif_fullscreen_size: "${cover_art_decode_size}"
  image_notif_card_size: "520"
  image_notif_match_width: "960"
  image_notif_match_height: "600"

packages:
```
Replace with:
```yaml
  cover_art_live_image_updates: "false"

packages:
```

- [ ] **Step 4: `guition-esp32-s3-4848s040`**

Find:
```yaml
  cover_art_live_image_updates: "false"
  image_notif_fullscreen_size: "400"
  image_notif_card_size: "300"
  image_notif_match_width: "${image_notif_fullscreen_size}"
  image_notif_match_height: "${image_notif_fullscreen_size}"

packages:
```
Replace with:
```yaml
  cover_art_live_image_updates: "false"

packages:
```

- [ ] **Step 5: `guition-esp32-p4-jc4880p443`**

Find:
```yaml
  cover_art_live_image_updates: "false"
  image_notif_fullscreen_size: "${cover_art_decode_size}"
  image_notif_card_size: "360"
  image_notif_match_width: "${image_notif_fullscreen_size}"
  image_notif_match_height: "${image_notif_fullscreen_size}"

packages:
```
Replace with:
```yaml
  cover_art_live_image_updates: "false"

packages:
```

- [ ] **Step 6: `guition-esp32-p4-jc1060p470`**

Find:
```yaml
  cover_art_live_image_updates: "false"
  image_notif_fullscreen_size: "${cover_art_decode_size}"
  image_notif_card_size: "440"
  image_notif_match_width: "784"
  image_notif_match_height: "460"

packages:
```
Replace with:
```yaml
  cover_art_live_image_updates: "false"

packages:
```

- [ ] **Step 7: Validate all 6**

```bash
esphome config devices/esp32-p4-86/esphome.yaml
esphome config devices/guition-esp32-p4-jc8012p4a1/esphome.yaml
esphome config devices/guition-esp32-p4-jc8012p4a1-v2/esphome.yaml
esphome config devices/guition-esp32-s3-4848s040/esphome.yaml
esphome config devices/guition-esp32-p4-jc4880p443/esphome.yaml
esphome config devices/guition-esp32-p4-jc1060p470/esphome.yaml
```
Expected: all six end with `INFO Configuration is valid!`

- [ ] **Step 8: Commit**

```bash
git add devices/esp32-p4-86/packages.yaml devices/guition-esp32-p4-jc8012p4a1/packages.yaml devices/guition-esp32-p4-jc8012p4a1-v2/packages.yaml devices/guition-esp32-s3-4848s040/packages.yaml devices/guition-esp32-p4-jc4880p443/packages.yaml devices/guition-esp32-p4-jc1060p470/packages.yaml
git commit -m "Remove dead fullscreen/card/match substitutions"
```

---

### Task 5: Full validation across all devices

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

- [ ] **Step 2: Compile a portrait device (different `control_modal_calc_layout` tuning than what's already been compiled)**

```bash
esphome compile devices/guition-esp32-p4-jc4880p443/esphome.yaml
```
Expected: `INFO Successfully compiled program.`

- [ ] **Step 3: Compile the other landscape P4 device, for breadth**

```bash
esphome compile devices/guition-esp32-p4-jc1060p470/esphome.yaml
```
Expected: `INFO Successfully compiled program.`

- [ ] **Step 4: Report what needs on-device (manual) verification**

No further automated step — flag to the user that this needs a real device
flash to visually confirm, per the spec's testing plan:
- `send_image_notification` (and the expiring variant) with no `style`
  field at all renders the modal panel correctly — same panel geometry,
  image fill, shadow-text title/message, close button, and dismiss
  behavior already verified working on this branch before this plan.
- `image_sizing: "cover"` (and omitted) crops to fill; `image_sizing:
  "fit"` shows the whole image with the accent-tinted letterbox — both
  already verified working, just re-confirm reachable without `style`.
- Sending a notification that still includes an old `style: "fullscreen"`
  or `style: "card"` field is rejected by Home Assistant at the action-call
  level (unknown field), since the field no longer exists on the action —
  confirm this fails loudly rather than silently, so anyone with an old
  automation notices immediately rather than getting a confusing result.

- [ ] **Step 5: Commit (only if any fixups were needed above)**

If Steps 1-3 all passed with no changes needed, there's nothing to commit —
this task is validation-only. If a fix was needed, commit it with a message
describing what validation caught.
