import { layers, portals } from "./data.js";
import { createMarker, getTypeOptions, icon } from "./utils.js";
import { Portal, PortalType } from "./portals.js";
import { savePortals } from "./portals.js";

export const AddMarkerControl = L.Control.extend({
  onAdd(map: L.Map) {
    const button = L.DomUtil.create("button", "leaflet-bar button-control");
    button.innerHTML = "➕";
    button.title = "Add a new marker";

    L.DomEvent.disableClickPropagation(button);

    let active = false;
    let tempMarker: L.Marker | null = null;

    function escListener(e: KeyboardEvent) {
      if (e.key === "Escape") {
        deactivate();
      }
    }

    function deactivate() {
      active = false;
      button.classList.remove("active");
      map.getContainer().classList.remove("default-cursor");
      document.removeEventListener("keydown", escListener);

      if (tempMarker) {
        tempMarker.remove();
        tempMarker = null;
      }
    }

    button.addEventListener("click", () => {
      if (active) {
        deactivate();
      } else {
        active = true;
        button.classList.add("active");
        map.getContainer().classList.add("default-cursor");
        document.addEventListener("keydown", escListener);
      }
    });

    map.on("click", (e) => {
      if (!active) {
        return;
      }

      if (tempMarker) {
        tempMarker.remove();
      }

      tempMarker = L.marker(e.latlng, { icon: icon.violet }).addTo(map);

      const input = document.createElement("input");
      input.placeholder = "Enter name…";
      input.name = "name";

      const saveButton = document.createElement("button");
      saveButton.innerText = "Save";

      const form = document.createElement("form");
      form.className = "create-popup";
      form.addEventListener("submit", saveMarker);

      form.appendChild(input);
      form.appendChild(getTypeOptions("Unknown"));
      form.appendChild(saveButton);

      tempMarker.bindPopup(form).openPopup();
    });

    return button;

    function saveMarker(e: SubmitEvent) {
      L.DomEvent.preventDefault(e);

      if (!tempMarker) {
        return;
      }

      const guid = crypto.randomUUID();

      const data = new FormData(e.target as HTMLFormElement);
      const type = data.get("marker-type") as PortalType;
      const name = (data.get("name") as string).trim() || guid;

      const { lat, lng } = tempMarker.getLatLng();

      const portal: Portal = {
        guid,
        lat,
        lng,
        name,
        type,
        manual: true,
      };

      portals.set(guid, portal);
      createMarker(portal).addTo(layers[type]);
      savePortals();

      deactivate();
    }
  },
});
