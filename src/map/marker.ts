import { Layer } from "leaflet";
import { modeControl } from "./controls.js";
import { layers, markers, portals } from "./data.js";
import { displayImage } from "./displayImage.js";
import { getOptionControl, getTypeOptionControl } from "./getTypeOptions.js";
import { Cook, CookSize, cookSizeMeta, CookType, cookTypeMeta, cookTypes, hp, Option, Portal, portalMeta, PortalType, savePortals } from "./portals.js";
import { createNumericInput, formatDateTime, getSecondsRemaining, parseNumber, relativeFromSeconds } from "../time/utils.js";

export function createMarker(portal: Portal) {
  const marker = L.marker([portal.lat, portal.lng], { icon: portalMeta[portal.type].icon });
  markers.set(portal.guid, marker);

  marker.bindPopup((layer) => {
    marker.getElement()?.dispatchEvent(new CustomEvent("mm:marker-open", { bubbles: true, detail: { guid: portal.guid } }));

    switch (modeControl.mode) {
      case "cook":
        return cookPopup(portal, layer);
      default:
        return surveyPopup(portal);
    }
  });

  return marker;
}

function surveyPopup(portal: Portal) {
  const popupContent = document.createElement("div");

  addPopupImage(portal, popupContent);

  L.DomUtil.create("b", "marker-name", popupContent).innerHTML = portal.name;

  const form = document.createElement("form");
  form.appendChild(getTypeOptionControl(portal.type));
  form.addEventListener("change", () => {
    const data = new FormData(form);
    const selectedType = data.get("type") as PortalType;
    setMarkerType(portal.guid, selectedType);
  });

  popupContent.appendChild(form);

  return popupContent;
}

function cookPopup(portal: Portal, layer: Layer) {
  const popupContent = document.createElement("div");
  L.DomUtil.create("b", "marker-name", popupContent).innerHTML = portal.name;

  if (portal.cooks && portal.cooks.length > 0) {
    const cookList = L.DomUtil.create("ul", "cook-list", popupContent);
    portal.cooks
      .slice()
      .sort((a, b) => (a.end?.valueOf() ?? Number.MAX_SAFE_INTEGER) - (b.end?.valueOf() ?? Number.MAX_SAFE_INTEGER))
      .slice(0, 5)
      .forEach((cook) => {
        const item = L.DomUtil.create("li", undefined, cookList);
        const timeNode = (() => {
          if (cook.end) {
            const end = document.createElement("span");
            end.title = `Ended ${formatDateTime(cook.end)}`;
            end.innerText = relativeFromSeconds((cook.end.valueOf() - cook.start.valueOf()) / 1000, false);
            return end;
          }

          return "Ongoing";
        })();
        const typeText = `${cookSizeMeta[cook.size].symbol}${cookTypeMeta[cook.type].symbol}`;
        item.append(cook.safe === false ? "❗" : "", " ", timeNode, ` ${typeText}`);

        if (cook.note) {
          const note = L.DomUtil.create("span", "cook-note", item);
          note.innerText = " 📝";
          note.title = cook.note;
        }

        if (cook.end) {
          const edit = L.DomUtil.create("button", undefined, item);
          edit.innerText = "✏️";
          edit.addEventListener("click", () => editCook(portal, cook, layer));
        }
      });
  } else {
    const noCooks = document.createElement("div");
    noCooks.innerText = "No cooking history";
    popupContent.appendChild(noCooks);
  }

  const action = L.DomUtil.create("button", undefined, popupContent);
  const cookable = portal.cooks == null || portal.cooks.length === 0 || portal.cooks.every((c) => c.end != null);
  action.innerText = cookable ? "Start cooking" : "End cooking";
  action.addEventListener("click", () => {
    if (cookable) {
      startCookModal(portal, layer);
    } else {
      finishCookModal(portal, layer);
    }
  });

  return popupContent;
}

function startCookModal(portal: Portal, layer: Layer) {
  const dialog = L.DomUtil.create("dialog", "cook-dialog", document.body);

  let size: CookSize | null = null;
  let type: CookType | null = null;

  const form = document.createElement("form");
  const sizeOptions: Option[] = Object.values(cookSizeMeta);
  form.appendChild(getOptionControl(sizeOptions, "size"));

  form.addEventListener("change", () => {
    const data = new FormData(form);
    if (size == null) {
      size = data.get("size") as CookSize;
      const types: CookType[] = typesForSize(size);
      const typeOptions: Option[] = types.map((t) => cookTypeMeta[t]);

      if (types.length === 1) {
        type = types[0]!;
        startCook(portal, size, type, layer);
        dialog.close();
        return;
      }

      typeOptions.push(cookTypeMeta.unknown);
      form.replaceChild(getOptionControl(typeOptions, "type"), form.firstChild!);
      return;
    }

    if (type == null) {
      type = data.get("type") as CookType;
      startCook(portal, size, type, layer);
      dialog.close();
    }
  });

  dialog.appendChild(form);

  dialog.addEventListener("close", () => dialog.remove());
  dialog.showModal();
}

