import { createMarker } from "./marker.js";
import { portalTypes } from "./portals.js";
import { clusterOptions, defaultZoom, layerControl, layers, portals } from "./data.js";
import { currentLocationControl, modeControl } from "./controls.js";
import { getEntries } from "./utils.js";

async function init() {
  const baseLayers = getBaseLayers();
  const options = {
    zoomControl: false,
    worldCopyJump: true,
    layers: [Object.values(baseLayers)[0]!],
    doubleTapDragZoom: "center",
    doubleTapDragZoomOptions: {
      reverse: true,
    },
  };
  const map = L.map("map", options);

  getEntries(baseLayers).forEach(([name, layer]) => {
    layerControl.addBaseLayer(layer, name);
  });

  map.addControl(layerControl);

  portalTypes.forEach((type) => layers[type] = L.markerClusterGroup(clusterOptions));

  map.addControl(modeControl);
  modeControl.mode = "survey";

  portals.forEach((portal) => createMarker(portal).addTo(layers[portal.type]));

  await setLocation(map);

  map.on("moveend", () => updateUrl(map));
  map.on("zoomend", () => updateUrl(map));
}

function updateUrl(map: L.Map) {
  const center = map.getCenter();
  const zoom = map.getZoom();
  const url = new URL(window.location.href);
  url.searchParams.set("lat", center.lat.toFixed(6));
  url.searchParams.set("lng", center.lng.toFixed(6));
  url.searchParams.set("zoom", zoom.toString());
  window.history.replaceState(null, "", url.toString());
}

async function setLocation(map: L.Map) {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("lat") && urlParams.has("lng")) {
    const lat = parseFloat(urlParams.get("lat") ?? "0");
    const lng = parseFloat(urlParams.get("lng") ?? "0");
    const zoom = parseInt(urlParams.get("zoom") ?? defaultZoom.toString(), 10);

    map.setView([lat, lng], zoom);
  } else {
    const currentLocation = await currentLocationControl.getCurrentLocation();

    if (currentLocation) {
      currentLocationControl.markCurrentLocation(currentLocation);
    }

    map.setView([currentLocation?.lat ?? 0, currentLocation?.lng ?? 0], defaultZoom);
  }
}

function getBaseLayers() {
  const osmHotBase = L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
    attribution: `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>`,
    maxZoom: 19,
  });
  const osmBase = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>`,
    maxZoom: 19,
  });
  const stadiaOutdoors = L.tileLayer("https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 20,
  });
  const stadiaAlidadeSmoothDark = L.tileLayer("https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 20,
  });
  const googleStreets = L.tileLayer("https://{s}.google.com/vt?lyrs=m&x={x}&y={y}&z={z}", {
    attribution: "&copy; Google",
    maxZoom: 20,
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
  });
  const googleSatellite = L.tileLayer("https://{s}.google.com/vt?lyrs=y,h&x={x}&y={y}&z={z}", {
    attribution: "&copy; Google",
    maxZoom: 20,
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
  });

  return {
    "OpenStreetMap.HOT": osmHotBase,
    "OpenStreetMap": osmBase,
    "Stadia Outdoors": stadiaOutdoors,
    "Stadia Dark": stadiaAlidadeSmoothDark,
    "Google Streets": googleStreets,
    "Google Satellite": googleSatellite,
  };
}

init();
