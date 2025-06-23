import { defaultZoom } from "./data.js";
import { getCurrentLocation } from "./utils.js";
import { markCurrentLocation } from "./currentLocationMarker.js";

export const CurrentLocationControl = L.Control.extend({
  onAdd(map: L.Map) {
    const button = L.DomUtil.create("button", "leaflet-bar button-control");
    button.innerHTML = "💠";
    button.title = "Center on current location";
    let active = false;
    let watchId = -1;

    L.DomEvent.disableClickPropagation(button);

    button.addEventListener("click", async () => {
      if (active) {
        stopFollowing();
        return;
      }

      active = true;
      button.classList.add("active");

      const currentLocation = await getCurrentLocation();
      if (!currentLocation) {
        active = false;
        button.classList.remove("active");
        return;
      }

      markCurrentLocation(map, currentLocation);
      startFollowing();

      if (map.distance(map.getCenter(), currentLocation) < 100) {
        map.setZoom(defaultZoom);
      } else {
        map.setView([currentLocation.lat, currentLocation.lng]);

        if (map.getZoom() < defaultZoom) {
          map.setZoom(defaultZoom);
        }
      }
    });

    function startFollowing() {
      watchId = navigator.geolocation.watchPosition((position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        markCurrentLocation(map, { lat, lng });
        map.setView({ lat, lng });
      });
    }

    function stopFollowing() {
      if (!active) {
        return;
      }

      active = false;
      navigator.geolocation.clearWatch(watchId);
      watchId = -1;
      button.classList.remove("active");
    }

    map.on("dragstart", () => stopFollowing());

    return button;
  },
});
