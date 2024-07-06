import { DisplayTimeElement } from "./display-time.js";
import { createNumericInput } from "./utils.js";

export class TimeFromElement extends HTMLElement {
  static tag = "mushy-time-from";

  #initiated = false;
  #daysInput: HTMLInputElement;
  #hoursInput: HTMLInputElement;
  #minutesInput: HTMLInputElement;
  #result: DisplayTimeElement;

  constructor() {
    super();

    this.#daysInput = createNumericInput(3);
    this.#hoursInput = createNumericInput(3);
    this.#minutesInput = createNumericInput(3);
    this.#result = new DisplayTimeElement();
    this.#result.setAttribute("format", "absolute");
    this.#result.setAttribute("style", "display: block");

    const update = this.update.bind(this);
    this.#daysInput.addEventListener("input", update);
    this.#hoursInput.addEventListener("input", update);
    this.#minutesInput.addEventListener("input", update);
  }

  connectedCallback() {
    this.init();
  }

  init() {
    if (this.#initiated) {
      return;
    }

    this.#initiated = true;

    this.append("Days: ", this.#daysInput);
    this.append(" Hours: ", this.#hoursInput);
    this.append(" Minutes: ", this.#minutesInput);
    this.append(this.#result);
  }

  update() {
    const days = this.#daysInput.valueAsNumber || 0;
    const hours = this.#hoursInput.valueAsNumber || 0;
    const minutes = this.#minutesInput.valueAsNumber || 0;

    const seconds = days * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60;
    this.#result.setAttribute("seconds", seconds.toString());
    this.#result.setAttribute("start", Date.now().toString());
  }
}

customElements.define(TimeFromElement.tag, TimeFromElement);
