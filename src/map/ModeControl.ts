import { addMarkerControl, allControls, clusterControl, currentLocationControl, modeControl, portalManagerControl, radiusControl, searchMarkersControl } from "./controls.js";
import { layerControl, layers } from "./data.js";
import { portalTypes } from "./portals.js";

export type Mode = "survey" | "cook";

export class ModeControl extends L.Control {
  #container: HTMLDivElement;
  #map: L.Map | null = null;
  #mode: Mode | null = null;
  #surveyButton: HTMLButtonElement | null = null;
  #cookButton: HTMLButtonElement | null = null;

  constructor(options: L.ControlOptions = { position: "topleft" }) {
    super(options);
    this.#container = L.DomUtil.create("div", "leaflet-bar mode-control");
    L.DomEvent.disableClickPropagation(this.#container);

    this.#surveyButton = L.DomUtil.create("button", "button-control", this.#container);
    this.#surveyButton.innerHTML = "🔭";
    this.#surveyButton.title = "Survey";
    this.#surveyButton.addEventListener("click", () => {
      this.mode = "survey";
    });

    this.#cookButton = L.DomUtil.create("button", "button-control", this.#container);
    this.#cookButton.innerHTML = "🍲";
    this.#cookButton.title = "Cook";
    this.#cookButton.addEventListener("click", () => {
      this.mode = "cook";
    });
  }

  override onAdd(map: L.Map) {
    this.#map = map;
    return this.#container;
  }

  get mode(): Mode {
    return this.#mode ?? "survey";
  }

  set mode(newMode: Mode) {
    this.#mode = newMode;
    this.#map?.closePopup();
    [this.#surveyButton, this.#cookButton].forEach((button) => {
      button?.classList.remove("active");
    });

    switch (newMode) {
      case "cook":
        this.#setCookMode();
        break;
      default:
      case "survey":
        this.#setSurveyMode();
        break;
    }
  }

  #setSurveyMode() {
    this.#surveyButton?.classList.add("active");

    this.#setControls(
      modeControl,
      searchMarkersControl,
      portalManagerControl,
      radiusControl,
      currentLocationControl,
      addMarkerControl,
      clusterControl,
    );

    Object.entries(layers).forEach(([type, layer]) => {
      this.#map?.addLayer(layer);
      layerControl.addOverlay(layer, type);
    });
    clusterControl.toggle(true);
  }

  #setCookMode() {
    this.#cookButton?.classList.add("active");

    this.#setControls(
      modeControl,
      searchMarkersControl,
      radiusControl,
      currentLocationControl,
    );

    clusterControl.toggle(false);
    portalTypes.forEach((type) => {
      layerControl.removeLayer(layers[type]);

      if (type !== "Mushroom") {
        this.#map?.removeLayer(layers[type]);
      }
    });
  }

  #setControls(...controls: L.Control[]) {
    const map = this.#map;
    if (!map) {
      return;
    }

    allControls.forEach((control) => map.removeControl(control));

    controls.forEach((control) => map.addControl(control));
  }
}
