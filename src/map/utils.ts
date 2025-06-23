import { layers, markers, portals } from "./data.js";
import { Portal, portalMeta, PortalType, portalTypes, savePortals } from "./portals.js";

export const icon = {
  gold: createIcon("gold"),
  red: createIcon("red"),
  green: createIcon("green"),
  orange: createIcon("orange"),
  yellow: createIcon("yellow"),
  violet: createIcon("violet"),
  grey: createIcon("grey"),
  black: createIcon("black"),
};

function createIcon(color: string) {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
}

export function createMarker(portal: Portal) {
  const marker = L.marker([portal.lat, portal.lng], { icon: portalMeta[portal.type].icon });
  markers.set(portal.guid, marker);

  marker.bindPopup(() => {
    marker.getElement()?.dispatchEvent(new CustomEvent("mm:marker-open", { bubbles: true, detail: { guid: portal.guid } }));

    const popupContent = document.createElement("div");

    addPopupImage(portal, popupContent);

    L.DomUtil.create("b", "marker-name", popupContent).innerHTML = portal.name;

    const form = document.createElement("form");
    form.appendChild(getTypeOptions(portal.type));
    form.addEventListener("change", () => {
      const data = new FormData(form);
      const selectedType = data.get("marker-type") as PortalType;
      setMarkerType(portal.guid, selectedType);
    });

    popupContent.appendChild(form);

    return popupContent;
  });

  return marker;
}

function addPopupImage(portal: Portal, popupContent: HTMLDivElement) {
  if (portal.image) {
    const image = portal.image;
    const img = L.DomUtil.create("img", "marker-image", popupContent);
    img.src = image;
    img.addEventListener("click", () => displayImage(image));
  } else if (portal.manual !== true) {
    const loadImage = L.DomUtil.create("button", undefined, popupContent);
    loadImage.innerText = "Load image";

    function noImage() {
      const noImage = document.createTextNode("No image found");
      popupContent.replaceChild(noImage, loadImage);
    }

    loadImage.addEventListener("click", async () => {
      loadImage.innerText = "⏳";
      loadImage.disabled = true;

      const result = await fetch(`https://lanched.ru/PortalGet/searchPortals.php?query=${portal.guid}`);
      if (!result.ok) {
        noImage();
        return;
      }

      const data = await result.json();
      if (data == null) {
        noImage();
        return;
      }

      const image = (data as { guid: string; image: string }[]).find((item) => item.guid === portal.guid)?.image;

      if (!image) {
        noImage();
        return;
      }

      portal.image = image;

      const img = L.DomUtil.create("img", "marker-image");
      img.src = image;
      img.addEventListener("click", () => displayImage(image));
      popupContent.replaceChild(img, loadImage);

      savePortals();
    });
  }
}

export function getTypeOptions(selectedType: PortalType | undefined, multiSelect = false) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "marker-type-options";

  portalTypes.forEach((type) => {
    const label = L.DomUtil.create("label", undefined, fieldset);

    const input = L.DomUtil.create("input", undefined, label);
    input.type = multiSelect ? "checkbox" : "radio";
    input.name = "marker-type";
    input.value = type;
    input.checked = type === selectedType;
    if (type === selectedType) {
      input.setAttribute("checked", "checked");
    }

    label.appendChild(document.createTextNode(portalMeta[type].symbol));
  });

  return fieldset;
}

function setMarkerType(guid: string, type: PortalType) {
  const portal = portals.get(guid);
  const marker = markers.get(guid);

  if (marker && portal) {
    layers[portal.type].removeLayer(marker);
    marker
      .setIcon(portalMeta[type].icon)
      .addTo(layers[type]);
  }

  if (portal) {
    portal.type = type;
    savePortals();
  }
}

export function displayImage(imageUrl: string) {
  const dialog = L.DomUtil.create("dialog", "image-dialog", document.body);

  const img = L.DomUtil.create("img", undefined, dialog);
  img.src = imageUrl;

  dialog.addEventListener("click", () => dialog.close());

  dialog.addEventListener("close", () => dialog.remove());

  dialog.showModal();
}

export async function getCurrentLocation(): Promise<L.LatLngLiteral | null> {
  return new Promise<L.LatLngLiteral | null>((resolve) => {
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude: lat, longitude: lng } = position.coords;

      resolve({ lat, lng });
    }, async () => {
      try {
        const geoIp = await fetch("https://free.freeipapi.com/api/json");
        const { latitude: lat, longitude: lng } = await geoIp.json();

        resolve({ lat, lng });
      } catch {
        resolve(null);
      }
    });
  });
}
