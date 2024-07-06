customElements.define(
  "mushy-duration-calculator",
  class extends HTMLElement {
    #initiated: boolean = false;
    #hpInput: HTMLInputElement;
    #apInput: HTMLInputElement;
    #nowInput: HTMLInputElement;
    #dateInput: HTMLInputElement;
    #time: HTMLSpanElement;
    #rowContainer: HTMLElement;
    #zoneInput: HTMLInputElement;
    #signButton: HTMLButtonElement;

    #initialHp = 0;
    #initialTime = 0;
    #startTime: Date | null = null;

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

      this.#time = document.createElement("mushy-time");

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
        () =>
          this.#rowContainer.appendChild(
            document.createElement("mushy-additional-ap"),
          ),
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
      for (const row of this.#rowContainer.children) {
        const { ap, delay } = (row as RowElement).getValues();
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
  },
);

class RowElement extends HTMLElement {
  static observedAttributes = ["ap", "seconds", "start", "zone"];

  #initiated: boolean = false;
  #signButton: HTMLButtonElement;
  #apInput: HTMLInputElement;
  #delayInput: HTMLInputElement;
  #delButton: any;
  #apSum: HTMLSpanElement;
  #joinTime: HTMLSpanElement;
  #joinTimeTime: HTMLSpanElement;
  #time: HTMLSpanElement;

