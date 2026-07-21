# Image notifications: modal-only

## Context

`common/device/screen_image_notification.yaml` currently supports three
`style` values: `"fullscreen"` (default), `"card"`, and `"modal"` (added in
`docs/superpowers/specs/2026-07-19-notification-modal-style-design.md`,
implemented on this branch). `fullscreen` supports three `image_sizing`
modes (`match`/`cover`/`fit`); `card` ignores `image_sizing`; `modal`
supports two (`cover`/`fit`, added in the follow-up commit
`a375a190d` on this same branch).

Decision: drop `fullscreen` and `card` entirely. `modal` becomes the only
way an image notification renders — there is no longer a `style` to choose.
This is a simplification, not a new feature: the modal rendering path
already exists, is already implemented and reviewed, and needs no changes
to its own mechanics. This spec is about deletion — removing the two
styles that are no longer wanted, and everything that only existed to
support them.

## Goals

- Remove the `style` variable from `send_image_notification` and
  `send_expiring_image_notification` entirely (breaking change to the HA
  action signature — acceptable since this whole feature is unreleased on
  an unmerged branch, nothing external depends on it yet).
- `image_sizing` keeps exactly its current two `modal`-style values:
  `"cover"` (default) and `"fit"`. `"match"` is gone — it was only ever a
  `fullscreen`-style concept, and `fullscreen` no longer exists.
- Remove the `image_notif_fs_group` and `image_notif_card_group` widget
  subtrees, all `card`/`fullscreen` branching in both API action lambdas
  and in `image_notif_show`, and the `image_notif_style` global (nothing
  left to compare it against).
- Remove the now-dead per-device substitutions `image_notif_fullscreen_size`,
  `image_notif_card_size`, `image_notif_match_width`,
  `image_notif_match_height` from all 6 devices' `packages.yaml`.
- Drop `image_notif_modal_group`'s own `hidden`/show-hide toggle — with
  only one group left, its visibility can just always follow
  `image_notif_root`'s (see Runtime mechanics).
- Rewrite the header doc-comment for the simpler API surface.

## Non-goals

- No change to the modal panel/chrome/close-button/shadow-text mechanics
  themselves — already implemented and reviewed, untouched by this spec.
- No change to the accent-tint machinery itself (`extract_accent_color_rgb565`/
  `paint_padding`/`darken_accent_color`) — only its gating condition
  simplifies (see Runtime mechanics), the mechanism is unchanged.
- No change to dismiss/autodismiss/teardown/fallback-to-text behavior.
- Not adopting the camera card modal's LVGL-level `lv_image_set_inner_align`
  layer (or its zoom-based pre-2026.4 fallback) — confirmed unnecessary
  during design: that machinery exists specifically to handle a stale
  lower-res preview showing before the camera modal's full-res image
  arrives, and image notifications have no such case (they stay hidden
  until the image is fully decoded). The existing buffer-baked
  `ArtworkImage` resize is already the same underlying technique the
  camera modal uses at that level.
- Not renaming widget/script IDs (`image_notif_modal_group`,
  `image_notif_modal_frame`, `image_notif_modal_close_btn`, etc.) to drop
  the now-redundant `_modal` infix. Cosmetic, not worth the diff churn on
  already-working code.
- Not touching the two untracked `localdev/*/packages.yaml` personal test
  configs — they're gitignored, not part of the codebase this spec covers.
  Their now-unused substitution lines are harmless if left in place.
- Not editing the two prior spec/plan docs
  (`2026-07-17-notification-image-sizing-design.md`,
  `2026-07-19-notification-modal-style-design.md` and their paired plans) —
  they're a historical record of decisions made at the time, not living
  documentation. This spec supersedes their content going forward.

## What gets removed

### Widget trees (`common/device/screen_image_notification.yaml`)

The entire `image_notif_fs_group` subtree (`image_notif_fs_frame`,
`image_notif_fs_image`, `image_notif_fs_caption`, `image_notif_fs_title`,
`image_notif_fs_message`) and the entire `image_notif_card_group` subtree
(`image_notif_card_frame`, `image_notif_card_image`,
`image_notif_card_title`, `image_notif_card_message`) — currently lines
100-233 (~135 lines), immediately before the `image_notif_modal_group`
block. `image_notif_modal_group` and everything inside it is untouched
structurally, except for the one change described in Runtime mechanics
below (dropping its own `hidden`/toggle).

### Globals

`image_notif_style` (`std::string`, currently lines 36-38) — removed
entirely. `image_notif_used_fit`, `image_notif_timeout`, `image_notif_title`,
`image_notif_message`, `image_notif_expected_url` are all still needed,
unchanged.

