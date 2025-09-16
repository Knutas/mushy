import { clusterOptions, layerControl, layers } from "./data.js";
import { portalMeta } from "./portals.js";
import { getEntries } from "./utils.js";

export class ClusterControl extends L.Control {
  #button: HTMLButtonElement;
  #useClustering: boolean = true;
  #map: L.Map | null = null;

  constructor(options: L.ControlOptions = { position: "topleft" }) {
    super(options);
    this.#button = L.DomUtil.create("button", "leaflet-bar button-control active");
    this.#button.innerHTML = "🔢";
    this.#button.title = "Cluster markers";
    L.DomEvent.disableClickPropagation(this.#button);
    this.#button.addEventListener("click", () => this.toggle());
  }

  override onAdd(map: L.Map) {
    this.#map = map;
    return this.#button;
  }

  toggle(useClustering = !this.#useClustering) {
    const map = this.#map;
    if (!map) {
      return;
    }

    this.#useClustering = useClustering;
    this.#button.classList.toggle("active", this.#useClustering);

    getEntries(layers).forEach(([type, layer]) => {
      const items: L.Layer[] = [];
      layer.eachLayer((l: L.Layer) => items.push(l));

      let newLayer: L.MarkerClusterGroup | L.FeatureGroup;
      if (this.#useClustering) {
        newLayer = L.markerClusterGroup(clusterOptions);
        (newLayer as L.MarkerClusterGroup).addLayers(items);
      } else {
        newLayer = L.featureGroup();
        items.forEach((l) => newLayer.addLayer(l));
      }

      layers[type] = newLayer;
      layerControl.removeLayer(layer);
      layerControl.addOverlay(newLayer, portalMeta[type].text);
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
        map.addLayer(newLayer);
      }
    });
  }
}
