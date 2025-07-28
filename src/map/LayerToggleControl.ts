import { layerControl, layers } from "./data.js";
import { PortalType } from "./portals.js";

export const LayerToggleControl = L.Control.extend({
  onAdd(map: L.Map) {
    const button = L.DomUtil.create("button", "leaflet-bar button-control active");
    button.innerHTML = "🔢";
    button.title = "Cluster markers";
    L.DomEvent.disableClickPropagation(button);

    let useCluster = true;

    button.addEventListener("click", () => {
      useCluster = !useCluster;

      button.classList.toggle("active", useCluster);

      const visibleLayerTypes: PortalType[] = [];
      Object.entries(layers).forEach(([type, layer]) => {
        if (map.hasLayer(layer)) {
          visibleLayerTypes.push(type as PortalType);
          map.removeLayer(layer);
        }
      });

      Object.values(layers).forEach((layer) => {
        layerControl.removeLayer(layer);
      });

      Object.entries(layers).forEach(([type, layer]) => {
        const items: L.Layer[] = [];
        layer.eachLayer((l: L.Layer) => {
          items.push(l);
        });

        let newLayer: L.MarkerClusterGroup | L.FeatureGroup;
        if (useCluster) {
          newLayer = L.markerClusterGroup({ disableClusteringAtZoom: 17, maxClusterRadius: 50 });
          (newLayer as L.MarkerClusterGroup).addLayers(items);
        } else {
          newLayer = L.featureGroup();
          items.forEach((l) => newLayer.addLayer(l));
        }

        layers[type as PortalType] = newLayer;
        layerControl.addOverlay(newLayer, type);
        if (visibleLayerTypes.includes(type as PortalType)) {
          newLayer.addTo(map);
        }
      });
    });

    return button;
  },
});
