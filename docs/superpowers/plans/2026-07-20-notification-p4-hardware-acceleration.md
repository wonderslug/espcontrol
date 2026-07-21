# Notification P4 Hardware Acceleration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable P4 hardware acceleration (`priority: MODAL`, `p4_pipeline: MODAL`) for the image-notification popup's download, paired with the source-resolution capping and memory-availability guard camera cards already use, so it's safe at near-full-panel target sizes on every device.

**Architecture:** Reuse four existing, already P4/S3-safe helper functions from `components/espcontrol/button_grid_image.h` (`image_card_sized_url`, `image_card_limit_target_size`, `image_card_memory_available`, plus the `IMAGE_CARD_MODAL_MAX_TARGET_SIDE_PX` constant they use internally) directly from `screen_image_notification.yaml`'s two API-action lambdas — no new C++ logic, no per-device branching. Add two static config keys to the `artwork_image:` resource.

**Tech Stack:** ESPHome YAML (`artwork_image` external component), C++17 (ESP-IDF/Arduino via ESPHome codegen).

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-07-20-notification-p4-hardware-acceleration-design.md` — read it before starting; it has the full rationale.
- No test framework exists for this codebase. Validation is `esphome config <path>` (schema/logic validation, seconds) and `esphome compile <path>` (full C++ build, several minutes — only run where a task specifically calls for it).
- **Critical — validate against `dev.yaml`, never bare `esphome.yaml`.** Each
  tracked device's `devices/<slug>/esphome.yaml` is the *published* entry
  point: its `packages: setup: url: https://github.com/wonderslug/espcontrol/`
  fetches `packages.yaml` (and everything it includes — `common/`,
  `components/`) from the real GitHub remote, cached locally and **not**
  refreshed reliably even with `refresh: 1s` in this environment. Running
  `esphome config`/`compile` against `esphome.yaml` silently validates
  whatever was last pushed to GitHub, completely ignoring local worktree
  edits — confirmed empirically by appending a deliberate YAML syntax error
  to a local file and observing `esphome config devices/<slug>/esphome.yaml`
  still report "Configuration is valid!". Each device also has its own
  `devices/<slug>/dev.yaml` ("Local development entry point" — see its own
  header comment), which uses `packages: espcontrol: !include packages.yaml`
  (a fully local include chain) plus its own `device/device.yaml`'s
  `external_components:` git-fetch (which the `-s` overrides below target).
  **Every validation command in this plan must run against `dev.yaml`, from
  inside that device's own directory, with these two substitution
  overrides:**
  ```bash
  cd devices/<slug>
  esphome \
    -s espcontrol_component_url "file:///Users/brian/development/espcontrol/.worktrees/notification-modal-style" \
    -s espcontrol_component_ref "$(git -C /Users/brian/development/espcontrol/.worktrees/notification-modal-style rev-parse HEAD)" \
    config dev.yaml   # or: compile dev.yaml
  ```
  Substitute the actual worktree path if it differs from the one shown.
- All four reused functions (`image_card_sized_url`, `image_card_limit_target_size`, `image_card_memory_available`, and the constant `IMAGE_CARD_MODAL_MAX_TARGET_SIDE_PX`) are defined in `components/espcontrol/button_grid_image.h` and are already reachable from `screen_image_notification.yaml`'s lambdas via the `#include "button_grid.h"` chain (`button_grid.h` → `button_grid_grid.h` → `button_grid_image.h`) already present in `components/espcontrol/image_notification_popup.h` — no new include is needed anywhere.
- `image_card_memory_available()` accepts a nullable `ImageCardCtx *ctx` (used only for optional diagnostic logging — `components/espcontrol/button_grid_image.h:189` early-returns on null, and the warning log at lines 613-617 null-guards every `ctx` dereference). Call it with `nullptr`.
- The decode/display target size (`target_w`/`target_h`, passed to `img->set_target_size()`) stays at full panel dimensions (`layout.panel_w`/`layout.panel_h`) — do not cap it. Only the *requested* download URL's size hint is capped. This is a deliberate difference from the camera modal's own call pattern (which caps its target size too, relying on an LVGL-level upscale layer this notification code intentionally doesn't have — see the design spec's Context section).
- Devices affected (all 6 currently including `screen_image_notification.yaml`): `esp32-p4-86`, `guition-esp32-p4-jc8012p4a1`, `guition-esp32-p4-jc8012p4a1-v2`, `guition-esp32-s3-4848s040`, `guition-esp32-p4-jc4880p443`, `guition-esp32-p4-jc1060p470`.

---

## File Structure

- `common/device/screen_image_notification.yaml` — the whole change: two new config keys on the `artwork_image:` resource, and one new block of C++ inserted identically into both `send_image_notification` and `send_expiring_image_notification`'s lambdas.

No other files change. No new files are created.

---

### Task 1: Enable P4 acceleration with capping + memory guard

**Files:**
- Modify: `common/device/screen_image_notification.yaml` (`artwork_image:` resource, both `api.actions` lambdas)

