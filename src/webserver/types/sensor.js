// Read-only sensor card: displays a HA sensor value and unit (non-clickable)
registerButtonType("sensor", {
  label: "Sensor",
  allowInSubpage: true,
  labelPlaceholder: "e.g. Living Room",
  onSelect: function (b) {
    b.entity = "";
    b.icon = "Auto";
    b.icon_on = "Auto";
  },
  renderSettings: function (panel, b, slot, helpers) {
    var sf = document.createElement("div");
    sf.className = "sp-field";
    sf.appendChild(helpers.fieldLabel("Sensor Entity", helpers.idPrefix + "sensor"));
    var sensorInp = helpers.textInput(helpers.idPrefix + "sensor", b.sensor, "e.g. sensor.living_room_temperature");
    sf.appendChild(sensorInp);
    panel.appendChild(sf);
    helpers.bindField(sensorInp, "sensor", true);

    var uf = document.createElement("div");
    uf.className = "sp-field";
    uf.appendChild(helpers.fieldLabel("Unit", helpers.idPrefix + "unit"));
    var unitInp = helpers.textInput(helpers.idPrefix + "unit", b.unit, "e.g. \u00B0C");
    unitInp.className = "sp-input sp-input--narrow";
    uf.appendChild(unitInp);
    panel.appendChild(uf);
    helpers.bindField(unitInp, "unit", true);

    var pf = document.createElement("div");
    pf.className = "sp-field";
    pf.appendChild(helpers.fieldLabel("Display precision", helpers.idPrefix + "precision"));
    var precSel = document.createElement("select");
    precSel.className = "sp-input sp-input--narrow";
    precSel.id = helpers.idPrefix + "precision";
    var precOpts = [["0", "10"], ["1", "10.3"], ["2", "10.35"]];
    for (var i = 0; i < precOpts.length; i++) {
      var opt = document.createElement("option");
      opt.value = precOpts[i][0];
      opt.textContent = precOpts[i][1];
      if ((b.precision || "0") === precOpts[i][0]) opt.selected = true;
      precSel.appendChild(opt);
    }
    precSel.addEventListener("change", function () {
      b.precision = this.value === "0" ? "" : this.value;
      helpers.saveField("precision", b.precision);
    });
    pf.appendChild(precSel);
    panel.appendChild(pf);
  },
  renderPreview: function (b, helpers) {
    var label = b.label || b.sensor || "Sensor";
    var unit = b.unit ? helpers.escHtml(b.unit) : "";
    return {
      iconHtml:
        '<span class="sp-sensor-preview">' +
          '<span class="sp-sensor-value">0</span>' +
          '<span class="sp-sensor-unit">' + unit + '</span>' +
        '</span>',
      labelHtml:
        '<span class="sp-btn-label-row"><span class="sp-btn-label">' + helpers.escHtml(label) + '</span>' +
        '<span class="sp-type-badge mdi mdi-gauge"></span></span>',
    };
  },
});
