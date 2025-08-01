import { PortalType } from "./portals.js";
import { deletePortals, exportPortals, fetchPortalsInView, importFromFile } from "./portals.js";
import { getTypeOptions } from "./getTypeOptions.js";

export class PortalManagerControl extends L.Control {
  #button: HTMLButtonElement;
  #menuModal: ReturnType<typeof portalManager> | null = null;

  constructor(options: L.ControlOptions = { position: "topleft" }) {
    super(options);
    this.#button = L.DomUtil.create("button", "leaflet-bar button-control");
    this.#button.innerHTML = "📍";

    L.DomEvent.disableClickPropagation(this.#button);

    this.#button.addEventListener("click", () => this.#menuModal?.show());
  }

  override onAdd(map: L.Map) {
    this.#menuModal = portalManager(map);
    this.#menuModal.bindKeys();

    return this.#button;
  }
}

function portalManager(map: L.Map) {
  let menuModal: HTMLDialogElement | null = null;
  let exportDialog: ReturnType<typeof typePickerDialog> | null = null;
  let deleteDialog: ReturnType<typeof typePickerDialog> | null = null;

  function show() {
    if (menuModal == null) {
      menuModal = L.DomUtil.create("dialog", "vertical", document.body);
      populateMenuModal(menuModal);
    }

    menuModal.showModal();
  }

  function bindKeys() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "o" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        showImport();
      } else if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        showExport();
      }
    });
  }

  async function loadInView(loadInViewBButton: HTMLButtonElement) {
    if (loadInViewBButton.hasAttribute("disabled")) {
      return;
    }

    menuModal?.close();

    loadInViewBButton.setAttribute("disabled", "");

    const text = loadInViewBButton.innerText;
    loadInViewBButton.innerText = "⏳";

    await fetchPortalsInView(map);

    loadInViewBButton.removeAttribute("disabled");
    loadInViewBButton.innerText = text;
  }

  function showImport() {
    menuModal?.close();
    importFromFile();
  }

  function showExport() {
    if (exportDialog == null) {
      exportDialog = typePickerDialog("Export", exportPortals);
    }

    exportDialog.reset();
    exportDialog.show();
    menuModal?.close();
  }

  function showDelete() {
    if (deleteDialog == null) {
      deleteDialog = typePickerDialog("Delete", deletePortals);
    }

    deleteDialog.reset();
    deleteDialog.show();
    menuModal?.close();
  }

  function populateMenuModal(menuModal: HTMLDialogElement) {
    const loadInViewButton = createButton("Load POIs in view", () => loadInView(loadInViewButton), "Load all POIs in the current view");
    menuModal.appendChild(loadInViewButton);

    menuModal.appendChild(createButton("Import…", showImport, "Import from GeoJSON file (ctrl+o)"));

    menuModal.appendChild(createButton("Export…", showExport, "Export to GeoJSON file (ctrl+s)"));

    menuModal.appendChild(createButton("Delete…", showDelete, "Delete layers"));

    menuModal.appendChild(createButton("Close", () => menuModal.close()));
  }

  function createButton(text: string, onClick: () => void, title?: string) {
    const btn = document.createElement("button");
    btn.innerText = text;

    if (title) {
      btn.title = title;
    }

    btn.addEventListener("click", onClick);

    return btn;
  }

  function typePickerDialog(actionText: string, callback: (types: PortalType[]) => void) {
    const typeDialog = L.DomUtil.create("dialog", undefined, document.body);
    const form = L.DomUtil.create("form", undefined, typeDialog);
    form.appendChild(getTypeOptions(undefined, true));

    const actions = L.DomUtil.create("div", "action-container", typeDialog);
    actions.appendChild(createButton(actionText, () => {
      const data = new FormData(form);
      const selectedTypes = data.getAll("marker-type") as PortalType[];
      callback(selectedTypes);
      typeDialog.close();
    }));
    actions.appendChild(createButton("Close", () => typeDialog.close()));

    return { show: () => typeDialog.showModal(), reset: () => form.reset() };
  }

  return { show, bindKeys };
}
