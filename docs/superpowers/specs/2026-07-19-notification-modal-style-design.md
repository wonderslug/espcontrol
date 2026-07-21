# Notification image sizing: `modal` style

## Context

Upstream PR feedback on the image notification popup
(`common/device/screen_image_notification.yaml`) asked for a presentation
closer to the rest of the app's control modals (camera card, climate, media,
etc.), rather than the current `fullscreen`/`card` styles:

> - I think this should use the modal pattern (full screen card rather than
>   partial overlay)
> - I would add a X close control for the top right
> - Rather than use a box overlay, I would use the same text effect used on
>   the camera card (duplicate text in dark colour, 1px offset, with some
>   transparency). I think this is readable against most content.
> - Change the image to fill the space, like the camera card modal view.

Every other modal in the app (climate, media, alarm, the camera/image card's
own fullscreen view, etc.) is built from one shared helper,
`control_modal_open_shell()` (`components/espcontrol/button_grid_modal.h:751`).
It gives an inset, rounded panel with a circular chrome button, and it owns a
global "one modal at a time" singleton (`control_modal_active()`,
`button_grid_modal.h:111`) with no auto-dismiss timer.

Image notifications are architecturally different: they're HA-push-triggered
(not user-tap-triggered), need an auto-dismiss timeout for expiring
notifications, carry a `message_id` that gets echoed back in ack/expire
events, and fall back to the text notification popup on download/decode
failure. They must also be able to appear over anything else on screen,
including an open control modal. Plugging them into the control-modal
singleton would require reconciling two independent lifecycle/dismissal
systems for no real benefit — so this spec keeps notifications on their own
overlay and instead **reuses the shared modal's styling helpers directly**
(they're plain functions with no dependency on the singleton) to get a
pixel-identical look.

This adds a third `style` value, `"modal"`, alongside the existing
`"fullscreen"` (default) and `"card"`. `card` style is untouched by this
spec. `fullscreen`'s existing `image_sizing` modes (`match`/`cover`/`fit`,
added in `docs/superpowers/specs/2026-07-17-notification-image-sizing-design.md`)
are also untouched.

## Goals

- Add `"modal"` as a new `style` value for `send_image_notification` and
  `send_expiring_image_notification`.
- Panel geometry matches every other control modal exactly: inset, rounded
  corners, per-device compact/portrait tuning — computed via the same
  `control_modal_calc_layout()` used by `control_modal_open_shell()`.
- A top-right "X" close button, same round/translucent visual treatment as
  the camera modal's back button, just top-right-aligned with the close
  glyph instead of the back chevron.
