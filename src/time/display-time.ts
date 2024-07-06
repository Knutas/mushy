import { absoluteFromSeconds, copyTimestampToClipboard, isEmptyOrNull, parseNumber, relativeFromSeconds } from "./utils.js";

enum TimeFormat {
  Relative,
  Absolute,
}

export class DisplayTimeElement extends HTMLElement {
  static tag = "mushy-display-time";
  static observedAttributes = ["seconds", "start", "zone"];

  #initiated = false;
  #relative: HTMLSpanElement;
  #absolute: HTMLSpanElement;

  constructor() {
    super();

    this.#relative = document.createElement("span");
    this.#absolute = document.createElement("span");

    this.#relative.addEventListener("click", () => this.copy(TimeFormat.Relative));
    this.#absolute.addEventListener("click", () => this.copy(TimeFormat.Absolute));
  }

  copy(format: TimeFormat) {
    const secondsString = this.getAttribute("seconds");
    const startString = this.getAttribute("start");
    if (isEmptyOrNull(secondsString) || isEmptyOrNull(startString)) {
      return;
    }

    const start = new Date(parseNumber(startString));
    const seconds = parseNumber(secondsString);
    const time = new Date(start.getTime() + seconds * 1000);
    const secondsFromNow = (time.getTime() - Date.now()) / 1000;

    copyTimestampToClipboard(
      time,
      format === TimeFormat.Relative ? "R" : secondsFromNow < 24 * 60 * 60 ? "t" : "F",
    );
  }

  connectedCallback() {
    this.init();
  }

  attributeChangedCallback() {
    this.update();
  }

  init() {
    if (this.#initiated) {
      return;
    }

    this.#initiated = true;

    if (this.getAttribute("format") !== "absolute") {
      this.append(this.#relative);
    }

    if (this.getAttribute("format") !== "relative") {
      this.append(this.#absolute);
    }
  }

  update() {
    const seconds = this.getAttribute("seconds");
    if (isEmptyOrNull(seconds)) {
      this.#relative.innerText = "";
      this.#absolute.innerText = "";

      return;
    }

    const secondsRemaining = parseNumber(seconds);
    if (secondsRemaining <= 0) {
      this.#relative.innerText = "";
      this.#absolute.innerText = "";

      return;
    }

    const start = this.getAttribute("start");
    const startTime = isEmptyOrNull(start) ? null : new Date(parseNumber(start));
    const zone = this.getAttribute("zone");
    const zoneOffset = isEmptyOrNull(zone) ? null : parseNumber(zone, true);

    let relativeTime = relativeFromSeconds(secondsRemaining);
    const absoluteTime = absoluteFromSeconds(
      secondsRemaining,
      startTime,
      zoneOffset,
    );

    if (absoluteTime != null && this.getAttribute("format") !== "relative") {
      relativeTime += ". ";
    }

    if (this.#relative.innerText !== relativeTime) {
      this.#relative.innerText = relativeTime;
    }

    if (this.#absolute.innerText !== absoluteTime) {
      this.#absolute.innerText = absoluteTime ?? "";
    }
  }
}

customElements.define(DisplayTimeElement.tag, DisplayTimeElement);
