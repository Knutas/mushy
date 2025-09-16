import { Option, portalMeta, PortalType } from "./portals.js";

export function getOptionControl(options: Option[], name: string, selected?: string, multiSelect = false) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "options-fieldset";

  options.forEach((option) => {
    const label = L.DomUtil.create("label", undefined, fieldset);
    label.title = option.text;

    const input = L.DomUtil.create("input", undefined, label);
    input.type = multiSelect ? "checkbox" : "radio";
    input.name = name;
    input.value = option.value;
    input.checked = option.value === selected;

    label.append(option.symbol);
  });

  return fieldset;
}

export function getTypeOptionControl(selectedType?: PortalType, multiSelect = false) {
  return getOptionControl(Object.values(portalMeta), "type", selectedType, multiSelect);
}
