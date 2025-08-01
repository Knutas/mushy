import { AddMarkerControl } from "./AddMarkerControl.js";
import { ClusterControl } from "./ClusterControl.js";
import { CurrentLocationControl } from "./CurrentLocationControl.js";
import { ModeControl } from "./ModeControl.js";
import { PortalManagerControl } from "./PortalManagerControl.js";
import { RadiusControl } from "./RadiusControl.js";
import { SearchMarkersControl } from "./SearchMarkersControl.js";

export const modeControl = new ModeControl();
export const searchMarkersControl = new SearchMarkersControl();
export const portalManagerControl = new PortalManagerControl();
export const radiusControl = new RadiusControl();
export const currentLocationControl = new CurrentLocationControl();
export const addMarkerControl = new AddMarkerControl();
export const clusterControl = new ClusterControl();

export const allControls = [
  modeControl,
  searchMarkersControl,
  portalManagerControl,
  radiusControl,
  currentLocationControl,
  addMarkerControl,
  clusterControl,
];
