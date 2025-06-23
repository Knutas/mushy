import { layers, markers, portals } from "./data.js";
import { createMarker, icon } from "./utils.js";

export const portalMeta = {
  Flower: { icon: icon.green, symbol: "🌼" },
  Mushroom: { icon: icon.red, symbol: "🍄" },
  Unavailable: { icon: icon.grey, symbol: "✖" },
  Unknown: { icon: icon.black, symbol: "❔" },
};

export type PortalType = keyof typeof portalMeta;
export const portalTypes = Object.keys(portalMeta) as PortalType[];

export type Portal = {
  guid: string;
  lat: number;
  lng: number;
  name: string;
  type: PortalType;
  image?: string | undefined;
  manual?: boolean;
};

export function loadPortals() {
  const storedPortals = JSON.parse(localStorage.getItem("portals") || "[]") as Portal[];
  const normalizedPortals: Map<string, Portal> = new Map(storedPortals.map<[string, Portal]>((portal) => [portal.guid, {
    guid: portal.guid,
    lat: portal.lat,
    lng: portal.lng,
    name: portal.name.toString(),
    type: portal.type ?? "Unknown",
    image: portal.image,
    manual: portal.manual ?? (portal.guid.endsWith(".16") ? false : true),
  }]));

  return normalizedPortals;
}

export function savePortals() {
  const portalsArray = Array.from(portals.values());
  localStorage.setItem("portals", JSON.stringify(portalsArray));
}

export async function fetchPortalsInView(map: L.Map) {
  const bounds = map.getBounds();
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const url = `https://lanched.ru/PortalGet/getPortals.php?nelat=${ne.lat}&nelng=${ne.lng}&swlat=${sw.lat}&swlng=${sw.lng}`;
  const fetched = await fetchPortals(url);

  const type = "Unknown";
  for (const portal of fetched) {
    if (!markers.has(portal.guid)) {
      portals.set(portal.guid, portal);
      createMarker(portal).addTo(layers[type]);
    }
  }

  savePortals();
  document.dispatchEvent(new Event("mm:portal-added"));
}

function createFromFile(e: ProgressEvent<FileReader>) {
  try {
    const geoJSON = JSON.parse(e.target?.result as string);
    if (geoJSON.type !== "FeatureCollection" || !Array.isArray(geoJSON.features)) {
      throw new Error("Invalid GeoJSON format");
    }

    geoJSON.features.forEach((feature: any) => {
      if (
        feature.type === "Feature" &&
        feature.geometry.type === "Point" &&
        feature.properties
      ) {
        const { coordinates } = feature.geometry;
        const { name, type, guid, manual } = feature.properties;

        const id = guid ?? crypto.randomUUID();

        const portal: Portal = {
          guid: id,
          lat: coordinates[1],
          lng: coordinates[0],
          name: name ?? id,
          type: type ?? "Unknown",
          manual: manual ?? (guid.endsWith(".16") ? false : true),
        };

        const existingPortal = portals.get(portal.guid);
        if (existingPortal) {
          layers[existingPortal.type].removeLayer(markers.get(portal.guid)!);
        }

        portals.set(portal.guid, portal);
        createMarker(portal).addTo(layers[portal.type]);
      }
    });

    savePortals();
    document.dispatchEvent(new Event("mm:portal-added"));
  } catch (error) {
    if (error instanceof Error) {
      alert(`Failed to import: ${error.message}`);
    }
  }
}

export function importFromFile() {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".geojson";
  fileInput.hidden = true;

  fileInput.addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", createFromFile);

    reader.readAsText(file);
    fileInput.remove();
  });

  fileInput.click();
}

export function exportPortals(types: PortalType[]) {
  const geoJSON = {
    type: "FeatureCollection",
    features: Array.from(portals)
      .map(([_, portal]) => portal)
      .filter((portal) => types.length === 0 || types.includes(portal.type))
      .map((portal) => {
        return {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [portal.lng, portal.lat],
          },
          properties: {
            name: portal.name,
            type: portal.type,
            guid: portal.guid,
            manual: portal.manual,
          },
        };
      }),
  };

  const blob = new Blob([JSON.stringify(geoJSON)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = types.length === 0 || types.length === 4 ? "markers.geojson" : `${types.join(",")}.geojson`;
  a.click();
  URL.revokeObjectURL(url);
}

export function deletePortals(types: PortalType[]) {
  if (types.length === 0) {
    return;
  }

  portals.forEach((portal, guid) => {
    if (types.includes(portal.type)) {
      layers[portal.type].removeLayer(markers.get(guid)!);
      markers.delete(guid);
      portals.delete(guid);
    }
  });

  savePortals();
}

async function fetchPortals(url: string) {
  let offset = 0;
  const portals: Portal[] = [];

  do {
    const response = await fetch(`${url}&offset=${offset}`);
    if (!response.ok) {
      console.error("Failed to fetch portals:", response.statusText);
      return portals;
    }

    const data = await response.json();

    offset = data.nextOffset;
    const portalData = data.portalData.map((portal: any) => ({
      guid: portal.guid,
      lat: portal.lat,
      lng: portal.lng,
      name: portal.name.toString(),
      type: portal.type ?? "Unknown",
    }));

    portals.push(...portalData);
  } while (offset !== -1);

  return portals;
}
