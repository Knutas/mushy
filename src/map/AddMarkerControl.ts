import { layers, portals } from "./data.js";
import { createMarker } from "./marker.js";
import { getTypeOptions } from "./getTypeOptions.js";
import { icon } from "./icon.js";
import { Portal, PortalType } from "./portals.js";
import { savePortals } from "./portals.js";

export class AddMarkerControl extends L.Control {
  #button: HTMLButtonElement;
  #map: L.Map | null = null;
  #active: boolean = false;
  #tempMarker: L.Marker | null = null;

  constructor(options: L.ControlOptions = { position: "topleft" }) {
    super(options);
    this.#button = L.DomUtil.create("button", "leaflet-bar button-control");
    this.#button.innerHTML = "➕";
    this.#button.title = "Add a new marker";
    this.#button.addEventListener("click", () => this.#toggle());

    L.DomEvent.disableClickPropagation(this.#button);
  }

  override onAdd(map: L.Map) {
    this.#map = map;
    return this.#button;
  }

  override onRemove() {
    this.#deactivate();
  }

  #mapClickHandler(e: L.LeafletMouseEvent) {
    if (this.#tempMarker) {
      this.#tempMarker.setLatLng(e.latlng);
    } else {
      this.#tempMarker = L.marker(e.latlng, { icon: icon.violet }).bindPopup(this.#getForm());
    }

    this.#map?.addLayer(this.#tempMarker);
    this.#tempMarker.openPopup();
  }

  #form: HTMLFormElement | null = null;

  #getForm() {
    if (this.#form) {
      return this.#form;
    }

    this.#form = document.createElement("form");
    this.#form.className = "create-popup";
    this.#form.addEventListener("submit", (e) => this.#saveMarker(e));

    const input = document.createElement("input");
    input.placeholder = "Enter name…";
    input.name = "name";
    this.#form.appendChild(input);

    this.#form.appendChild(getTypeOptions("Unknown"));

    const saveButton = document.createElement("button");
    saveButton.innerText = "Save";
    this.#form.appendChild(saveButton);

    return this.#form;
  }

  #toggle() {
    if (this.#active) {
      this.#deactivate();
    } else {
      this.#activate();
    }
  }

  #escListener(e: L.LeafletKeyboardEvent) {
    if (e.originalEvent.key === "Escape") {
      this.#deactivate();
    }
  }

  #activate() {
    this.#active = true;
    this.#button.classList.add("active");
    this.#map?.getContainer().classList.add("default-cursor");
    this.#map?.on("click", this.#mapClickHandler, this);
    this.#map?.on("keydown", this.#escListener, this);
  }

  #deactivate() {
    this.#active = false;
    this.#button.classList.remove("active");
    this.#map?.getContainer().classList.remove("default-cursor");
    this.#map?.off("click", this.#mapClickHandler, this);
    this.#map?.off("keydown", this.#escListener, this);

    this.#form?.reset();
    this.#tempMarker?.remove();
  }

  #saveMarker(e: SubmitEvent) {
    L.DomEvent.preventDefault(e);

    if (!this.#tempMarker) {
      return;
    }

    const guid = crypto.randomUUID();

    const data = new FormData(e.target as HTMLFormElement);
    const type = data.get("marker-type") as PortalType;
    const name = (data.get("name") as string).trim() || guid;

    const { lat, lng } = this.#tempMarker.getLatLng();

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

    this.#deactivate();
  }
}