**Interfaces:**
- Consumes: `image_card_sized_url(const std::string &url, lv_coord_t width, lv_coord_t height) -> std::string`, `image_card_limit_target_size(lv_coord_t source_width, lv_coord_t source_height, int *target_width, int *target_height) -> void`, `image_card_memory_available(ImageCardCtx *ctx, const char *stage, int width, int height) -> bool` — all from `components/espcontrol/button_grid_image.h`, already in scope.
- Produces: nothing new for later tasks — this is the whole feature in one task.

- [ ] **Step 1: Add `priority`/`p4_pipeline` to the `artwork_image:` resource**

Find:
```yaml
artwork_image:
  - url: "http://127.0.0.1/none.jpg"   # placeholder; never fetched (polling: never)
    id: image_notification_image
    format: AUTO
    type: RGB565
    byte_order: LITTLE_ENDIAN
    buffer_size: 65536
    allow_insecure_local_urls: true
    on_download_finished:
```

Replace with:
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
    on_download_finished:
```

- [ ] **Step 2: Insert the capping + memory-guard block into both API actions**

This exact 7-line span appears identically, word-for-word, in both
`send_image_notification` and `send_expiring_image_notification` (verify
this with a quick count before editing — see the check below). Use the
Edit tool's `replace_all` so one edit updates both occurrences at once.

Find:
```yaml
            std::string url = image_notification_resolve_url(
                image_url, id(cover_art_home_assistant_base_url));
            auto *img = id(image_notification_image);
            auto layout = control_modal_calc_layout(100);
            int target_w = layout.panel_w;
            int target_h = layout.panel_h;
            auto mode = esphome::artwork_image::ImageResizeMode::COVER;
```

Replace with (`replace_all: true`):
```yaml
            std::string url = image_notification_resolve_url(
                image_url, id(cover_art_home_assistant_base_url));
            auto *img = id(image_notification_image);
            auto layout = control_modal_calc_layout(100);
            if (!image_card_memory_available(nullptr, "notification", layout.panel_w, layout.panel_h)) {
              id(image_notif_fallback_to_text).execute();
              return;
            }
            int request_w = 0;
            int request_h = 0;
            image_card_limit_target_size(layout.panel_w, layout.panel_h, &request_w, &request_h);
            url = image_card_sized_url(url, request_w, request_h);
            int target_w = layout.panel_w;
            int target_h = layout.panel_h;
            auto mode = esphome::artwork_image::ImageResizeMode::COVER;
```

Before making this edit, confirm the Find block's occurrence count in the
file:

```bash
grep -c 'std::string url = image_notification_resolve_url(' common/device/screen_image_notification.yaml
```
Expected: `2`. If it's not exactly 2, stop and report NEEDS_CONTEXT — the
file has drifted from what this plan expects and a blind `replace_all`
could apply the wrong number of times.

A bare `return;` inside this lambda is a safe, established pattern already
used in this codebase's inline lambdas (e.g.
`components/espcontrol/button_grid_image.h:134,657,695,702,705`) — ESPHome
action lambdas compile to a void-returning callable, so this exits the
action handler cleanly, skipping the rest of the widget setup and the
download call entirely when memory is tight.

- [ ] **Step 3: Validate**

Run every command below against `dev.yaml` with the two `-s` overrides
from Global Constraints — not bare `esphome.yaml`.

```bash
cd devices/guition-esp32-s3-4848s040
esphome -s espcontrol_component_url "file:///Users/brian/development/espcontrol/.worktrees/notification-modal-style" -s espcontrol_component_ref "$(git -C /Users/brian/development/espcontrol/.worktrees/notification-modal-style rev-parse HEAD)" config dev.yaml
cd ../guition-esp32-p4-jc8012p4a1
esphome -s espcontrol_component_url "file:///Users/brian/development/espcontrol/.worktrees/notification-modal-style" -s espcontrol_component_ref "$(git -C /Users/brian/development/espcontrol/.worktrees/notification-modal-style rev-parse HEAD)" config dev.yaml
cd ..
```
Expected: both end with `INFO Configuration is valid!`. To double-check the
new keys actually took effect (not just that the file parses), grep the
config dump for the `image_notification_image` resource block and confirm
`priority: MODAL` / `p4_pipeline: MODAL` appear inside it — e.g.:
```bash
cd guition-esp32-s3-4848s040
esphome -s espcontrol_component_url "file:///Users/brian/development/espcontrol/.worktrees/notification-modal-style" -s espcontrol_component_ref "$(git -C /Users/brian/development/espcontrol/.worktrees/notification-modal-style rev-parse HEAD)" config dev.yaml > /tmp/p4_verify_dump.txt 2>&1
grep -A10 'id: image_notification_image$' /tmp/p4_verify_dump.txt | grep -q 'priority: MODAL' && grep -A10 'id: image_notification_image$' /tmp/p4_verify_dump.txt | grep -q 'p4_pipeline: MODAL' && echo "CONFIRMED" || echo "NOT FOUND — investigate before continuing"
cd ..
```
(There is a second, unrelated `artwork_image` entry, `image_card_modal_download_1`,
that also has `priority: MODAL`/`p4_pipeline: MODAL` — make sure you're
reading the block that starts with `id: image_notification_image`, not
that one.)

```bash
cd guition-esp32-s3-4848s040
esphome -s espcontrol_component_url "file:///Users/brian/development/espcontrol/.worktrees/notification-modal-style" -s espcontrol_component_ref "$(git -C /Users/brian/development/espcontrol/.worktrees/notification-modal-style rev-parse HEAD)" compile dev.yaml
cd ..
```
Expected: `INFO Successfully compiled program.` — proves
`image_card_memory_available`/`image_card_limit_target_size`/
`image_card_sized_url` resolve correctly and the new lambda code compiles
on the S3 (non-P4) target, where `image_card_memory_available`'s internal
`#if defined(CONFIG_IDF_TARGET_ESP32P4)` branch (inside
`image_card_estimated_pipeline_bytes`) takes its non-P4 path. This is a
full C++ build and may take several minutes — if using a bash tool with a
timeout shorter than that, run it in the background rather than assuming
a timeout means failure.

