// Climate card: compact dashboard status that opens a thermostat detail page.
registerButtonType("climate", {
  label: "Climate",
  allowInSubpage: true,
  labelPlaceholder: "e.g. Living Room",
  onSelect: function (b) {
    b.sensor = "";
    b.unit = "";
    b.precision = "";
    b.icon = "Thermostat";
    b.icon_on = "Auto";
  },
  renderSettings: function (panel, b, slot, helpers) {
    var ef = document.createElement("div");
    ef.className = "sp-field";
    ef.appendChild(helpers.fieldLabel("Climate Entity", helpers.idPrefix + "entity"));
    var entityInp = helpers.textInput(helpers.idPrefix + "entity", b.entity, "e.g. climate.living_room");
    ef.appendChild(entityInp);
    panel.appendChild(ef);
    helpers.bindField(entityInp, "entity", true);
  },
  renderPreview: function (b, helpers) {
    var label = b.label || b.entity || "Climate";
    return {
      iconHtml:
        '<span class="sp-sensor-preview">' +
          '<span class="sp-sensor-value">19.8</span>' +
          '<span class="sp-sensor-unit">\u00B0</span>' +
        '</span>',
      labelHtml:
        '<span class="sp-btn-label-row"><span class="sp-btn-label">' + helpers.escHtml(label) + '</span>' +
        '<span class="sp-type-badge mdi mdi-thermostat"></span></span>',
    };
  },
});