- `modal` style honors `image_sizing`, same two options the camera card's
  own modal view offers: `cover` (default — crop to fill the panel
  edge-to-edge, no letterbox) and `fit` (show the whole image, tinted
  letterbox bars — reusing the existing accent-tint mechanism built for
  `fullscreen`'s `fit` mode). `match` and unrecognized values fall back to
  `cover`. `image_sizing` remains ignored for `card` style.
- Title/message text sits directly on the image with no background box,
  using the same duplicate-label "shadow text" technique the camera card
  label already uses: a black, 50%-opacity copy offset 1px right/down,
  painted behind the real (white/light-grey) text.
- Tap-anywhere-on-panel dismiss is kept (existing behavior), and the new X
  button is an additional way to dismiss. Auto-dismiss timeout for expiring
  notifications applies independently of either.

## Non-goals

- No loading spinner / no "reveal immediately, then load" behavior. `modal`
  style stays hidden until the image has finished downloading and decoding,
  same `on_download_finished` gate `fullscreen`/`card` already use today.
- No change to `card` style, or to `fullscreen`'s `match`/`cover`/`fit`
  `image_sizing` modes.
- No change to the accent-tinted letterbox mechanism itself (extraction/
  painting logic) — `modal`'s `fit` mode reuses it as-is, unmodified.
- Not plugging into the `control_modal_*` singleton (`ControlModalKind`,
  `control_modal_active()`, etc.) — see Context. Only the plain styling
  helper functions are reused.
- Devices: this applies to all 6 devices currently including
  `screen_image_notification.yaml` (`esp32-p4-86`,
  `guition-esp32-p4-jc8012p4a1`, `guition-esp32-p4-jc8012p4a1-v2`,
  `guition-esp32-s3-4848s040`, `guition-esp32-p4-jc4880p443`,
  `guition-esp32-p4-jc1060p470`) — this list has grown since the prior spec
  (`jc8012p4a1-v2` now has `image_notif_match_width`/`height` substitutions
  and is included).

## Panel & chrome

New widget group `image_notif_modal_group`, a sibling of the existing
`image_notif_fs_group` / `image_notif_card_group` inside
`image_notif_root`. Declared in YAML with placeholder size/position (like
`image_notif_fs_frame`/`image_notif_fs_image` already are), then sized and
positioned at runtime in the `send_image_notification` /
`send_expiring_image_notification` action lambdas:

```cpp
auto layout = control_modal_calc_layout(/*width_compensation_percent=*/100);
lv_coord_t radius = control_modal_card_radius(nullptr);  // no source card; falls back to grid default (18)

lv_obj_set_size(id(image_notif_modal_frame), layout.panel_w, layout.panel_h);
lv_obj_set_pos(id(image_notif_modal_frame), layout.panel_x, layout.panel_y);
lv_obj_set_style_radius(id(image_notif_modal_frame), radius, LV_PART_MAIN);

lv_obj_set_size(id(image_notif_modal_image), layout.panel_w, layout.panel_h);
lv_obj_set_style_radius(id(image_notif_modal_image), radius, LV_PART_MAIN);
```

`control_modal_calc_layout()` (`button_grid_modal.h:533`) and
`control_modal_card_radius()` (`button_grid_modal.h:501`) are plain
functions — they read the active display's resolution and the device's
`DisplayModalProfile` (set once at boot from `cfg.modal_profile` in each
device's `sensors.yaml`), with no dependency on `control_modal_active()`.
Calling them from the notification's own lambda is safe and requires no
changes to those functions.

Close button, built the same way `control_modal_open_shell()` builds its
own chrome button (`button_grid_modal.h:784-798`), but forced to the
top-right "close" variant and given the translucent-over-photo treatment the
camera modal's back button uses:

```cpp
lv_obj_t *close_btn = control_modal_create_round_button(
    id(image_notif_modal_frame), 32, "\U000F0156" /* close glyph */,
    id(font_icon_main)->get_lv_font(), DARK_BORDER, SECONDARY_GREY, 100);
control_modal_style_chrome_button(close_btn, layout, /*top_right=*/true);
control_modal_style_translucent_chrome_button(close_btn);
```

The button is created lazily on the first `modal`-style send, parented
directly to `image_notif_modal_frame`, with its `on_click` wired once at
creation time (see Dismiss behavior below). It's cached in a global
(`lv_obj_t *image_notif_modal_close = nullptr`) rather than recreated on
every open, but `control_modal_style_chrome_button()` /
`control_modal_style_translucent_chrome_button()` still re-run on every open
to reposition it — panel geometry can change between notifications if the
screen has rotated (e.g. `jc4880p443`'s `screen_rotation_select`) in the
meantime.

## Image fill

Buffer-baked `ImageResizeMode`, target size = `layout.panel_w` ×
`layout.panel_h` in both cases — the same technique `fullscreen` style's
`cover`/`fit` modes already use (`ArtworkImage::resize_()`,
`components/artwork_image/artwork_image.cpp:592`), just with the panel's
own computed size instead of a fixed square or the match-mode table:

- `image_sizing == "fit"` → `ImageResizeMode::FIT`, `image_notif_used_fit`
  set `true`. The existing accent-tint block in `image_notif_show`
  (gated on `style != "card" && used_fit`) fires automatically — `modal`
  qualifies on that same condition, no new gating logic needed — so `fit`
  mode's letterbox bars get the same per-image accent-color tinting
  `fullscreen`'s `fit` mode already has, for free.
- anything else (default `"cover"`, `"match"`, empty/unrecognized) →
  `ImageResizeMode::COVER`, `image_notif_used_fit` stays `false`.

No LVGL-level second alignment layer (`lv_image_set_inner_align` /
zoom-based cover) is needed for either mode — that machinery exists in the
camera modal specifically to handle a stale lower-res preview showing
before the full-res image arrives, and `modal` style has no such case
(Non-goals: no loading-spinner/preview reveal).

## Text overlay ("shadow text")

Two label pairs, declared as static YAML widgets (not the dynamic
child-scanning discovery pattern in `button_grid_image.h:1136`
`image_card_label_shadow`, which exists to re-find a shadow label across
repeated re-binds of a pooled/reused grid card slot — not needed here since
these are fixed, uniquely-IDed widgets that are never destroyed):

```yaml
- obj:
    id: image_notif_modal_caption
    align: bottom_left
    # re-aligned at runtime via lv_obj_align(..., LV_ALIGN_BOTTOM_LEFT,
    # layout.inset, -layout.inset) — offset depends on per-device layout
    width: 100%          # resized at runtime to content width
    height: SIZE_CONTENT
    layout:
      type: flex
      flex_flow: COLUMN
      pad_row: 6
    widgets:
      - obj:               # title row — plain (non-flex) so children can overlap via align
          id: image_notif_modal_title_row
          height: SIZE_CONTENT
          widgets:
            - label:
                id: image_notif_modal_title_shadow
                align: top_left
                x: 1
                y: 1
                text_color: 0x000000
                text_opa: 50%
            - label:
                id: image_notif_modal_title
                align: top_left
                text_color: 0xFFFFFF
      - obj:               # message row, same pattern
          id: image_notif_modal_message_row
          height: SIZE_CONTENT
          widgets:
            - label:
                id: image_notif_modal_message_shadow
                align: top_left
                x: 1
                y: 1
                text_color: 0x000000
                text_opa: 50%
            - label:
                id: image_notif_modal_message
                align: top_left
                text_color: 0xDDDDDD
```

The outer `image_notif_modal_caption` uses flex `COLUMN` to stack the title
row above the message row; each row itself has no layout, so its two child
labels keep the plain `align` positioning that makes the shadow sit exactly
1px behind the real text (mirrors `image_card_align_label`/
`image_card_align_label_stack`, `button_grid_image.h:1170-1202`, just
expressed as static offsets since there's no dynamic re-parenting to
account for). Declaring the shadow label before the real label in each row
means the real label paints on top, same painting-order reasoning
`image_card_align_label_stack` relies on.

Setting title/message text touches both twins in each pair (4
`lv_label_set_text` calls total instead of today's 2). A row hides via
`lv_obj_add_flag(row, LV_OBJ_FLAG_HIDDEN)` when its text is empty, same
show/hide behavior as today's `image_notif_fs_title`/`_message`.

Width and position: `image_notif_modal_caption` is resized/re-aligned at
runtime alongside the panel — width = `layout.panel_w - layout.inset * 2`
(clamped to `layout.panel_w` if that's below 120px, mirroring
`control_modal_open_shell`'s `shell.content_w` calculation,
`button_grid_modal.h:764-765`), aligned `layout.inset` in from the panel's
bottom-left corner via `lv_obj_align(..., LV_ALIGN_BOTTOM_LEFT,
layout.inset, -layout.inset)`.

## Dismiss behavior

The existing `image_notif_root` tap-anywhere-to-dismiss handler
(`common/device/screen_image_notification.yaml:92-96`) is factored into a
new script, `image_notif_dismiss_tap` (stop autodismiss, fire
`esphome.notification_acknowledged`, run `image_notif_teardown` — the exact
three actions currently inline on `image_notif_root`'s `on_click`).
`image_notif_root`'s `on_click` calls this script, and the new close
button's `on_click` calls the same script — so both paths behave
identically. Auto-dismiss (`image_notif_autodismiss`,
`screen_image_notification.yaml:316-321`) is unaffected and continues to
apply independently for expiring notifications, regardless of `style`.

## Runtime mechanics

`image_notif_style` gains a third valid value, `"modal"`. In
`send_image_notification`/`send_expiring_image_notification`
(`screen_image_notification.yaml:356-401`, `402-448`), a new branch:

```cpp
bool modal = id(image_notif_style) == "modal";
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
  // size/position image_notif_modal_frame, image_notif_modal_image,
  // image_notif_modal_close, image_notif_modal_caption as described above
} else if (!card) {
  // existing cover/fit/match branches, unchanged
}
```

`image_notif_show` (`screen_image_notification.yaml:236-314`) gains a third
branch alongside `card`/`!card`: reveal `image_notif_modal_group`, hide the
other two groups. The accent-tint-the-letterbox block
(`screen_image_notification.yaml:278-297`) stays gated on `style != "card"
&& used_fit`, unchanged — `modal` now satisfies that condition whenever it
was opened with `image_sizing: "fit"`, so the tint applies there too
without any change to the gating logic itself.

`image_notif_teardown` (`screen_image_notification.yaml:324-330`) gains
`lvgl.widget.hide: image_notif_modal_group` alongside the existing
`fs_group`/`card_group` hides.

One open item to confirm during implementation: which existing include
already brings `button_grid_modal.h`'s helpers into scope for
`screen_image_notification.yaml`'s lambdas (the file doesn't currently
`#include` it explicitly, and tracing the exact mechanism through the
component's header graph wasn't conclusive from static inspection alone —
the whole grid dashboard clearly depends on `button_grid_modal.h` being
available in generated device code, so this is very likely a non-issue, but
it needs an explicit `esphome compile` check rather than an assumption).

## Testing plan

- `esphome config` on all 6 affected devices (schema/substitution
  validation).
- `esphome compile` on at least one S3 device and one P4 device to catch
  C++ errors in the new lambda code and confirm `button_grid_modal.h`
  helpers are reachable from `screen_image_notification.yaml` (see open item
  above).
- Manual on-device verification (by the user) of:
  - `modal` style: panel geometry matches other modals' look (inset,
    rounded corners) on both a square/landscape device and the portrait
    `jc4880p443`.
  - `modal` + `image_sizing: "cover"` (or omitted): image fills the panel
    edge-to-edge with no letterbox bars, cropped center, on a source image
    with a different aspect ratio than the panel.
  - `modal` + `image_sizing: "fit"`: whole image visible, letterbox bars
    tinted to match the image (not solid black), no visible seam at the
    padding boundary — same visual check as `fullscreen`'s `fit` mode.
  - Title/message text is readable against both a bright and a dark region
    of a test image, with the shadow offset visible on close inspection but
    not distracting at normal viewing distance.
  - X button dismisses and fires `esphome.notification_acknowledged`; tap
    elsewhere on the panel also dismisses and fires the same event.
  - Expiring `modal`-style notification still auto-dismisses and fires
    `esphome.notification_expired` after `timeout` seconds.
  - `fullscreen` and `card` styles unchanged from today.
