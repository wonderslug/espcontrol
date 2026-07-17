import gzip
import json
import os

import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components.esp32 import add_idf_sdkconfig_option
from esphome.core import CORE

CODEOWNERS = ["@dentra"]

CONFIG_SCHEMA = cv.All(
    cv.Schema({}),
    cv.only_on_esp32,
)

AUTO_LOAD = ["web_server"]

# All asset paths are resolved relative to this component file so they work
# both in local builds (Docker mount) and in remote builds where ESPHome
# fetches the component via external_components type: git. In both cases
# _COMP_DIR is inside the cloned/mounted repository, so docs/ is reachable.
_COMP_DIR = os.path.dirname(os.path.abspath(__file__))
_WEBSERVER_DIR = os.path.normpath(os.path.join(_COMP_DIR, "../../docs/public/webserver"))
_ASSETS_DIR = os.path.join(_WEBSERVER_DIR, "assets")
_ASSETS_MANIFEST = os.path.join(_ASSETS_DIR, "manifest.json")


def _compress_and_emit(name: str, data: bytes, is_gzip: bool) -> None:
    payload = gzip.compress(data) if is_gzip else data
    size = len(payload)
    bytes_str = ", ".join(str(b) for b in payload)
    cg.add_global(cg.RawExpression(
        f"constexpr uint8_t ESPHOME_ASSET_{name}_DATA[{size}] PROGMEM = {{{bytes_str}}}"
    ))
    cg.add_global(cg.RawExpression(
        f"constexpr size_t ESPHOME_ASSET_{name}_SIZE = {size}"
    ))


async def to_code(config):
    add_idf_sdkconfig_option("CONFIG_HTTPD_MAX_REQ_HDR_LEN", 1024)

    # ── www.js ────────────────────────────────────────────────────────────────
    # Embed the per-device self-contained bundle as the first asset, served at
    # /0.js. ESPHome's core web_server (v2/v3) always loads /0.js as an ES
    # module (<script type="module">) via its built-in index page, regardless
    # of js_url/js_include config. ES modules never set document.currentScript,
    # so the compatibility loader stub at <slug>/www.js (which depends on it to
    # inject a `?device=` query string for the shared bundle) throws on load.
    # embedded.js has its device slug baked in at build time instead, so it
    # needs no query string. Resolved via _COMP_DIR so this works for both
    # local Docker builds and remote ESPHome package imports
    # (external_components: type: git).
    device_slug = CORE.config.get("substitutions", {}).get("device_slug", "")
    www_js_path = os.path.join(_WEBSERVER_DIR, device_slug, "embedded.js")
    if not device_slug or not os.path.isfile(www_js_path):
        return

    # ── External assets ───────────────────────────────────────────────────────
    if not os.path.isfile(_ASSETS_MANIFEST):
        return

    with open(_ASSETS_MANIFEST) as f:
        manifest = json.load(f)

    external_assets = manifest.get("assets", [])
    if not external_assets:
        return

    # Build the full ordered asset list: www.js first, then fonts/icons/etc.
    # The C++ handler uses the URL to decide cache policy:
    #   /0.js       → no-cache  (changes with every firmware build)
    #   /assets/*   → immutable (versioned CDN snapshots, never change)
    with open(www_js_path, "rb") as f:
        www_js_data = f.read()

    all_assets = [
        {"_data": www_js_data, "url": "/0.js",
         "content_type": "text/javascript", "gzip": True},
    ] + [
        {**a, "_data": None} for a in external_assets
    ]

    total = len(all_assets)
    cg.add_define("USE_WEBSERVER_ASSETS")
    cg.add_define("USE_WEBSERVER_ASSETS_COUNT", total)

    for idx, asset in enumerate(all_assets):
        name = str(idx)
        if asset["_data"] is not None:
            data = asset["_data"]
        else:
            with open(os.path.join(_ASSETS_DIR, asset["file"]), "rb") as f:
                data = f.read()

        _compress_and_emit(name, data, asset.get("gzip", False))
        cg.add_global(cg.RawExpression(
            f'constexpr const char *ESPHOME_ASSET_{name}_URL = "{asset["url"]}"'
        ))
        cg.add_global(cg.RawExpression(
            f'constexpr const char *ESPHOME_ASSET_{name}_CONTENT_TYPE = "{asset["content_type"]}"'
        ))
        cg.add_global(cg.RawExpression(
            f'constexpr bool ESPHOME_ASSET_{name}_GZIP = {"true" if asset.get("gzip") else "false"}'
        ))

    table_rows = "\n".join(
        f"  {{ESPHOME_ASSET_{i}_URL, ESPHOME_ASSET_{i}_CONTENT_TYPE,"
        f" ESPHOME_ASSET_{i}_DATA, ESPHOME_ASSET_{i}_SIZE, ESPHOME_ASSET_{i}_GZIP}},"
        for i in range(total)
    )
    cg.add_global(cg.RawExpression(
        f"namespace esphome {{ namespace web_server_idf {{\n"
        f"extern const EmbeddedAsset ESPHOME_ASSET_TABLE[{total}] = {{\n{table_rows}\n"
        f"}};\n}} }}  // namespace esphome::web_server_idf"
    ))