  constructor() {
    super();

    this.#signButton = document.createElement("button");
    this.#signButton.innerText = "Add";
    this.#signButton.addEventListener("click", () => {
      this.#signButton.innerText = this.#signButton.innerText === "Add" ? "Subtract" : "Add";
      this.emit();
    });

    this.#apInput = createNumericInput(5, false);
    this.#apInput.addEventListener("input", () => this.emit());

    this.#delayInput = createNumericInput(3);
    this.#delayInput.addEventListener("input", () => this.emit());

    this.#delButton = document.createElement("button");
    this.#delButton.innerText = "❌";
    this.#delButton.addEventListener("click", () => this.remove());

    this.#apSum = document.createElement("span");
    this.#joinTime = document.createElement("span");
    this.#joinTimeTime = document.createElement("mushy-time");

    this.#time = document.createElement("mushy-time");
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
    this.#joinTimeTime.setAttribute("hide-relative", "true");
    this.#joinTime.append(" (joining at ", this.#joinTimeTime, ")");
    this.#joinTime.style.display = "none";
    details.append(summary, this.#apSum, this.#joinTime);
    this.appendChild(details);
  }

  emit() {
    this.dispatchEvent(new Event("mt:change", { bubbles: true }));
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ) {
    switch (name) {
      case "ap":
        this.#apSum.innerText = `Total AP: ${newValue}`;
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
    const ap = parseNumber(this.#apInput.value) *
      (this.#signButton.innerText === "Add" ? 1 : -1);
    const delay = parseNumber(this.#delayInput.value, true);

    return { ap, delay };
  }
}

customElements.define("mushy-additional-ap", RowElement);

enum TimeFormat {
  Relative,
  Absolute,
}

customElements.define(
  "mushy-time",
  class extends HTMLElement {
    static observedAttributes = ["seconds", "start", "zone"];

    #relative: HTMLSpanElement;
    #absolute: HTMLSpanElement;
    #initiated: boolean = false;

    constructor() {
      super();

      this.#relative = document.createElement("span");
      this.#absolute = document.createElement("span");

      this.#relative.addEventListener("click", () => {
        this.copy(TimeFormat.Relative);
      });

      this.#absolute.addEventListener("click", () => {
        this.copy(TimeFormat.Absolute);
      });
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

      if (!this.hasAttribute("hide-relative")) {
        this.append(this.#relative);
      }

      if (!this.hasAttribute("hide-absolute")) {
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

      if (absoluteTime != null && !this.hasAttribute("hide-absolute")) {
        relativeTime += ". ";
      }

      if (this.#relative.innerText !== relativeTime) {
        this.#relative.innerText = relativeTime;
      }

      if (this.#absolute.innerText !== absoluteTime) {
        this.#absolute.innerText = absoluteTime ?? "";
      }
    }
  },
);

function getSecondsRemaining(hp: number, ap: number) {
  if (ap <= 0) {
    return null;
  }

  const secondsRemaining = hp / ap * 100;

  return secondsRemaining;
}

function relativeFromSeconds(secondsRemaining: number) {
  if (secondsRemaining <= 0) {
    return "";
  }

  const days = Math.floor(secondsRemaining / (60 * 60 * 24));
  const hours = Math.floor(secondsRemaining / (60 * 60) % 24);
  const minutes = Math.floor(secondsRemaining / 60 % 60);

  function plural(stem: string, value: number) {
    return `${value} ${stem}${value !== 1 ? "s" : ""}`;
  }

  const parts = [];
  if (days > 0) {
    parts.push(plural("day", days));
  }

  if (days > 0 || hours > 0) {
    parts.push(plural("hour", hours));
  }

  parts.push(plural("minute", minutes));

  const relative = parts.join(" ");

  return relative;
}

function absoluteFromSeconds(
  secondsRemaining: number,
  startTime: Date | null,
  zone: number | null,
) {
  if (startTime == null) {
    return null;
  }

  const endTime = new Date(startTime.getTime() + secondsRemaining * 1000);

  let formatted = formatDateTime(endTime);

  if (zone != null) {
    const localZoneOffset = endTime.getTimezoneOffset() * 60 * 1000;
    const additionalOffset = zone * 60 * 60 * 1000;
    const zoneTime = new Date(
      endTime.getTime() + localZoneOffset + additionalOffset,
    );
    formatted += ` (${formatDateTime(zoneTime)} @ UTC${zone >= 0 ? "+" : ""}${zone})`;
  }

  return formatted;
}

function createNumericInput(digits: number, unsigned = true) {
  const input = document.createElement("input");
  input.type = "number";
  input.inputMode = "numeric";
  input.pattern = unsigned ? "[\+\-0-9]*" : "[\d]";
  input.step = "1";
  input.setAttribute("style", `width: ${digits + 2}ch`);

  if (unsigned === false) {
    input.min = "0";
  }

  return input;
}

function parseNumber(value: string | null, float = false) {
  if (value === "" || value == null) {
    return 0;
  }

  return float ? parseFloat(value) : parseInt(value);
}

function parseZone(value: string, sign: string) {
  if (value === "") {
    return null;
  }

  return parseFloat(value) * (sign === "+" ? 1 : -1);
}

const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDateTime(dateTime: Date) {
  const day = days[dateTime.getDay()];
  const month = months[dateTime.getMonth()];
  const date = dateTime.getDate();
  const hour = pad(dateTime.getHours());
  const minute = pad(dateTime.getMinutes());

  return `${day} ${month} ${date} at ${hour}:${minute}`;
}

function pad(value: number) {
  return value < 10 ? `0${value}` : value.toString();
}

function isEmptyOrNull(value: string | null): value is null | "" {
  return value == null || value.trim() === "";
}

customElements.define(
  "mushy-time-from",
  class extends HTMLElement {
    #initiated: boolean = false;
    #daysInput: HTMLInputElement;
    #hoursInput: HTMLInputElement;
    #minutesInput: HTMLInputElement;
    #result: HTMLElement;

    constructor() {
      super();

      this.#daysInput = createNumericInput(3);
      this.#hoursInput = createNumericInput(3);
      this.#minutesInput = createNumericInput(3);
      this.#result = document.createElement("mushy-time");
      this.#result.setAttribute("hide-relative", "true");
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
  },
);

customElements.define(
  "mushy-time-to",
  class extends HTMLElement {
    #initiated: boolean = false;
    #dateInput: HTMLInputElement;
    #result: HTMLElement;

    constructor() {
      super();

      this.#dateInput = document.createElement("input");
      this.#dateInput.type = "datetime-local";
      this.#dateInput.addEventListener("input", () => this.update());

      this.#result = document.createElement("mushy-time");
      this.#result.setAttribute("hide-absolute", "true");
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
  },
);

async function copyTimestampToClipboard(datetime: Date, type: "R" | "F" | "t") {
  const text = `<t:${Math.floor(datetime.getTime() / 1000)}:${type}>`;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    alert(`Could not copy to clipboard. ${text}`);
  }
}
