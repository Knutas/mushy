import { PortalType } from "./portals.js";
import { deletePortals, exportPortals, fetchPortalsInView, importFromFile } from "./portals.js";
import { getTypeOptions } from "./utils.js";

export const PortalManagerControl = L.Control.extend({
  onAdd(map: L.Map) {
    const button = L.DomUtil.create("button", "leaflet-bar button-control");
    button.innerHTML = "📍";

    L.DomEvent.disableClickPropagation(button);

    let menuModal: HTMLDialogElement;

    function showMenuModal() {
      if (menuModal == null) {
        menuModal = L.DomUtil.create("dialog", "portal-manager", document.body);
        populateMenuModal(menuModal, map);
      }

      menuModal.showModal();
    }

    button.addEventListener("click", () => showMenuModal());

    return button;
  },
});

function createButton(text: string, onClick: () => void, title?: string) {
  const btn = document.createElement("button");
  btn.innerText = text;

  if (title) {
    btn.title = title;
  }

  btn.addEventListener("click", onClick);

  return btn;
}

function populateMenuModal(menuModal: HTMLDialogElement, map: L.Map) {
  const loadInViewBButton = createButton("Load POIs in view", async () => {
    if (loadInViewBButton.hasAttribute("disabled")) {
      return;
    }

    menuModal.close();

    loadInViewBButton.setAttribute("disabled", "");

    const text = loadInViewBButton.innerText;
    loadInViewBButton.innerText = "⏳";

    await fetchPortalsInView(map);

    loadInViewBButton.removeAttribute("disabled");
    loadInViewBButton.innerText = text;
  }, "Load all POIs in the current view");

  menuModal.appendChild(loadInViewBButton);

  function showImportDialog() {
    menuModal.close();
    importFromFile();
  }

  menuModal.appendChild(createButton("Import…", showImportDialog, "Import from GeoJSON file (ctrl+o)"));

  document.addEventListener("keydown", (e) => {
    if (e.key === "o" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      showImportDialog();
    }
  });

  let exportDialog: ReturnType<typeof typePickerDialog>;

  function showExportDialog() {
    if (exportDialog == null) {
      exportDialog = typePickerDialog("Export", exportPortals);
    }

    exportDialog.reset();
    exportDialog.show();
    menuModal.close();
  }

  menuModal.appendChild(createButton("Export…", showExportDialog, "Export to GeoJSON file (ctrl+s)"));

  document.addEventListener("keydown", (e) => {
    if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      showExportDialog();
    }
  });

  let deleteDialog: ReturnType<typeof typePickerDialog>;

  menuModal.appendChild(createButton("Delete…", () => {
    if (deleteDialog == null) {
      deleteDialog = typePickerDialog("Delete", deletePortals);
    }

    deleteDialog.reset();
    deleteDialog.show();
    menuModal.close();
  }, "Delete layers"));

  menuModal.appendChild(createButton("Close", () => menuModal.close()));
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
