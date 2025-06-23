import { layers, markers, portals } from "./data.js";
import { createMarker, displayImage, getTypeOptions, icon } from "./utils.js";
import { Portal, portalMeta, PortalType, portalTypes } from "./portals.js";
import { savePortals } from "./portals.js";

declare global {
  interface RegExpConstructor {
    escape(str: string): string;
  }
}

export const SearchMarkersControl = L.Control.extend({
  onAdd(map: L.Map) {
    const container = L.DomUtil.create("div", "leaflet-bar search-control");
    L.DomEvent.disableClickPropagation(container);

    let filtered = false;

    const button = L.DomUtil.create("button", "button-control", container);
    button.innerHTML = "🔍";
    button.title = "Search (ctrl+f)";

    const input = L.DomUtil.create("input", undefined, container);
    input.placeholder = "Filter by name…";

    const searchButton = L.DomUtil.create("button", "button-control", container);
    searchButton.innerHTML = "🌐";
    searchButton.title = "Search globally (searches name and full address)";

    const clearButton = L.DomUtil.create("button", "button-control", container);
    clearButton.innerHTML = "✖";
    clearButton.title = "Clear filter";

    function activate() {
      container.classList.add("open");
      input.focus();
    }

    function reset() {
      container.classList.remove("open");
      input.value = "";

      markers.forEach((marker, guid) => {
        const portal = portals.get(guid);
        if (portal) {
          layers[portal.type].addLayer(marker);
        }
      });
    }

    function filterVisible() {
      const value = input.value.trim();

      if (value === "" && filtered !== true) {
        return;
      }

      filtered = value !== "";

      const query = new RegExp(RegExp.escape(value), "i");

      const add: Record<PortalType, L.Marker[]> = {
        Flower: [],
        Mushroom: [],
        Unavailable: [],
        Unknown: [],
      };
      const remove: Record<PortalType, L.Marker[]> = {
        Flower: [],
        Mushroom: [],
        Unavailable: [],
        Unknown: [],
      };

      markers.forEach((marker, guid) => {
        const portal = portals.get(guid);
        if (!portal) {
          return;
        }

        if (query.test(portal.name)) {
          add[portal.type].push(marker);
        } else {
          remove[portal.type].push(marker);
        }
      });

      portalTypes.forEach((type) => {
        layers[type].addLayers(add[type]);
        layers[type].removeLayers(remove[type]);
      });
    }

    function focusVisible() {
      const bounds = Object.values(layers)
        .filter((l) => map.hasLayer(l) && l.getLayers().length !== 0)
        .reduce((sum, layerGroup) => sum.extend(layerGroup.getBounds()), L.latLngBounds([]));

      if (bounds.isValid()) {
        map.fitBounds(bounds);

        const hits = Object.values(layers).flatMap((layer) => layer.getLayers());
        if (hits.length === 1) {
          hits[0]!.openPopup();
        }
      }
    }

    button.addEventListener("click", activate);

    document.addEventListener("keydown", (e) => {
      if (e.key === "f" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        activate();
        input.select();
      }
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        reset();
      }
    });

    input.addEventListener("input", filterVisible);

    input.addEventListener("keypress", (e) => {
      if (e.key !== "Enter" || input.value.trim() === "") {
        return;
      }

      focusVisible();
    });

    input.addEventListener("blur", () => {
      if (input.value.trim() === "") {
        reset();
      }
    });

    clearButton.addEventListener("click", () => {
      reset();
    });

    document.addEventListener("mm:portal-added", filterVisible);

    const search = searchModal(map);

    searchButton.addEventListener("click", async () => {
      const query = input.value.trim();
      search.globalSearch(query);
    });

    return container;
  },
});

