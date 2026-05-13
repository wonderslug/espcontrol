import gzip
import json
import os

import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components.esp32 import add_idf_sdkconfig_option

CODEOWNERS = ["@dentra"]

CONFIG_SCHEMA = cv.All(
    cv.Schema({}),
    cv.only_on_esp32,
)

AUTO_LOAD = ["web_server"]

# Assets directory is fixed relative to this component file.
_COMP_DIR = os.path.dirname(os.path.abspath(__file__))
_ASSETS_DIR = os.path.normpath(os.path.join(_COMP_DIR, "../../docs/public/webserver/assets"))
_ASSETS_MANIFEST = os.path.join(_ASSETS_DIR, "manifest.json")


def _embed_asset(name: str, data: bytes, is_gzip: bool) -> None:
    """Embed a byte buffer as a PROGMEM constexpr array pair."""
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

    if not os.path.isfile(_ASSETS_MANIFEST):
        return

    with open(_ASSETS_MANIFEST) as f:
        manifest = json.load(f)

    assets = manifest.get("assets", [])
    if not assets:
        return

    cg.add_define("USE_WEBSERVER_ASSETS")
    cg.add_define("USE_WEBSERVER_ASSETS_COUNT", len(assets))

    # Emit per-asset URL, content-type, gzip flag, and data array
    for idx, asset in enumerate(assets):
        name = str(idx)
        asset_path = os.path.join(_ASSETS_DIR, asset["file"])
        with open(asset_path, "rb") as f:
            data = f.read()

        _embed_asset(name, data, asset.get("gzip", False))
        cg.add_global(cg.RawExpression(
            f'constexpr const char *ESPHOME_ASSET_{name}_URL = "{asset["url"]}"'
        ))
        cg.add_global(cg.RawExpression(
            f'constexpr const char *ESPHOME_ASSET_{name}_CONTENT_TYPE = "{asset["content_type"]}"'
        ))
        cg.add_global(cg.RawExpression(
            f'constexpr bool ESPHOME_ASSET_{name}_GZIP = {"true" if asset.get("gzip") else "false"}'
        ))

    # Emit the asset table as a constexpr array of structs
    table_rows = "\n".join(
        f"  {{ESPHOME_ASSET_{i}_URL, ESPHOME_ASSET_{i}_CONTENT_TYPE,"
        f" ESPHOME_ASSET_{i}_DATA, ESPHOME_ASSET_{i}_SIZE, ESPHOME_ASSET_{i}_GZIP}},"
        for i in range(len(assets))
    )
    # Use 'extern const' inside the correct namespace so the table gets external
    # linkage as esphome::web_server_idf::ESPHOME_ASSET_TABLE, matching the extern
    # declaration in web_server_idf.cpp.
    cg.add_global(cg.RawExpression(
        f"namespace esphome {{ namespace web_server_idf {{\n"
        f"extern const EmbeddedAsset ESPHOME_ASSET_TABLE[{len(assets)}] = {{\n{table_rows}\n"
        f"}};\n}} }}  // namespace esphome::web_server_idf"
    ))
