let currentLocationMarker: L.CircleMarker | undefined;

export function markCurrentLocation(map: L.Map, location: L.LatLngLiteral) {
  if (currentLocationMarker === undefined) {
    map.createPane("currentLocation").style.zIndex = "620";
    currentLocationMarker = L.circleMarker(location, {
      radius: 8,
      color: "white",
      fillColor: "dodgerblue",
      fillOpacity: 1,
      weight: 2,
      interactive: true,
      bubblingMouseEvents: false,
      pane: "currentLocation",
    }).addTo(map);

    currentLocationMarker.on("click", () => {
      currentLocationMarker?.getElement()?.dispatchEvent(new CustomEvent("mm:current-location-press", { bubbles: true, detail: { location: currentLocationMarker.getLatLng() } }));
    });
  } else {
    currentLocationMarker.setLatLng(location);
  }

  currentLocationMarker.getElement()?.dispatchEvent(new CustomEvent("mm:current-location-update", { bubbles: true, detail: { location } }));
}