### Per-device substitutions (all 6 devices' `packages.yaml`)

Each device currently has this 4-line block (exact current values):

| device | fullscreen_size | card_size | match_width | match_height |
|---|---|---|---|---|
| `esp32-p4-86` | `${cover_art_decode_size}` | `460` | `${image_notif_fullscreen_size}` | `${image_notif_fullscreen_size}` |
| `guition-esp32-p4-jc8012p4a1` | `${cover_art_decode_size}` | `520` | `960` | `600` |
| `guition-esp32-p4-jc8012p4a1-v2` | `${cover_art_decode_size}` | `520` | `960` | `600` |
| `guition-esp32-s3-4848s040` | `400` | `300` | `${image_notif_fullscreen_size}` | `${image_notif_fullscreen_size}` |
| `guition-esp32-p4-jc4880p443` | `${cover_art_decode_size}` | `360` | `${image_notif_fullscreen_size}` | `${image_notif_fullscreen_size}` |
| `guition-esp32-p4-jc1060p470` | `${cover_art_decode_size}` | `440` | `784` | `460` |

All four lines are deleted, per device — each block sits cleanly between
the device's `cover_art_*` substitutions and the blank line before
`packages:`, so removal is a clean 4-line deletion with no reflow needed.

## Runtime mechanics

### API actions

Both `send_image_notification` and `send_expiring_image_notification` lose
the `style: string` variable. Their lambdas collapse from the current
three-way `bool card` / `bool modal` / `else if (!card)` structure to a
single unconditional path — everything that's currently inside `if (modal)
{ ... }` becomes the whole body (minus the `bool card`/`bool modal`
declarations and the now-deleted `else if (!card) { ... }` branch and its
`target_w`/`target_h` default-to-card-size initialization, which no longer
applies since there's no card fallback size to default to):

```cpp
id(image_notif_title)   = title;
id(image_notif_message) = message;
id(image_notif_timeout) = 0;  // or `timeout` in the expiring variant
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

This is a straightforward de-branching, not new logic — every line already
exists in today's `if (modal) { ... }` block; the only removed statements
are the `bool card`/`bool modal` declarations, the `else if (!card) { ... }`
branch, and the `int target_w = ${image_notif_card_size}; int target_h =
${image_notif_card_size};` defaults that existed only to seed the deleted
card/fullscreen branch.

### `image_notif_show`

Collapses similarly: the `const bool card`/`const bool modal` split and the
`if (modal) { ... } else { ... }` structure both go away — the current
`if (modal) { ... }` body becomes the whole caption-handling block
unconditionally. The "show the active group, hide the other two" section
is deleted outright (see next paragraph). The `lvgl.image.update` calls for
`image_notif_fs_image` and `image_notif_card_image` are removed, keeping
only `image_notif_modal_image`'s.

`image_notif_modal_group`'s widget declaration drops its `hidden: true`
default — it becomes a permanently-visible child of `image_notif_root`,
which is itself already hidden by default and only shown/hidden by
`image_notif_show`/`image_notif_teardown`. Since `image_notif_root` fully
gates when the popup (and therefore its one remaining child) is visible,
`image_notif_modal_group` needs no independent visibility state.
Consequently `image_notif_teardown`'s `lvgl.widget.hide:
image_notif_modal_group` line is also removed (only `image_notif_root`'s
hide remains meaningful).

### Accent-tint gate

The condition guarding the accent-tint block simplifies from:

```cpp
lambda: 'return id(image_notif_style) != "card" && id(image_notif_used_fit);'
```

to:

```cpp
lambda: 'return id(image_notif_used_fit);'
```

The block's body (accent extraction + `paint_padding` call) is unchanged.

### Header doc-comment

Rewritten to describe the simpler API — no `style`, `image_sizing` only
documents `cover`/`fit`, and the panel/chrome/shadow-text description moves
out of being a `modal`-style-specific note (since it's just how the popup
looks now) into the main description.

## Testing plan

- `esphome config` on all 6 devices (schema/substitution validation —
  catches any leftover reference to a deleted substitution).
- `esphome compile` on at least one S3 device and one P4 device, to catch
  C++ errors from the de-branched lambdas.
- Manual on-device verification (by the user): a `send_image_notification`
  call with no `style` field (and no `image_sizing`, and with each of
  `"cover"`/`"fit"`) still renders correctly — same modal panel, image
  fill, shadow-text, close button, and dismiss behavior already verified
  working on this branch, just reached without a `style` parameter.