function searchModal(map: L.Map) {
  type SearchResult = {
    guid: string;
    image: string;
    lat: number;
    lng: number;
    name: string;
    address: string;
  };

  let initialized = false;
  let lastTerm = "";
  let dialog: HTMLDialogElement;
  let resultList: HTMLDivElement;
  let resultLoading: HTMLDivElement;
  let loadMoreButton: HTMLButtonElement;
  let searchOffset = 0;

  function init() {
    initialized = true;

    dialog = L.DomUtil.create("dialog", "search-result", document.body);
    dialog.setAttribute("closedby", "any");

    resultList = L.DomUtil.create("div", "search-result-list", dialog);
    resultLoading = L.DomUtil.create("div");
    resultLoading.innerHTML = "Loading…";

    loadMoreButton = L.DomUtil.create("button");
    loadMoreButton.innerText = "Load more";
    loadMoreButton.addEventListener("click", async () => {
      searchOffset += 50;
      const initialText = loadMoreButton.innerHTML;
      loadMoreButton.innerHTML = "⏳";
      loadMoreButton.disabled = true;
      await updateSearch();
      loadMoreButton.innerHTML = initialText;
      loadMoreButton.disabled = false;
    });
  }

  function globalSearch(searchTerm: string) {
    if (!initialized) {
      init();
    }

    if (searchTerm === lastTerm) {
      dialog.showModal();
      return;
    }

    lastTerm = searchTerm;
    reset();

    dialog.showModal();
    void updateSearch();
  }

  function reset() {
    searchOffset = 0;

    while (resultList?.firstChild) {
      resultList.firstChild.remove();
    }

    resultList.appendChild(resultLoading);

    loadMoreButton.remove();
  }

  async function updateSearch() {
    const results = await searchPortals(lastTerm, searchOffset);

    resultLoading?.remove();

    if (results.length < 50) {
      loadMoreButton.remove();

      if (results.length === 0) {
        if (resultList.childElementCount === 0) {
          resultList.append("No matches found.");
        }

        return;
      }
    } else {
      dialog.appendChild(loadMoreButton);
    }

    results.forEach((result) => {
      const item = L.DomUtil.create("div", undefined, resultList);
      item.addEventListener("click", () => {
        showPortal(result);
        dialog.close();
      });

      if (result.image === "") {
        L.DomUtil.create("div", "search-result-symbol", item).innerHTML = "❔";
      } else {
        const img = L.DomUtil.create("img", "search-result-image", item);
        img.src = result.image;
        img.addEventListener("click", (e) => {
          e.stopPropagation();
          displayImage(result.image);
        });
      }

      L.DomUtil.create("div", "search-result-text", item).innerHTML = `<header>${result.name}</header><div>${result.address}</div>`;

      if (portals.has(result.guid)) {
        const portal = portals.get(result.guid)!;

        if (portal.type !== "Unknown") {
          L.DomUtil.create("div", "search-result-symbol", item).innerHTML = portalMeta[portal.type].symbol;
        }
      }
    });

    if (resultList.childElementCount === 0) {
      L.DomUtil.create("div", undefined, resultList).innerHTML = "No results found";
    }
  }

  async function searchPortals(query: string, offset: number = 0) {
    try {
      const result = await fetch(`https://lanched.ru/PortalGet/searchPortals.php?query=${encodeURIComponent(query)}&offset=${offset}`);
      if (result.ok) {
        const data = await result.json();

        if (data == null) {
          return [];
        }

        return data as SearchResult[];
      }
    } catch (error) {
      console.error("Error fetching search results:", error);
    }

    return [];
  }

  function showPortal(result: SearchResult) {
    const portal = portals.get(result.guid);
    if (portal) {
      map.setView([portal.lat, portal.lng]);
      markers.get(portal.guid)?.openPopup();
    } else {
      createTempMarker(result);
      map.setView([result.lat, result.lng]);
    }
  }

  function createTempMarker(result: SearchResult) {
    const portal: Portal = {
      guid: result.guid,
      lat: result.lat,
      lng: result.lng,
      name: result.name,
      type: "Unknown",
      image: result.image,
    };

    const marker = L.marker([portal.lat, portal.lng], { icon: icon.violet }).addTo(map);

    const popupContent = document.createElement("div");
    if (portal.image) {
      const image = portal.image;
      const img = L.DomUtil.create("img", "marker-image", popupContent);
      img.src = image;
      img.addEventListener("click", () => displayImage(image));
    }

    L.DomUtil.create("b", "marker-name", popupContent).innerHTML = portal.name;

    const form = document.createElement("form");
    form.appendChild(getTypeOptions(portal.type));
    form.addEventListener("change", () => {
      const data = new FormData(form);
      const selectedType = data.get("marker-type") as PortalType;
      portal.type = selectedType;
    });

    popupContent.appendChild(form);

    const actions = L.DomUtil.create("div", "action-container", popupContent);

    const saveButton = document.createElement("button");
    saveButton.innerText = "Save";
    saveButton.addEventListener("click", () => {
      portals.set(portal.guid, portal);
      createMarker(portal).addTo(layers[portal.type]);
      savePortals();
      marker.remove();
    });
    actions.appendChild(saveButton);

    const deleteButton = document.createElement("button");
    deleteButton.innerText = "Delete";
    deleteButton.addEventListener("click", () => {
      marker.remove();
    });
    actions.appendChild(deleteButton);

    popupContent.appendChild(actions);

    marker.bindPopup(popupContent).openPopup();
  }

  return { globalSearch };
}
