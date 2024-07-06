import { DisplayTimeElement } from "./display-time.js";

export class TimeToElement extends HTMLElement {
  static tag = "mushy-time-to";

  #initiated = false;
  #dateInput: HTMLInputElement;
  #result: DisplayTimeElement;

  constructor() {
    super();

    this.#dateInput = document.createElement("input");
    this.#dateInput.type = "datetime-local";
    this.#dateInput.addEventListener("input", () => this.update());

    this.#result = new DisplayTimeElement();
    this.#result.setAttribute("format", "relative");
    this.#result.setAttribute("style", "display: block");
  }

  connectedCallback() {
    this.init();
  }

  init() {
    if (this.#initiated) {
      return;
    }

    this.#initiated = true;

    this.append(this.#dateInput);
    this.append(this.#result);
  }

  update() {
    const date = this.#dateInput.valueAsNumber;
    const offset = new Date(date).getTimezoneOffset() * 60 * 1000;

    const seconds = date != null ? (date + offset - Date.now()) / 1000 : 0;

    this.#result.setAttribute("seconds", seconds.toString());
    this.#result.setAttribute("start", Date.now().toString());
  }
}

customElements.define(TimeToElement.tag, TimeToElement);
