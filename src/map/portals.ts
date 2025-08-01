import { layers, markers, portals } from "./data.js";
import { createMarker } from "./marker.js";
import { icon } from "./icon.js";

export const portalMeta = {
  Flower: { icon: icon.green, symbol: "🌼" },
  Mushroom: { icon: icon.red, symbol: "🍄" },
  Unavailable: { icon: icon.grey, symbol: "✖" },
  Unknown: { icon: icon.black, symbol: "❔" },
};

export type PortalType = keyof typeof portalMeta;
export const portalTypes = Object.keys(portalMeta) as PortalType[];

export type Option = {
  text: string;
  value: string;
  symbol: string;
};

export const cookSizeMeta = {
  small: { text: "Small", value: "small", symbol: "S" },
  normal: { text: "Normal", value: "normal", symbol: "N" },
  large: { text: "Large", value: "large", symbol: "L" },
  giant: { text: "Giant", value: "giant", symbol: "G" },
  unknown: { text: "Unknown", value: "unknown", symbol: "?" },
} satisfies Record<string, Option>;

export type CookSize = keyof typeof cookSizeMeta;
export const cookSizes = Object.keys(cookSizeMeta) as CookSize[];

export const cookTypeMeta = {
  red: { text: "Red", value: "red", symbol: "🟥" },
  yellow: { text: "Yellow", value: "yellow", symbol: "🟨" },
  blue: { text: "Blue", value: "blue", symbol: "🟦" },
  purple: { text: "Purple", value: "purple", symbol: "🟪" },
  white: { text: "White", value: "white", symbol: "⬜️" },
  pink: { text: "Pink", value: "pink", symbol: "💟" },
  gray: { text: "Gray", value: "gray", symbol: "⬛" },
  fire: { text: "Fire", value: "fire", symbol: "🔥" },
  water: { text: "Water", value: "water", symbol: "💧" },
  crystal: { text: "Crystal", value: "crystal", symbol: "💎" },
  electric: { text: "Electric", value: "electric", symbol: "⚡️" },
  poisonous: { text: "Poisonous", value: "poisonous", symbol: "☠️" },
  event: { text: "Event", value: "event", symbol: "✨" },
  unknown: { text: "Unknown", value: "unknown", symbol: "❔" },
} satisfies Record<string, Option>;

export type CookType = keyof typeof cookTypeMeta;
export const cookTypes = Object.keys(cookTypeMeta) as CookType[];

export type Cook = {
  size: CookSize;
  type: CookType;
  start: Date;
  safe: boolean;
  end?: Date | undefined;
  note?: string | undefined;
};

export type Portal = {
  guid: string;
  lat: number;
  lng: number;
  name: string;
  type: PortalType;
  image?: string | undefined;
  cooks?: Cook[] | undefined;
  manual?: boolean;
};

export function loadPortals() {
  const storedPortals = JSON.parse(localStorage.getItem("portals") || "[]") as Portal[];
  const normalizedPortals: Map<string, Portal> = new Map(storedPortals.map<[string, Portal]>((portal) => [portal.guid, {
    guid: portal.guid,
    lat: portal.lat,
    lng: portal.lng,
    name: portal.name,
    type: portal.type ?? "Unknown",
    image: portal.image,
    cooks: portal.cooks?.map((c) => ({ ...c, start: new Date(c.start), end: c.end ? new Date(c.end) : undefined })),
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
        const { name, type, guid, cooks, manual } = feature.properties;

        const id = guid ?? crypto.randomUUID();

        const portal: Portal = {
          guid: id,
          lat: coordinates[1],
          lng: coordinates[0],
          name: name ?? id,
          type: type ?? "Unknown",
          cooks: cooks?.map((c: Cook) => ({ ...c, start: new Date(c.start), end: c.end ? new Date(c.end) : undefined })),
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
            cooks: portal.cooks,
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

export const hp = {
  small: {
    red: 87_400,
    yellow: 84_200,
    blue: 84_200,
    purple: 93_900,
    white: 81_000,
    pink: 81_000,
    gray: 90_700,
  },
  normal: {
    red: 670_600,
    yellow: 645_800,
    blue: 645_800,
    purple: 720_300,
    white: 621_000,
    pink: 621_000,
    gray: 695_500,
    fire: 3_850_200,
    water: 3_816_700,
    crystal: 3_883_600,
    electric: 3_816_700,
    poisonous: 3_783_200,
    event: 648_000,
  },
  large: {
    red: 2_916_000,
    yellow: 2_808_000,
    blue: 2_808_000,
    purple: 3_132_000,
    white: 2_700_000,
    pink: 2_700_000,
    gray: 3_024_000,
    fire: 13_662_000,
    water: 13_543_200,
    crystal: 13_780_800,
    electric: 13_543_200,
    poisonous: 13_424_400,
  },
  giant: {
    event: 2_880_000,
  },
};
