import { DisplayTimeElement } from "./display-time.js";
import { createNumericInput, isEmptyOrNull, parseNumber } from "./utils.js";

export class EndTimeRowElement extends HTMLElement {
  static tag = "mushy-duration-row";
  static observedAttributes = ["ap", "seconds", "start", "zone"];

  #initiated = false;
  #signButton: HTMLButtonElement;
  #apInput: HTMLInputElement;
  #delayInput: HTMLInputElement;
  #delButton: HTMLButtonElement;
  #apSum: Text;
  #joinTime: HTMLSpanElement;
  #joinTimeTime: DisplayTimeElement;
  #time: DisplayTimeElement;
  #verbElement: Text;

  constructor() {
    super();

    this.#verbElement = document.createTextNode("Add");
    this.#verbElement.textContent = "joining";

    this.#signButton = document.createElement("button");
    this.#signButton.innerText = "Add";
    this.#signButton.addEventListener("click", () => {
      this.#signButton.innerText = this.#signButton.innerText === "Add" ? "Subtract" : "Add";
      this.#verbElement.textContent = this.#signButton.innerText === "Add" ? "joining" : "leaving";
      this.emit();
    });

    this.#apInput = createNumericInput(5, false);
    this.#apInput.addEventListener("input", () => this.emit());

    this.#delayInput = createNumericInput(3);
    this.#delayInput.addEventListener("input", () => this.emit());

    this.#delButton = document.createElement("button");
    this.#delButton.innerText = "❌";
    this.#delButton.addEventListener("click", () => this.remove());

    this.#apSum = document.createTextNode("");
    this.#joinTime = document.createElement("span");
    this.#joinTimeTime = new DisplayTimeElement();

    this.#time = new DisplayTimeElement();
  }

  connectedCallback() {
    this.init();
  }

  init() {
    if (this.#initiated) {
      return;
    }

    this.#initiated = true;

    this.append(this.#signButton, " AP ", this.#apInput);
    this.append(" (joining ", this.#delayInput, " hours after previous) ");
    this.appendChild(this.#delButton);
    this.appendChild(document.createElement("br"));
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.appendChild(this.#time);
    this.#joinTimeTime.setAttribute("seconds", "1");
    this.#joinTimeTime.setAttribute("format", "absolute");
    this.#joinTime.append(" (", this.#verbElement, " at ", this.#joinTimeTime, ")");
    this.#joinTime.style.display = "none";
    details.append(summary, this.#apSum, this.#joinTime);
    this.appendChild(details);
  }

  emit() {
    this.dispatchEvent(new Event("mt:change", { bubbles: true }));
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    newValue: string | null,
  ) {
    switch (name) {
      case "ap":
        this.#apSum.textContent = `Total AP: ${newValue}`;
        break;
      case "start":
        if (isEmptyOrNull(newValue)) {
          this.#joinTime.style.display = "none";
        } else {
          this.#joinTime.style.display = "";
        }
      case "zone":
        if (newValue === null) {
          this.#joinTimeTime.removeAttribute(name);
        } else {
          this.#joinTimeTime.setAttribute(name, newValue);
        }
      default:
        if (newValue === null) {
          this.#time.removeAttribute(name);
        } else {
          this.#time.setAttribute(name, newValue);
        }
    }
  }

  getValues() {
    const ap = parseNumber(this.#apInput.value) * (this.#signButton.innerText === "Add" ? 1 : -1);
    const delay = parseNumber(this.#delayInput.value, true);

    return { ap, delay };
  }
}

customElements.define(EndTimeRowElement.tag, EndTimeRowElement);
