import { portals } from "./data.js";

export class RadiusControl extends L.Control {
  static #level = 14;
  #button: HTMLButtonElement;
  #map: L.Map | null = null;
  #active = false;
  #circle: L.Circle | null = null;
  #circleCenter: L.CircleMarker | null = null;
  #s2Layer = L.layerGroup();
  #following = false;
  #eventHandlers: Map<string, (e: any) => void> = new Map();

  constructor(options: L.ControlOptions = { position: "topleft" }) {
    super(options);

    this.#button = L.DomUtil.create("button", "leaflet-bar button-control");
    this.#button.innerHTML = "⭕";
    this.#button.title = `500 m radius circle with level ${RadiusControl.#level} S2 cells`;

    L.DomEvent.disableClickPropagation(this.#button);

    this.#button.addEventListener("click", () => {
      if (!this.#active) {
        this.#activate();
      } else {
        this.#deactivate();
      }
    });
  }

  override onAdd(map: L.Map) {
    this.#map = map;
    return this.#button;
  }

  #activate() {
    const map = this.#map;
    if (!map) {
      return;
    }

    this.#active = true;
    this.#button.classList.add("active");
    map.getContainer().classList.add("default-cursor");

    this.#eventHandlers.set("keydown", this.#escListener.bind(this));
    this.#eventHandlers.set("mm:marker-open", this.#markerOpened.bind(this));
    this.#eventHandlers.set("mm:current-location-press", this.#locationPressHandler.bind(this));
    this.#eventHandlers.forEach((handler, event) => document.addEventListener(event, handler));

    if (!map.hasLayer(this.#s2Layer)) {
      this.#s2Layer.addTo(map);
    }

    map.on("click", this.#mapClickHandler, this);
  }

  #deactivate() {
    this.#active = false;
    this.#button.classList.remove("active");
    this.#map?.getContainer().classList.remove("default-cursor");

    this.#map?.off("click", this.#mapClickHandler, this);
    this.#eventHandlers.forEach((handler, event) => document.removeEventListener(event, handler));
    this.#eventHandlers.clear();

    this.#circle?.remove();
    this.#circleCenter?.remove();
    this.#circle = null;
    this.#circleCenter = null;

    this.#s2Layer.remove();
    this.#s2Layer.clearLayers();
  }

  #mapClickHandler(e: L.LeafletMouseEvent) {
    this.#following = false;

    const { lat, lng } = e.latlng;
    this.#setLocation({ lat, lng });
  }

  #escListener(e: KeyboardEvent) {
    if (e.key === "Escape") {
      this.#deactivate();
    }
  }

  #markerOpened(e: CustomEventInit<{ guid: string }>) {
    const guid = e.detail?.guid;
    if (!guid) {
      return;
    }

    const portal = portals.get(guid);
    if (!portal) {
      return;
    }

    this.#following = false;

    const { lat, lng } = portal;
    this.#setLocation({ lat, lng });
  }

  #locationPressHandler(e: CustomEventInit<{ location: L.LatLngLiteral }>) {
    if (this.#following) {
      return;
    }

    this.#following = true;

    this.#locationUpdateHandler(e);
    const handler = this.#locationUpdateHandler.bind(this);
    this.#eventHandlers.set("mm:current-location-update", handler);
    document.addEventListener("mm:current-location-update", handler);
  }

  #locationUpdateHandler(e: CustomEventInit<{ location: L.LatLngLiteral }>) {
    if (this.#following && e.detail?.location) {
      this.#setLocation(e.detail.location);
    }
  }

  async #setLocation(latlng: L.LatLngLiteral) {
    const map = this.#map;
    if (!map) {
      return;
    }

    this.#copyCoordinates(latlng);

    if (this.#circle) {
      this.#circle.setLatLng(latlng);
      this.#circleCenter?.setLatLng(latlng);
    } else {
      this.#circle = L.circle(latlng, {
        radius: 500,
        color: "red",
        fillColor: "#f03",
        fillOpacity: 0.1,
        interactive: false,
      }).addTo(map);
      this.#circleCenter = L.circleMarker(latlng, {
        radius: 3,
        color: "white",
        fillColor: "red",
        fillOpacity: 1,
        weight: 1,
        interactive: false,
      }).addTo(map);
    }

    this.#drawS2Grid(this.#circle.getLatLng(), this.#circle.getRadius(), this.#circle.getBounds());
  }

  #drawS2Grid(circleCenter: L.LatLng, radius: number, bounds: L.LatLngBounds) {
    const map = this.#map;
    if (!map) {
      return;
    }

    this.#s2Layer.clearLayers();
    const step = calculateStepSize(RadiusControl.#level, circleCenter.lat);
    const cells = new Map<string, L.LatLngLiteral>();

    const nw = bounds.getNorthWest();
    const se = bounds.getSouthEast();
    const startLat = Math.min(nw.lat, se.lat);
    const endLat = Math.max(nw.lat, se.lat) + step.stepLat;
    const startLng = Math.min(nw.lng, se.lng);
    const endLng = Math.max(nw.lng, se.lng);

    for (let lat = startLat; lat <= endLat; lat += step.stepLat) {
      for (let lng = startLng; lng <= endLng; lng += step.stepLng) {
        cells.set(S2.latLngToKey(lat, lng, RadiusControl.#level), { lat, lng });
      }
    }

    cells.forEach(({ lat, lng }) => {
      const cell = S2.S2Cell.FromLatLng({ lat, lng }, RadiusControl.#level);
      const corners = cell.getCornerLatLngs();

      if (corners.some((corner) => map.distance(circleCenter, corner) <= radius)) {
        L.polygon(corners, {
          color: "black",
          weight: 1,
          fill: false,
          opacity: 0.5,
          interactive: false,
        }).addTo(this.#s2Layer);
      }
    });
  }

  #copyCoordinates(latlng: L.LatLngLiteral) {
    const { lat, lng } = latlng;
    void navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`).catch((err) => {
      console.error("Failed to copy coordinates: ", err);
    });
  }
}

function calculateStepSize(level: number, latitude: number): { stepLat: number; stepLng: number } {
  const EarthRadius = 6_371_000;
  const EarthCircumference = 2 * Math.PI * EarthRadius;
  const edgeLength = EarthCircumference / Math.pow(2, level + 1) / 3;
  const stepLat = (edgeLength / EarthRadius) * (180 / Math.PI);
  const stepLng = stepLat / Math.cos(latitude * Math.PI / 180);

  return { stepLat, stepLng };
}
