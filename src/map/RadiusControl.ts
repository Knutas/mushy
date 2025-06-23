import { portals } from "./data.js";

export const RadiusControl = L.Control.extend({
  onAdd(map: L.Map) {
    const level = 14;

    const button = L.DomUtil.create("button", "leaflet-bar button-control");
    button.innerHTML = "⭕";
    button.title = `500 m radius circle with level ${level} S2 cells`;

    L.DomEvent.disableClickPropagation(button);

    let active = false;
    let circle: L.Circle | null = null;
    let circleCenter: L.CircleMarker | null = null;
    let s2Layer = L.layerGroup();
    let following = false;

    function escListener(e: KeyboardEvent) {
      if (e.key === "Escape") {
        deactivate();
      }
    }

    function markerOpened(e: CustomEventInit<{ guid: string }>) {
      const guid = e.detail?.guid;
      if (!guid) {
        return;
      }

      const portal = portals.get(guid);
      if (!portal) {
        return;
      }

      following = false;

      const { lat, lng } = portal;
      setLocation({ lat, lng });
    }

    function locationPressHandler(e: CustomEventInit<{ location: L.LatLngLiteral }>) {
      if (following) {
        return;
      }

      following = true;

      locationUpdateHandler(e);
      document.addEventListener("mm:current-location-update", locationUpdateHandler);
    }

    function locationUpdateHandler(e: CustomEventInit<{ location: L.LatLngLiteral }>) {
      if (following && e.detail?.location) {
        setLocation(e.detail.location);
      }
    }

    function activate() {
      active = true;
      button.classList.add("active");
      map.getContainer().classList.add("default-cursor");

      document.addEventListener("keydown", escListener);
      document.addEventListener("mm:marker-open", markerOpened);
      document.addEventListener("mm:current-location-press", locationPressHandler);

      if (!map.hasLayer(s2Layer)) {
        s2Layer.addTo(map);
      }
    }

    function deactivate() {
      active = false;
      button.classList.remove("active");
      map.getContainer().classList.remove("default-cursor");

      document.removeEventListener("keydown", escListener);
      document.removeEventListener("mm:marker-open", markerOpened);
      document.removeEventListener("mm:current-location-press", locationPressHandler);
      document.removeEventListener("mm:current-location-update", locationUpdateHandler);

      if (circle) {
        circle.remove();
        circleCenter?.remove();
        circle = null;
        circleCenter = null;
      }

      if (map.hasLayer(s2Layer)) {
        s2Layer.remove();
        s2Layer.clearLayers();
      }
    }

    button.addEventListener("click", () => {
      if (!active) {
        activate();
      } else {
        deactivate();
      }
    });

    map.on("click", (e) => {
      if (!active) {
        return;
      }

      following = false;

      const { lat, lng } = e.latlng;
      setLocation({ lat, lng });
    });

    async function setLocation(latlng: L.LatLngLiteral) {
      void navigator.clipboard.writeText(`${latlng.lat}, ${latlng.lng}`).catch(() => void 0);

      if (circle) {
        circle.setLatLng(latlng);
        circleCenter?.setLatLng(latlng);
      } else {
        circle = L.circle(latlng, {
          radius: 500,
          color: "red",
          fillColor: "#f03",
          fillOpacity: 0.1,
          interactive: false,
        }).addTo(map);
        circleCenter = L.circleMarker(latlng, {
          radius: 3,
          color: "white",
          fillColor: "red",
          fillOpacity: 1,
          weight: 1,
          interactive: false,
        }).addTo(map);
      }

      drawS2Grid(circle.getLatLng(), circle.getRadius(), circle.getBounds());
    }

    function drawS2Grid(circleCenter: L.LatLng, radius: number, bounds: L.LatLngBounds) {
      s2Layer.clearLayers();
      const step = calculateStepSize(level, circleCenter.lat);
      const cells = new Map<string, L.LatLngLiteral>();

      const nw = bounds.getNorthWest();
      const se = bounds.getSouthEast();
      const startLat = Math.min(nw.lat, se.lat);
      const endLat = Math.max(nw.lat, se.lat) + step.stepLat;
      const startLng = Math.min(nw.lng, se.lng);
      const endLng = Math.max(nw.lng, se.lng);

      for (let lat = startLat; lat <= endLat; lat += step.stepLat) {
        for (let lng = startLng; lng <= endLng; lng += step.stepLng) {
          cells.set(S2.latLngToKey(lat, lng, level), { lat, lng });
        }
      }

      cells.forEach(({ lat, lng }) => {
        const cell = S2.S2Cell.FromLatLng({ lat, lng }, level);
        const corners = cell.getCornerLatLngs();

        if (corners.some((corner) => map.distance(circleCenter, corner) <= radius)) {
          L.polygon(corners, {
            color: "black",
            weight: 1,
            fill: false,
            opacity: 0.5,
            interactive: false,
          }).addTo(s2Layer);
        }
      });
    }

    return button;
  },
});

function calculateStepSize(level: number, latitude: number): { stepLat: number; stepLng: number } {
  const EarthRadius = 6_371_000;
  const EarthCircumference = 2 * Math.PI * EarthRadius;
  const edgeLength = EarthCircumference / Math.pow(2, level + 1) / 3;
  const stepLat = (edgeLength / EarthRadius) * (180 / Math.PI);
  const stepLng = stepLat / Math.cos(latitude * Math.PI / 180);

  return { stepLat, stepLng };
}