```bash
cd guition-esp32-p4-jc8012p4a1
esphome -s espcontrol_component_url "file:///Users/brian/development/espcontrol/.worktrees/notification-modal-style" -s espcontrol_component_ref "$(git -C /Users/brian/development/espcontrol/.worktrees/notification-modal-style rev-parse HEAD)" compile dev.yaml
cd ..
```
Expected: `INFO Successfully compiled program.` — proves the same code
compiles on a P4 target, where that internal branch takes its P4 path
instead, and where `priority: MODAL`/`p4_pipeline: MODAL` on the
`artwork_image:` resource actually engages the hardware/background-task
paths (compile-only; the design's manual on-device checklist covers
runtime behavior).

- [ ] **Step 4: Commit**

```bash
git add common/device/screen_image_notification.yaml
git commit -m "Enable P4 hardware acceleration for image notifications with capping and memory guard"
```

---

### Task 2: Full validation across all devices

**Files:** none (validation only)

- [ ] **Step 1: Config-validate every device**

Run each against `dev.yaml` with the two `-s` overrides from Global
Constraints, from inside that device's own directory (all commands shown
from the `devices/` directory as the starting point):

```bash
cd devices
for slug in esp32-p4-86 guition-esp32-p4-jc8012p4a1 guition-esp32-p4-jc8012p4a1-v2 guition-esp32-s3-4848s040 guition-esp32-p4-jc4880p443 guition-esp32-p4-jc1060p470; do
  echo "=== $slug ==="
  (cd "$slug" && esphome -s espcontrol_component_url "file:///Users/brian/development/espcontrol/.worktrees/notification-modal-style" -s espcontrol_component_ref "$(git -C /Users/brian/development/espcontrol/.worktrees/notification-modal-style rev-parse HEAD)" config dev.yaml 2>&1 | tail -3)
done
cd ..
```
Expected: all six end with `INFO Configuration is valid!`

- [ ] **Step 2: Compile a second P4 device, for breadth**

```bash
cd devices/guition-esp32-p4-jc4880p443
esphome -s espcontrol_component_url "file:///Users/brian/development/espcontrol/.worktrees/notification-modal-style" -s espcontrol_component_ref "$(git -C /Users/brian/development/espcontrol/.worktrees/notification-modal-style rev-parse HEAD)" compile dev.yaml
cd ../..
```
Expected: `INFO Successfully compiled program.` (this is the portrait P4
device — different `control_modal_calc_layout()` tuning than
`jc8012p4a1`, already compiled in Task 1, so this exercises a different
`layout.panel_w`/`panel_h` combination through the same new code.)

- [ ] **Step 3: Report what needs on-device (manual) verification**

No further automated step — flag to the user that these need a real device
flash to visually/behaviorally confirm, per the design spec's testing plan:
- On a P4 device: `send_image_notification` with a real HA camera proxy
  URL still renders correctly (same modal panel, image fill, shadow-text,
  close button, dismiss behavior already verified working on this branch),
  and (if inspectable via logs) the download visibly uses the P4
  background pipeline / hardware decode path rather than the main-loop
  software path.
- On an S3 device: the same call works identically to before this change
  — no observable behavior difference, confirming the P4-only settings are
  true no-ops there.
- The requested image URL now carries `?width=&height=` query params
  (capped to ≤800 on the long side, aspect-preserved) when pointed at a
  real HA camera/image proxy entity — inspectable via HA's own logs or a
  network capture.
- Forcing a low-memory condition (or reasoning about it via the existing
  free-heap sensor) confirms the memory guard correctly falls back to a
  text notification rather than attempting an oversized decode.

- [ ] **Step 4: Commit (only if any fixups were needed above)**

If Steps 1-2 both passed with no changes needed, there's nothing to commit
— this task is validation-only. If a fix was needed, commit it with a
message describing what validation caught.
