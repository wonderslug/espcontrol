// Slider and cover button types: draggable brightness/position control.
// Factory creates both "slider" (light.turn_on w/ brightness) and "cover"
// variants. b.sensor stores slider orientation ("h" or "") for lights, and
// for covers it stores "toggle", "" (position slider), or "tilt".
function sliderTypeFactory(opts) {
  return {
    label: opts.label,
    allowInSubpage: true,
    hideLabel: !!opts.hideLabel,
    labelPlaceholder: opts.placeholder,
    onSelect: function (b) {
      b.sensor = ""; b.unit = "";
      b.icon = opts.defaultIcon;
      b.icon_on = opts.defaultIconOn;
    },
    renderSettings: function (panel, b, slot, helpers) {
      function labelField() {
        var lf = document.createElement("div");
        lf.className = "sp-field";
        lf.appendChild(helpers.fieldLabel("Label", helpers.idPrefix + "label"));
        var labelInp = helpers.textInput(helpers.idPrefix + "label", b.label, opts.placeholder);
        lf.appendChild(labelInp);
        panel.appendChild(lf);
        helpers.bindField(labelInp, "label", true);
      }

      if (opts.interactionMode) {
        var interactionMode = b.sensor === "toggle" ? "toggle" : "slider";
        var sliderFunction = b.sensor === "tilt" ? "tilt" : "position";
        if (b.sensor && b.sensor !== "toggle" && b.sensor !== "tilt") {
          b.sensor = "";
          helpers.saveField("sensor", "");
        }

        var imf = document.createElement("div");
        imf.className = "sp-field";
        imf.appendChild(helpers.fieldLabel("Interaction"));
        var imSeg = document.createElement("div");
        imSeg.className = "sp-segment";
        var sliderBtn = document.createElement("button");
        sliderBtn.type = "button";
        sliderBtn.textContent = "Slider";
        var toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.textContent = "Toggle";
        imSeg.appendChild(sliderBtn);
        imSeg.appendChild(toggleBtn);
        imf.appendChild(imSeg);
        panel.appendChild(imf);

        var sliderModeField = document.createElement("div");
        sliderModeField.className = "sp-field";
        sliderModeField.appendChild(helpers.fieldLabel("Slider Function", helpers.idPrefix + "cover-slider-mode"));
        var sliderModeSelect = document.createElement("select");
        sliderModeSelect.className = "sp-select";
        sliderModeSelect.id = helpers.idPrefix + "cover-slider-mode";
        [
          ["position", "Position"],
          ["tilt", "Tilt"],
        ].forEach(function (entry) {
          var option = document.createElement("option");
          option.value = entry[0];
          option.textContent = entry[1];
          sliderModeSelect.appendChild(option);
        });
        sliderModeField.appendChild(sliderModeSelect);
        panel.appendChild(sliderModeField);

        function persistCoverSliderMode() {
          if (interactionMode === "toggle") {
            b.sensor = "toggle";
          } else {
            b.sensor = sliderFunction === "tilt" ? "tilt" : "";
          }
          helpers.saveField("sensor", b.sensor);
        }

        function setInteractionMode(mode, persist) {
          interactionMode = mode;
          sliderBtn.classList.toggle("active", mode === "slider");
          toggleBtn.classList.toggle("active", mode === "toggle");
          sliderModeField.style.display = mode === "slider" ? "" : "none";
          if (!persist) return;
          persistCoverSliderMode();
        }

        sliderModeSelect.value = sliderFunction;
        sliderModeSelect.addEventListener("change", function () {
          sliderFunction = this.value === "tilt" ? "tilt" : "position";
          persistCoverSliderMode();
        });
        sliderBtn.addEventListener("click", function () { setInteractionMode("slider", true); });
        toggleBtn.addEventListener("click", function () { setInteractionMode("toggle", true); });
        setInteractionMode(interactionMode, false);
      }

      if (opts.renderLabelInSettings) labelField();

      var ef = document.createElement("div");
      ef.className = "sp-field";
      ef.appendChild(helpers.fieldLabel("Entity ID", helpers.idPrefix + "entity"));
      var entityInp = helpers.textInput(helpers.idPrefix + "entity", b.entity, opts.entityPlaceholder);
      ef.appendChild(entityInp);
      panel.appendChild(ef);
      helpers.bindField(entityInp, "entity", true);

      function iconField(label, inputSuffix, field, currentVal, defaultVal) {
        var section = document.createElement("div");
        section.className = "sp-field";
        section.appendChild(helpers.fieldLabel(label, helpers.idPrefix + inputSuffix));
        var picker = document.createElement("div");
        picker.className = "sp-icon-picker";
        picker.id = helpers.idPrefix + inputSuffix + "-picker";
        picker.innerHTML =
          '<span class="sp-icon-picker-preview mdi mdi-' + iconSlug(currentVal) + '"></span>' +
          '<input class="sp-icon-picker-input" id="' + helpers.idPrefix + inputSuffix + '" type="text" ' +
          'placeholder="Search icons\u2026" value="' + escAttr(currentVal) + '" autocomplete="off">' +
          '<div class="sp-icon-dropdown"></div>';
        section.appendChild(picker);
        initIconPicker(picker, currentVal, function (opt) {
          b[field] = opt || defaultVal;
          helpers.saveField(field, b[field]);
        });
        return section;
      }

      if (opts.alwaysShowIconPair) {
        var offIconVal = b.icon && b.icon !== "Auto" ? b.icon : opts.defaultIcon;
        var onIconDefault = opts.onIconInheritsOff ? offIconVal : opts.defaultIconOn;
        var onIconVal = b.icon_on && b.icon_on !== "Auto" ? b.icon_on : onIconDefault;
        panel.appendChild(iconField(
          opts.iconOffFieldLabel || "Closed Icon", "icon", "icon", offIconVal, opts.defaultIcon
        ));
        panel.appendChild(iconField(
          opts.iconOnFieldLabel || "Open Icon", "icon-on", "icon_on", onIconVal, opts.defaultIconOn
        ));
      } else {
        panel.appendChild(helpers.makeIconPicker(
          helpers.idPrefix + "icon-picker", helpers.idPrefix + "icon",
          b.icon || "Auto", function (opt) {
            b.icon = opt;
            helpers.saveField("icon", opt);
          }
        ));
      }

      var allowDirection = opts.allowDirection !== false;
      if (!allowDirection && !opts.interactionMode && b.sensor) {
        b.sensor = "";
        helpers.saveField("sensor", "");
      }

      if (allowDirection) {
        var isHoriz = b.sensor === "h";
        var of = document.createElement("div");
        of.className = "sp-field";
        of.appendChild(helpers.fieldLabel("Direction"));
        var seg = document.createElement("div");
        seg.className = "sp-segment";
        var btnV = document.createElement("button");
        btnV.type = "button"; btnV.tabIndex = -1;
        btnV.textContent = "Vertical";
        if (!isHoriz) btnV.classList.add("active");
        var btnH = document.createElement("button");
        btnH.type = "button"; btnH.tabIndex = -1;
        btnH.textContent = "Horizontal";
        if (isHoriz) btnH.classList.add("active");
        seg.appendChild(btnV);
        seg.appendChild(btnH);
        of.appendChild(seg);
        panel.appendChild(of);

        btnV.addEventListener("click", function () {
          btnV.classList.add("active"); btnH.classList.remove("active");
          b.sensor = "";
          helpers.saveField("sensor", "");
        });
        btnH.addEventListener("click", function () {
          btnH.classList.add("active"); btnV.classList.remove("active");
          b.sensor = "h";
          helpers.saveField("sensor", "h");
        });
      }

      if (!opts.alwaysShowIconPair) {
        var hasIconOn = b.icon_on && b.icon_on !== "Auto";
        var iconOnToggle = helpers.toggleRow(opts.iconOnLabel, helpers.idPrefix + "iconon-toggle", hasIconOn);
        panel.appendChild(iconOnToggle.row);

        var iconOnCond = condField();
        if (hasIconOn) iconOnCond.classList.add("sp-visible");

        var iconOnSection = document.createElement("div");
        iconOnSection.className = "sp-field";
        iconOnSection.appendChild(helpers.fieldLabel(opts.iconOnFieldLabel, helpers.idPrefix + "icon-on"));
        var iconOnVal = hasIconOn ? b.icon_on : "Auto";
        var iconOnPicker = document.createElement("div");
        iconOnPicker.className = "sp-icon-picker";
        iconOnPicker.id = helpers.idPrefix + "icon-on-picker";
        iconOnPicker.innerHTML =
          '<span class="sp-icon-picker-preview mdi mdi-' + iconSlug(iconOnVal) + '"></span>' +
          '<input class="sp-icon-picker-input" id="' + helpers.idPrefix + 'icon-on" type="text" ' +
          'placeholder="Search icons\u2026" value="' + escAttr(iconOnVal) + '" autocomplete="off">' +
          '<div class="sp-icon-dropdown"></div>';
        iconOnSection.appendChild(iconOnPicker);
        iconOnCond.appendChild(iconOnSection);

        initIconPicker(iconOnPicker, iconOnVal, function (opt) {
          b.icon_on = opt;
          helpers.saveField("icon_on", opt);
        });

        panel.appendChild(iconOnCond);

        iconOnToggle.input.addEventListener("change", function () {
          if (this.checked) {
            iconOnCond.classList.add("sp-visible");
          } else {
            b.icon_on = "Auto";
            helpers.saveField("icon_on", "Auto");
            iconOnCond.classList.remove("sp-visible");
            var ionPreview = iconOnPicker.querySelector(".sp-icon-picker-preview");
            if (ionPreview) ionPreview.className = "sp-icon-picker-preview mdi mdi-cog";
            var ionInput = iconOnPicker.querySelector(".sp-icon-picker-input");
            if (ionInput) ionInput.value = "Auto";
          }
        });
      }
    },
    renderPreview: function (b, helpers) {
      var label = b.label || b.entity || opts.fallbackLabel;
      var iconName = b.icon && b.icon !== "Auto" ? iconSlug(b.icon) : opts.fallbackIcon;
      if (opts.interactionMode && b.sensor === "toggle") {
        return {
          iconHtml: '<span class="sp-btn-icon mdi mdi-' + iconName + '"></span>',
          labelHtml:
            '<span class="sp-btn-label-row"><span class="sp-btn-label">' + helpers.escHtml(label) + '</span>' +
            '<span class="sp-type-badge mdi mdi-' + opts.badgeIcon + '"></span></span>',
        };
      }
      var horizClass = opts.allowDirection !== false && b.sensor === "h" ? " sp-slider-horiz" : "";
      return {
        iconHtml:
          '<span class="sp-btn-icon mdi mdi-' + iconName + '"></span>' +
          '<span class="sp-slider-preview' + horizClass + '"><span class="sp-slider-track">' +
            '<span class="sp-slider-fill"></span>' +
          '</span></span>',
        labelHtml:
          '<span class="sp-btn-label-row"><span class="sp-btn-label">' + helpers.escHtml(label) + '</span>' +
          '<span class="sp-type-badge mdi mdi-' + opts.badgeIcon + '"></span></span>',
      };
    },
  };
}

registerButtonType("slider", sliderTypeFactory({
  label: "Slider",
  placeholder: "e.g. Living Room",
  entityPlaceholder: "e.g. light.living_room",
  defaultIcon: "Auto",
  defaultIconOn: "Auto",
  fallbackLabel: "Slider",
  fallbackIcon: "lightbulb",
  badgeIcon: "tune-vertical-variant",
  alwaysShowIconPair: true,
  onIconInheritsOff: true,
  iconOffFieldLabel: "Off Icon",
  iconOnFieldLabel: "On Icon",
}));

registerButtonType("cover", sliderTypeFactory({
  label: "Cover",
  placeholder: "e.g. Office Blind",
  entityPlaceholder: "e.g. cover.office_blind",
  defaultIcon: "Blinds",
  defaultIconOn: "Blinds Open",
  fallbackLabel: "Cover",
  fallbackIcon: "blinds",
  badgeIcon: "blinds-horizontal",
  allowDirection: false,
  alwaysShowIconPair: true,
  hideLabel: true,
  renderLabelInSettings: true,
  interactionMode: true,
}));
