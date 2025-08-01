import { PortalType } from "./portals.js";
import { loadPortals } from "./portals.js";

export const portals = loadPortals();
export const layers: Record<PortalType, L.MarkerClusterGroup | L.FeatureGroup> = {} as Record<PortalType, L.MarkerClusterGroup | L.FeatureGroup>;
export const markers = new Map<string, L.Marker>();
export const layerControl = L.control.layers();
export const clusterOptions: L.MarkerClusterGroupOptions = { disableClusteringAtZoom: 17, maxClusterRadius: 50 };
export const defaultZoom = 13;
