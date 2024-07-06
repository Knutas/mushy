import { createNumericInput, getSecondsRemaining, parseNumber, parseZone } from "./utils.js";
import { DisplayTimeElement } from "./display-time.js";
import { EndTimeRowElement } from "./end-time-row.js";

export class EndTimeElement extends HTMLElement {
  static tag = "mushy-end-time";

  #initiated = false;
  #initialHp = 0;
  #initialTime = 0;
  #startTime: Date | null = null;
  #hpInput: HTMLInputElement;
  #apInput: HTMLInputElement;
  #nowInput: HTMLInputElement;
  #dateInput: HTMLInputElement;
  #time: DisplayTimeElement;
  #rowContainer: HTMLDivElement;
  #zoneInput: HTMLInputElement;
  #signButton: HTMLButtonElement;

  constructor() {
    super();

    this.#hpInput = createNumericInput(8, false);
    this.#hpInput.addEventListener("input", () => this.mainCalc());

    this.#apInput = createNumericInput(5);
    this.#apInput.addEventListener("input", () => this.mainCalc());

    this.#nowInput = document.createElement("input");
    this.#nowInput.type = "checkbox";
    this.#nowInput.addEventListener("input", () => {
      const useNow = this.#nowInput.checked;
      this.#dateInput.disabled = useNow;
      this.#hpInput.disabled = useNow;
      this.#apInput.disabled = useNow;
      this.#startTime = useNow ? new Date() : null;
      this.#initialHp = parseNumber(this.#hpInput.value);
      this.#initialTime = performance.now();

      if (!useNow) {
        this.updateStartTime();
      } else {
        this.mainCalc();
      }
    });

    this.#dateInput = document.createElement("input");
    this.#dateInput.type = "datetime-local";
    this.#dateInput.addEventListener("input", () => this.updateStartTime());

    this.#time = new DisplayTimeElement();

    this.#rowContainer = document.createElement("div");

    this.#zoneInput = createNumericInput(3);
    this.#zoneInput.addEventListener("input", () => this.mainCalc());

    this.#signButton = document.createElement("button");
    this.#signButton.style.backgroundColor = "transparent";
    this.#signButton.innerText = "+";
    this.#signButton.addEventListener("click", () => {
      this.#signButton.innerText = this.#signButton.innerText === "+" ? "−" : "+";
      this.mainCalc();
    });

    this.addEventListener("mt:change", () => this.mainCalc());
  }

  connectedCallback() {
    this.init();
  }

  init() {
    if (this.#initiated) {
      return;
    }

    this.#initiated = true;

    const root = this;

    root.append("Current HP: ", this.#hpInput);

    const apLabel = document.createElement("label");
    apLabel.innerText = "Attack power: ";
    root.append(" ", apLabel, this.#apInput);

    root.appendChild(document.createElement("br"));

    const nowLabel = document.createElement("label");
    nowLabel.innerText = " In progress: ";

    nowLabel.htmlFor = this.#nowInput.id = "now";

    root.append(
      nowLabel,
      this.#nowInput,
      " or starting at: ",
      this.#dateInput,
    );

    root.appendChild(document.createElement("br"));

    root.appendChild(this.#time);

    const addButton = document.createElement("button");
    addButton.innerText = "➕";
    root.append(this.#rowContainer, addButton);

    root.appendChild(document.createElement("br"));

    root.append(
      "Additional time zone: UTC",
      this.#signButton,
      this.#zoneInput,
    );

    addButton.addEventListener(
      "click",
      () => this.#rowContainer.appendChild(new EndTimeRowElement()),
    );

    this.mainCalc();

    window.setInterval(() => this.tick(), 250);
  }

  setTime(
    time: Element,
    seconds: number | null,
    start: Date | null,
    zone: number | null,
  ) {
    time.setAttribute("seconds", seconds?.toString() ?? "");
    time.setAttribute("start", start?.valueOf().toString() ?? "");
    time.setAttribute("zone", zone?.toString() ?? "");
  }

  mainCalc() {
    const hp = parseNumber(this.#hpInput.value);
    const ap = parseNumber(this.#apInput.value);
    const zone = parseZone(this.#zoneInput.value, this.#signButton.innerText);

    this.setTime(
      this.#time,
      getSecondsRemaining(hp, ap),
      this.#startTime,
      zone,
    );

    let remainingHp = hp;
    let apSum = ap;
    let delaySum = 0;

    for (const row of this.#rowContainer.children as HTMLCollectionOf<EndTimeRowElement>) {
      const { ap, delay } = row.getValues();
      const delaySeconds = delay * 60 * 60;
      remainingHp -= apSum * delaySeconds / 100;
      apSum += ap;
      delaySum += delaySeconds;

      const rowStartTime = this.#startTime != null ? new Date(this.#startTime.getTime() + delaySum * 1000) : null;

      row.setAttribute("ap", apSum.toString());
      this.setTime(
        row,
        getSecondsRemaining(remainingHp, apSum),
        rowStartTime,
        zone,
      );
    }
  }

  updateStartTime() {
    const value = this.#dateInput.value;
    this.#startTime = value === "" ? null : new Date(value);
    this.mainCalc();
  }

  tick() {
    if (this.#nowInput.checked) {
      const elapsed = Math.floor(performance.now() - this.#initialTime) /
        1000;
      const damage = parseNumber(this.#apInput.value) * elapsed / 100;
      this.#hpInput.value = Math.max(this.#initialHp - damage, 0).toFixed(0);

      this.mainCalc();
    }
  }
}

customElements.define(EndTimeElement.tag, EndTimeElement);
