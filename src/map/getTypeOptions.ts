import { portalMeta, PortalType, portalTypes } from "./portals.js";

export function getTypeOptions(selectedType: PortalType | undefined, multiSelect = false) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "marker-type-options";

  portalTypes.forEach((type) => {
    const label = L.DomUtil.create("label", undefined, fieldset);

    const input = L.DomUtil.create("input", undefined, label);
    input.type = multiSelect ? "checkbox" : "radio";
    input.name = "marker-type";
    input.value = type;
    input.checked = type === selectedType;
    if (type === selectedType) {
      input.setAttribute("checked", "checked");
    }

    label.appendChild(document.createTextNode(portalMeta[type].symbol));
  });

  return fieldset;
}
