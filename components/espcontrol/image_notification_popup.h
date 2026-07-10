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
