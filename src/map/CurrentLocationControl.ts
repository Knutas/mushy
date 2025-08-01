import { defaultZoom } from "./data.js";

export class CurrentLocationControl extends L.Control {
  #button: HTMLButtonElement;
  #map: L.Map | null = null;
  #active: boolean = false;
  #watchId: number = -1;
  #currentLocationMarker: L.CircleMarker | undefined;

  constructor(options: L.ControlOptions = { position: "topleft" }) {
    super(options);
    this.#button = L.DomUtil.create("button", "leaflet-bar button-control");
    this.#button.innerHTML = "💠";
    this.#button.title = "Center on current location";

    L.DomEvent.disableClickPropagation(this.#button);

    this.#button.addEventListener("click", () => this.#toggle());
  }

  override onAdd(map: L.Map) {
    this.#map = map;
    map.on("dragstart", this.#stopFollowing, this);

    return this.#button;
  }

  override onRemove() {
    this.#map?.off("dragstart", this.#stopFollowing, this);
  }

  async getCurrentLocation(): Promise<L.LatLngLiteral | null> {
    return new Promise<L.LatLngLiteral | null>((resolve) => {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude: lat, longitude: lng } = position.coords;

        resolve({ lat, lng });
      }, async () => {
        try {
          const geoIp = await fetch("https://free.freeipapi.com/api/json");
          const { latitude: lat, longitude: lng } = await geoIp.json();

          resolve({ lat, lng });
        } catch {
          resolve(null);
        }
      });
    });
  }

  markCurrentLocation(location: L.LatLngLiteral) {
    const map = this.#map;
    if (!map) {
      return;
    }

    if (this.#currentLocationMarker === undefined) {
      map.createPane("currentLocation").style.zIndex = "620";

      this.#currentLocationMarker = L.circleMarker(location, {
        radius: 8,
        color: "white",
        fillColor: "dodgerblue",
        fillOpacity: 1,
        weight: 2,
        interactive: true,
        bubblingMouseEvents: false,
        pane: "currentLocation",
      }).addTo(map);

      this.#currentLocationMarker.on("click", () => {
        this.#currentLocationMarker?.getElement()?.dispatchEvent(new CustomEvent("mm:current-location-press", { bubbles: true, detail: { location: this.#currentLocationMarker.getLatLng() } }));
      });
    } else {
      this.#currentLocationMarker.setLatLng(location);
    }

    this.#currentLocationMarker.getElement()?.dispatchEvent(new CustomEvent("mm:current-location-update", { bubbles: true, detail: { location } }));
  }

  async #toggle() {
    const map = this.#map;
    if (!map) {
      return;
    }

    if (this.#active) {
      this.#stopFollowing();
      return;
    }

    this.#active = true;
    this.#button.classList.add("active");

    const currentLocation = await this.getCurrentLocation();
    if (!currentLocation) {
      this.#active = false;
      this.#button.classList.remove("active");
      return;
    }

    this.markCurrentLocation(currentLocation);
    this.#startFollowing();

    if (map.distance(map.getCenter(), currentLocation) < 100) {
      map.setZoom(defaultZoom);
    } else {
      map.setView([currentLocation.lat, currentLocation.lng]);

      if (map.getZoom() < defaultZoom) {
        map.setZoom(defaultZoom);
      }
    }
  }

  #startFollowing() {
    this.#watchId = navigator.geolocation.watchPosition((position) => {
      const { latitude: lat, longitude: lng } = position.coords;
      this.markCurrentLocation({ lat, lng });
      this.#map?.setView({ lat, lng });
    });
  }

  #stopFollowing() {
    if (!this.#active) {
      return;
    }

    this.#active = false;
    navigator.geolocation.clearWatch(this.#watchId);
    this.#watchId = -1;
    this.#button.classList.remove("active");
  }
}