function typesForSize(size: CookSize) {
  if (size === "unknown") {
    return cookTypes;
  }

  return Object.keys(hp[size]) as CookType[];
}

function startCook(portal: Portal, size: CookSize, type: CookType, layer: Layer) {
  const now = roundToMinute(new Date());
  portal.cooks ??= [];
  portal.cooks.push({ start: now, size, type, safe: true });
  savePortals();
  layer.closePopup();
}

function finishCookModal(portal: Portal, layer: Layer) {
  const cook = portal.cooks?.find((c) => c.end == null);
  if (!cook) {
    return;
  }

  const dialog = L.DomUtil.create("dialog", "vertical", document.body);
  const endTime = new Date();

  const confirm = (startTime: Date) => confirmFinishCook(cook, dialog, layer, startTime, endTime);

  dialog.appendChild(createButton("End now", () => confirm(cook.start)));

  dialog.appendChild(createButton("End with duration", () => {
    startTimeFromDuration(confirm, endTime, dialog);
  }));

  if (cook.size !== "unknown" && cook.type !== "unknown") {
    dialog.appendChild(createButton("End from HP", () => {
      startTimeFromHp(cook, confirm, endTime, dialog);
    }));
  }

  const abandonPopover = L.DomUtil.create("div", "vertical", dialog);
  abandonPopover.innerText = "Remove ongoing cook from history?";
  abandonPopover.popover = "auto";
  abandonPopover.append(
    createButton("Yes", () => {
      portal.cooks = portal.cooks?.filter((c) => c !== cook);
      savePortals();
      layer.closePopup();
      dialog.close();
    }),
    createButton("No", () => dialog.close()),
  );

  const abandonButton = L.DomUtil.create("button", undefined, dialog);
  abandonButton.innerText = "Abandon";
  abandonButton.popoverTargetElement = abandonPopover;

  dialog.appendChild(createButton("Cancel", () => dialog.close()));

  dialog.addEventListener("close", () => dialog.remove());
  dialog.showModal();
}

function startTimeFromDuration(confirm: (startTime: Date) => void, endTime: Date, dialog: HTMLDialogElement) {
  const daysInput = createNumericInput(5, true);
  const daysLabel = document.createElement("label");
  daysLabel.innerText = "Days: ";
  daysLabel.appendChild(daysInput);

  const hoursInput = createNumericInput(5, true);
  const hoursLabel = document.createElement("label");
  hoursLabel.innerText = "Hours: ";
  hoursLabel.appendChild(hoursInput);

  const submit = createButton("Next", () => {
    const days = parseNumber(daysInput.value);
    const hours = parseNumber(hoursInput.value);

    if (days < 1 && hours < 1) {
      return;
    }

    const secondsElapsed = days * 24 * 60 * 60 + hours * 60 * 60;
    const startTime = new Date(endTime.valueOf() - secondsElapsed * 1000);

    confirm(startTime);
  });

  dialog.replaceChildren(daysLabel, hoursLabel, submit);
  daysInput.focus();
}

function startTimeFromHp(cook: Cook, confirm: (startTime: Date) => void, endTime: Date, dialog: HTMLDialogElement) {
  const currentHpInput = createNumericInput(8, true);
  const currentHpLabel = document.createElement("label");
  currentHpLabel.innerText = "Current HP: ";
  currentHpLabel.appendChild(currentHpInput);

  const apInput = createNumericInput(6, true);
  const apLabel = document.createElement("label");
  apLabel.innerText = "AP: ";
  apLabel.appendChild(apInput);

  const submit = createButton("Next", () => {
    const ap = parseNumber(apInput.value);

    if (ap <= 0) {
      return;
    }

    const initialHp = (hp as Record<CookSize, Record<CookType, number>>)[cook.size][cook.type];
    const currentHp = parseNumber(currentHpInput.value);
    const consumedHp = initialHp - currentHp;
    const secondsElapsed = getSecondsRemaining(consumedHp, ap) ?? 0;
    const startTime = new Date(endTime.valueOf() - secondsElapsed * 1000);
    confirm(startTime);
  });

  dialog.replaceChildren(currentHpLabel, apLabel, submit);
  currentHpInput.focus();
}

function confirmFinishCook(cook: Cook | null, dialog: HTMLDialogElement, layer: Layer, startTime: Date, endTime: Date) {
  if (cook == null) {
    dialog.close();
    return;
  }

  endTime = roundToMinute(endTime);
  startTime = roundToMinute(startTime);

  const duration = endTime.getTime() - startTime.getTime();
  const durationText = document.createTextNode(`Cooked for ${relativeFromSeconds(duration / 1000, false)}`);

  const endInput = document.createElement("input");
  endInput.type = "datetime-local";
  const now = new Date(Date.now() - (new Date().getTimezoneOffset() * 60000));
  endInput.valueAsNumber = roundToMinute(now).valueOf();
  const endLabel = document.createElement("label");
  endLabel.innerText = "End time: ";
  endLabel.appendChild(endInput);

  const noteInput = document.createElement("input");
  const noteLabel = document.createElement("label");
  noteLabel.innerText = "Note: ";
  noteLabel.appendChild(noteInput);

  const actions = L.DomUtil.create("div", "action-container", dialog);

  function endCook(safe: boolean) {
    const end = new Date(endInput.value);
    const start = new Date(end.valueOf() - duration);

    finishCook(layer, dialog, cook!, start, end, noteInput.value.trim(), safe);
  }

  actions.appendChild(symbolButton("✔️", "Safe", () => endCook(true)));
  actions.appendChild(symbolButton("❗", "Unsafe", () => endCook(false)));
  actions.appendChild(symbolButton("✖️", "Cancel", () => dialog.close()));

  dialog.replaceChildren(durationText, endLabel, noteLabel, actions);
}

