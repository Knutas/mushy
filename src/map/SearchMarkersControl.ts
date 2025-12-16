import { layers, markers, portals } from "./data.js";
import { createMarker } from "./marker.js";
import { getTypeOptionControl } from "./getTypeOptions.js";
import { displayImage } from "./displayImage.js";
import { icon } from "./icon.js";
import { Portal, portalMeta, PortalType, portalTypes } from "./portals.js";
import { savePortals } from "./portals.js";

declare global {
  interface RegExpConstructor {
    escape(str: string): string;
  }
}

export class SearchMarkersControl extends L.Control {
  #container: HTMLDivElement;
  #input: HTMLInputElement;
  #map: L.Map | null = null;
  #filtered = false;
  #searchModal: ReturnType<typeof searchModal> | null = null;

  constructor(options: L.ControlOptions = { position: "topleft" }) {
    super(options);
    this.#container = L.DomUtil.create("div", "leaflet-bar search-control");
    L.DomEvent.disableClickPropagation(this.#container);

    const button = L.DomUtil.create("button", "button-control", this.#container);
    button.innerHTML = "🔍";
    button.title = "Search (ctrl+f)";

    this.#input = L.DomUtil.create("input", undefined, this.#container);
    this.#input.placeholder = "Filter by name…";

    const searchButton = L.DomUtil.create("button", "button-control", this.#container);
    searchButton.innerHTML = "🌐";
    searchButton.title = "Search globally (searches name and full address)";

    const clearButton = L.DomUtil.create("button", "button-control", this.#container);
    clearButton.innerHTML = "✖";
    clearButton.title = "Clear filter";

    button.addEventListener("click", () => this.#activate());

    document.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "f" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.#activate();
        this.#input.select();
      }
    });

    this.#input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.#reset();
      }
    });

    this.#input.addEventListener("input", () => this.#filterVisible());

    this.#input.addEventListener("keypress", (e) => {
      if (e.key !== "Enter" || this.#input.value.trim() === "") {
        return;
      }

      this.#focusVisible();
    });

    this.#input.addEventListener("blur", () => {
      if (this.#input.value.trim() === "") {
        this.#reset();
      }
    });

    clearButton.addEventListener("click", () => this.#reset());

    document.addEventListener("mm:portal-added", () => this.#filterVisible());

    searchButton.addEventListener("click", async () => {
      const query = this.#input.value.trim();
      this.#searchModal?.globalSearch(query);
    });
  }

  override onAdd(map: L.Map) {
    this.#map = map;
    this.#searchModal = searchModal(this.#map);
    return this.#container;
  }

  #activate() {
    this.#container.classList.add("open");
    this.#input.focus();
  }

  #reset() {
    this.#container.classList.remove("open");
    this.#input.value = "";

    markers.forEach((marker, guid) => {
      const portal = portals.get(guid);
      if (portal) {
        layers[portal.type].addLayer(marker);
      }
    });
  }

  #filterVisible() {
    const value = this.#input.value.trim();

    if (value === "" && this.#filtered !== true) {
      return;
    }

    this.#filtered = value !== "";

    const query = new RegExp(RegExp.escape(value), "i");

    const add: Record<PortalType, L.Marker[]> = {
      flower: [],
      mushroom: [],
      unavailable: [],
      unknown: [],
    };
    const remove: Record<PortalType, L.Marker[]> = {
      flower: [],
      mushroom: [],
      unavailable: [],
      unknown: [],
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
      if ("addLayers" in layers[type]) {
        layers[type].addLayers(add[type]);
      } else {
        add[type].forEach((marker) => {
          layers[type].addLayer(marker);
        });
      }
      if ("removeLayers" in layers[type]) {
        layers[type].removeLayers(remove[type]);
      } else {
        remove[type].forEach((marker) => {
          layers[type].removeLayer(marker);
        });
      }
    });
  }

  #focusVisible() {
    const map = this.#map;
    if (!map) {
      return;
    }

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
}

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

        if (portal.type !== "unknown") {
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
      type: "unknown",
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
    form.appendChild(getTypeOptionControl(portal.type));
    form.addEventListener("change", () => {
      const data = new FormData(form);
      const selectedType = data.get("type") as PortalType;
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
