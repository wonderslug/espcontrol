registerButtonType("light", {
  label: "Light",
  allowInSubpage: true,
  labelPlaceholder: "e.g. Living Room",
  onSelect: function (b) {
    b.sensor = ""; b.unit = ""; b.icon_on = "Auto";
    b.icon = "Lightbulb";
  },
  renderSettings: function (panel, b, slot, helpers) {
    var ef = document.createElement("div");
    ef.className = "sp-field";
    ef.appendChild(helpers.fieldLabel("Entity ID", helpers.idPrefix + "entity"));
    var entityInp = helpers.textInput(helpers.idPrefix + "entity", b.entity, "e.g. light.living_room");
    ef.appendChild(entityInp);
    panel.appendChild(ef);
    helpers.bindField(entityInp, "entity", true);

    panel.appendChild(helpers.makeIconPicker(
      helpers.idPrefix + "icon-picker", helpers.idPrefix + "icon",
      b.icon || "Auto", function (opt) {
        b.icon = opt;
        helpers.saveField("icon", opt);
        renderPreview();
      }
    ));
  },
  renderPreview: function (b, helpers) {
    var label = b.label || b.entity || "Light";
    var iconName = b.icon && b.icon !== "Auto" ? iconSlug(b.icon) : "lightbulb";
    return {
      iconHtml:
        '<span class="sp-btn-icon mdi mdi-' + iconName + '"></span>' +
        '<span class="sp-slider-preview"><span class="sp-slider-track">' +
          '<span class="sp-slider-fill"></span>' +
          '<span class="sp-slider-knob"></span>' +
        '</span></span>',
      labelHtml:
        '<span class="sp-btn-label">' + helpers.escHtml(label) + '</span>',
    };
  },
});
