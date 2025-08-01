export function createNumericInput(digits: number, unsigned = true) {
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

export function parseNumber(value: string | null, float = false) {
  if (value === "" || value == null) {
    return 0;
  }

  return float ? parseFloat(value) : parseInt(value);
}

export function parseZone(value: string, sign: string) {
  if (value === "") {
    return null;
  }

  return parseFloat(value) * (sign === "+" ? 1 : -1);
}

export function isEmptyOrNull(value: string | null): value is null | "" {
  return value == null || value.trim() === "";
}

export function getSecondsRemaining(hp: number, ap: number) {
  if (ap <= 0) {
    return null;
  }

  const secondsRemaining = hp / ap * 100;

  return secondsRemaining;
}

export function relativeFromSeconds(secondsRemaining: number, showMinutes = true) {
  if (secondsRemaining <= 0) {
    return "";
  }

  if (!showMinutes) {
    secondsRemaining = Math.max(Math.round(secondsRemaining / 3600), 1) * 3600;
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

  if (showMinutes) {
    parts.push(plural("minute", minutes));
  }

  const relative = parts.join(" ");

  return relative;
}

export function absoluteFromSeconds(
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

export function formatDateTime(dateTime: Date) {
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

export async function copyTimestampToClipboard(datetime: Date, type: "R" | "F" | "t") {
  const text = `<t:${Math.floor(datetime.getTime() / 1000)}:${type}>`;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    alert(`Could not copy to clipboard. ${text}`);
  }
}
