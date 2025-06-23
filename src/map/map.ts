import { AddMarkerControl } from "./AddMarkerControl.js";
import { CurrentLocationControl } from "./CurrentLocationControl.js";
import { createMarker, getCurrentLocation } from "./utils.js";
import { portalTypes } from "./portals.js";
import { markCurrentLocation } from "./currentLocationMarker.js";
import { PortalManagerControl } from "./PortalManagerControl.js";
import { RadiusControl } from "./RadiusControl.js";
import { SearchMarkersControl } from "./SearchMarkersControl.js";
import { defaultZoom, layers, portals } from "./data.js";

async function init() {
  const osmHotBase = L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
    attribution: `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>`,
    maxZoom: 19,
  });
  const osmBase = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>`,
    maxZoom: 19,
  });
  const stadia_Outdoors = L.tileLayer("https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.png", {
    maxZoom: 20,
    attribution:
      '&copy; <a href="https://www.stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });
  const stadia_AlidadeSmoothDark = L.tileLayer("https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png", {
    maxZoom: 20,
    attribution:
      '&copy; <a href="https://www.stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });
  const stadia_AlidadeSatellite = L.tileLayer("https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg", {
    maxZoom: 20,
    attribution:
      '&copy; CNES, Distribution Airbus DS, © Airbus DS, © PlanetObserver (Contains Copernicus Data) | &copy; <a href="https://www.stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });

  const options = {
    zoomControl: false,
    worldCopyJump: true,
    layers: [osmHotBase],
    doubleTapDragZoom: "center",
    doubleTapDragZoomOptions: {
      reverse: true,
    },
  };
  const map = L.map("map", options);

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("lat") && urlParams.has("lng")) {
    const lat = parseFloat(urlParams.get("lat") ?? "0");
    const lng = parseFloat(urlParams.get("lng") ?? "0");
    const zoom = parseInt(urlParams.get("zoom") ?? defaultZoom.toString(), 10);

    map.setView([lat, lng], zoom);
  } else {
    const currentLocation = await getCurrentLocation();

    if (currentLocation) {
      markCurrentLocation(map, currentLocation);
    }

    map.setView([currentLocation?.lat ?? 0, currentLocation?.lng ?? 0], defaultZoom);
  }

  map.on("moveend", () => {
    const center = map.getCenter();
    const zoom = map.getZoom();
    const url = new URL(window.location.href);
    url.searchParams.set("lat", center.lat.toFixed(6));
    url.searchParams.set("lng", center.lng.toFixed(6));
    url.searchParams.set("zoom", zoom.toString());
    window.history.replaceState(null, "", url.toString());
  });

  portalTypes.forEach((type) => {
    layers[type] = L.markerClusterGroup({ disableClusteringAtZoom: 17, maxClusterRadius: 50 }).addTo(map);
  });

  portals.forEach((portal) => {
    createMarker(portal).addTo(layers[portal.type]);
  });

  const baseMaps = {
    "OpenStreetMap.HOT": osmHotBase,
    "OpenStreetMap": osmBase,
    "Stadia Outdoors": stadia_Outdoors,
    "Stadia Alidade Smooth Dark": stadia_AlidadeSmoothDark,
    "Stadia Alidade Satellite": stadia_AlidadeSatellite,
  };

  L.control.layers(baseMaps, layers).addTo(map);

  map.addControl(new SearchMarkersControl({ position: "topleft" }));
  map.addControl(new PortalManagerControl({ position: "topleft" }));
  map.addControl(new RadiusControl({ position: "topleft" }));
  map.addControl(new CurrentLocationControl({ position: "topleft" }));
  map.addControl(new AddMarkerControl({ position: "topleft" }));
}

init();