function roundToMinute(date: Date) {
  return new Date(Math.floor(date.valueOf() / 60000) * 60000);
}

function symbolButton(symbol: string, title: string, onClick: () => void) {
  const button = document.createElement("button");
  button.innerText = symbol;
  button.title = title;
  button.addEventListener("click", onClick);
  return button;
}

function finishCook(layer: Layer, dialog: HTMLDialogElement, cook: Cook, start: Date, end: Date, note: string, safe: boolean) {
  cook.start = start;
  cook.end = end;
  cook.note = note.length > 0 ? note : undefined;
  cook.safe = safe;
  savePortals();
  layer.closePopup();
  dialog.close();
}

function editCook(portal: Portal, cook: Cook, layer: Layer) {
  const end = cook.end!;
  const durationMs = end.valueOf() - cook.start.valueOf();
  const durationRoundedSeconds = Math.max(Math.round(durationMs / 1000 / 3600), 1) * 3600;
  const dialog = L.DomUtil.create("dialog", "vertical", document.body);
  const daysInput = createNumericInput(5, true);
  daysInput.value = Math.floor(durationRoundedSeconds / (24 * 60 * 60)).toString();
  const daysLabel = document.createElement("label");
  daysLabel.innerText = "Days: ";
  daysLabel.appendChild(daysInput);

  const hoursInput = createNumericInput(5, true);
  hoursInput.value = Math.floor((durationRoundedSeconds % (24 * 60 * 60)) / (60 * 60)).toString();
  const hoursLabel = document.createElement("label");
  hoursLabel.innerText = "Hours: ";
  hoursLabel.appendChild(hoursInput);

  const endInput = document.createElement("input");
  endInput.type = "datetime-local";
  endInput.valueAsNumber = new Date(end.valueOf() - (new Date().getTimezoneOffset() * 60000)).valueOf();
  const endLabel = document.createElement("label");
  endLabel.innerText = "End time: ";
  endLabel.appendChild(endInput);

  const noteInput = document.createElement("input");
  noteInput.value = cook.note ?? "";
  const noteLabel = document.createElement("label");
  noteLabel.innerText = "Note: ";
  noteLabel.appendChild(noteInput);

  const actions = L.DomUtil.create("div", "action-container", dialog);

  let safe = cook.safe;
  const safeToggle = symbolButton(safe === false ? "❗" : "✔️", safe === false ? "Change to safe" : "Change to unsafe", () => {
    safe = !safe;
    safeToggle.innerText = safe === false ? "❗" : "✔️";
    safeToggle.title = safe === false ? "Change to safe" : "Change to unsafe";
  });

  const removePopover = document.createElement("div");
  removePopover.classList.add("vertical");
  removePopover.innerText = "Remove this cook from history?";
  removePopover.popover = "auto";
  removePopover.append(
    createButton("Yes", () => {
      portal.cooks = portal.cooks?.filter((c) => c !== cook);
      savePortals();
      layer.closePopup();
      dialog.close();
    }),
    createButton("No", () => dialog.close()),
  );

  const removeButton = document.createElement("button");
  removeButton.innerText = "Remove";
  removeButton.popoverTargetElement = removePopover;

  const updateButton = createButton("Update", () => {
    const days = parseNumber(daysInput.value);
    const hours = parseNumber(hoursInput.value);

    if (days < 1 && hours < 1) {
      return;
    }

    const secondsElapsed = days * 24 * 60 * 60 + hours * 60 * 60;
    const endTime = new Date(endInput.value);
    const startTime = new Date(endTime.valueOf() - secondsElapsed * 1000);

    cook.start = startTime;
    cook.end = endTime;
    cook.safe = safe;
    cook.note = noteInput.value.trim().length > 0 ? noteInput.value.trim() : undefined;

    savePortals();
    layer.closePopup();
    dialog.close();
  });

  actions.append(safeToggle, removePopover, removeButton, updateButton);

  dialog.append(daysLabel, hoursLabel, endInput, noteLabel, actions);
  dialog.addEventListener("close", () => dialog.remove());

  dialog.showModal();
  daysInput.focus();
}

function createButton(text: string, onClick: () => void) {
  const btn = document.createElement("button");
  btn.innerText = text;

  btn.addEventListener("click", onClick);

  return btn;
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
