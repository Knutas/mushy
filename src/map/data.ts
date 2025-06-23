import { PortalType } from "./portals.js";
import { loadPortals } from "./portals.js";

export const portals = loadPortals();
export const layers: Record<PortalType, L.MarkerClusterGroup> = {} as Record<PortalType, L.MarkerClusterGroup>;
export const markers = new Map<string, L.Marker>();
export const defaultZoom = 13;
