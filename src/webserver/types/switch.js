// Default button type: HA entity toggle (on/off switch)
registerButtonType("", {
  label: "Switch",
  allowInSubpage: true,
  renderSettings: function (panel, b, slot, helpers) {
    var showSensor = !!b.sensor;
    var sensorMode = b.precision === "text" ? "text" : "numeric";

    var ef = document.createElement("div");
    ef.className = "sp-field";
    ef.appendChild(helpers.fieldLabel("Entity ID", helpers.idPrefix + "entity"));
    var entityInp = helpers.textInput(helpers.idPrefix + "entity", b.entity, "e.g. light.kitchen");
    ef.appendChild(entityInp);
    panel.appendChild(ef);
    helpers.bindField(entityInp, "entity", true);

    panel.appendChild(helpers.makeIconPicker(
      helpers.idPrefix + "icon-picker", helpers.idPrefix + "icon",
      b.icon || "Auto", function (opt) {
        b.icon = opt;
        helpers.saveField("icon", opt);
      }, "Off Icon"
    ));

    panel.appendChild(helpers.makeIconPicker(
      helpers.idPrefix + "icon-on-picker", helpers.idPrefix + "icon-on",
      b.icon_on || "Auto", function (opt) {
        b.icon_on = opt;
        helpers.saveField("icon_on", opt);
      }, "On Icon"
    ));

    var sensorToggle = helpers.toggleRow(
      "Show sensor data when on",
      helpers.idPrefix + "sensor-when-on-toggle",
      showSensor
    );
    panel.appendChild(sensorToggle.row);

    var sensorSection = condField();
    if (showSensor) sensorSection.classList.add("sp-visible");

    var modeField = document.createElement("div");
    modeField.className = "sp-field";
    modeField.appendChild(helpers.fieldLabel("Sensor Display"));
    var modeSeg = document.createElement("div");
    modeSeg.className = "sp-segment";
    var numericBtn = document.createElement("button");
    numericBtn.type = "button";
    numericBtn.textContent = "Numeric";
    var textBtn = document.createElement("button");
    textBtn.type = "button";
    textBtn.textContent = "Text";
    modeSeg.appendChild(numericBtn);
    modeSeg.appendChild(textBtn);
    modeField.appendChild(modeSeg);
    sensorSection.appendChild(modeField);

    var sf = document.createElement("div");
    sf.className = "sp-field";
    sf.appendChild(helpers.fieldLabel("Sensor Entity", helpers.idPrefix + "sensor"));
    var sensorInp = helpers.textInput(helpers.idPrefix + "sensor", b.sensor, "e.g. sensor.printer_percent_complete");
    sf.appendChild(sensorInp);
    sensorSection.appendChild(sf);
    helpers.bindField(sensorInp, "sensor", true);

    var numericSection = condField();

    var uf = document.createElement("div");
    uf.className = "sp-field";
    uf.appendChild(helpers.fieldLabel("Unit", helpers.idPrefix + "unit"));
    var unitInp = helpers.textInput(helpers.idPrefix + "unit", b.unit, "e.g. %");
    unitInp.className = "sp-input sp-input--narrow";
    uf.appendChild(unitInp);
    numericSection.appendChild(uf);
    helpers.bindField(unitInp, "unit", false);

    var pf = document.createElement("div");
    pf.className = "sp-field";
    pf.appendChild(helpers.fieldLabel("Unit Precision", helpers.idPrefix + "precision"));
    var precSeg = document.createElement("div");
    precSeg.className = "sp-segment";
    var precOpts = [["0", "10"], ["1", "10.2"], ["2", "10.21"]];
    for (var pi = 0; pi < precOpts.length; pi++) {
      (function (val, label) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = label;
        if (sensorMode === "numeric" && (b.precision || "0") === val) btn.classList.add("active");
        btn.addEventListener("click", function () {
          b.precision = val === "0" ? "" : val;
          helpers.saveField("precision", b.precision);
          var btns = precSeg.querySelectorAll("button");
          for (var j = 0; j < btns.length; j++) btns[j].classList.remove("active");
          btn.classList.add("active");
        });
        precSeg.appendChild(btn);
      })(precOpts[pi][0], precOpts[pi][1]);
    }
    pf.appendChild(precSeg);
    numericSection.appendChild(pf);
    sensorSection.appendChild(numericSection);

    panel.appendChild(sensorSection);

    function setSensorMode(mode, persist) {
      sensorMode = mode;
      numericBtn.classList.toggle("active", mode === "numeric");
      textBtn.classList.toggle("active", mode === "text");
      numericSection.classList.toggle("sp-visible", mode === "numeric");
      if (!persist) return;
      if (mode === "text") {
        b.precision = "text";
        b.unit = "";
        unitInp.value = "";
        helpers.saveField("precision", "text");
        helpers.saveField("unit", "");
      } else {
        b.precision = "";
        helpers.saveField("precision", "");
        var pbs = precSeg.querySelectorAll("button");
        for (var j = 0; j < pbs.length; j++) pbs[j].classList.toggle("active", j === 0);
      }
    }

    numericBtn.addEventListener("click", function () { setSensorMode("numeric", true); });
    textBtn.addEventListener("click", function () { setSensorMode("text", true); });
    setSensorMode(sensorMode, false);

    sensorToggle.input.addEventListener("change", function () {
      showSensor = this.checked;
      sensorSection.classList.toggle("sp-visible", showSensor);
      helpers.saveField("sensor", b.sensor || "");
      if (showSensor) {
        setSensorMode(sensorMode, true);
        return;
      }
      b.sensor = "";
      b.unit = "";
      b.precision = "";
      sensorInp.value = "";
      unitInp.value = "";
      helpers.saveField("sensor", "");
      helpers.saveField("unit", "");
      helpers.saveField("precision", "");
      setSensorMode("numeric", false);
    });
  },
  renderPreview: function (b, helpers) {
    var label = b.label || b.entity || "Configure";
    var badgeIcon = b.sensor
      ? (b.precision === "text" ? "format-text" : "gauge")
      : "toggle-switch-variant-off";
    return {
      labelHtml:
        '<span class="sp-btn-label-row"><span class="sp-btn-label">' + helpers.escHtml(label) + '</span>' +
        '<span class="sp-type-badge mdi mdi-' + badgeIcon + '"></span></span>',
    };
  },
});
