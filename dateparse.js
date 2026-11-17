// Turns a spoken or typed phrase like "Thursday at 2" into a date and optional time.
// Works in the browser (window.DateParse) and in Node (module.exports) so it can be tested.
(function (root) {
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYMD = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

  const WEEKDAYS = {
    sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3,
    thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
  };
  const MONTHS = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
    jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9,
    nov: 10, november: 10, dec: 11, december: 11,
  };
  const NUMS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14 };
  const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  const WEEKDAY_RE = "(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)";

  function addDays(base, n) { const d = new Date(base); d.setDate(d.getDate() + n); return d; }

  // Build a date from month/day, rolling to next year if it already passed.
  function monthDay(today, month, day) {
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    let d = new Date(today.getFullYear(), month, day);
    if (d.getMonth() !== month) return null; // e.g. Feb 31
    if (d < today) {
      d = new Date(today.getFullYear() + 1, month, day);
      if (d.getMonth() !== month) return null;
    }
    return d;
  }

  function parseTime(s) {
    let m;
    // "2pm", "2:30 pm", "at 2 pm"
    if ((m = s.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/))) {
      let h = +m[1]; const min = +(m[2] || 0);
      if (h < 1 || h > 12 || min > 59) return { bad: true };
      if (m[3] === "pm" && h < 12) h += 12;
      if (m[3] === "am" && h === 12) h = 0;
      return { time: `${pad(h)}:${pad(min)}`, rest: s.replace(m[0], " ") };
    }
    // "at 2", "at 2:30" with no am/pm: guess business hours (1-6 = PM, 7-11 = AM, 12 = noon)
    if ((m = s.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/))) {
      let h = +m[1]; const min = +(m[2] || 0);
      if (h < 1 || h > 23 || min > 59) return { bad: true };
      if (h >= 1 && h <= 6) h += 12;
      return { time: `${pad(h)}:${pad(min)}`, rest: s.replace(m[0], " ") };
    }
    if (/\bnoon\b/.test(s)) return { time: "12:00", rest: s.replace(/\bnoon\b/, " ") };
    if (/\bmorning\b/.test(s)) return { time: "09:00", rest: s.replace(/\bmorning\b/, " ") };
    if (/\bafternoon\b/.test(s)) return { time: "14:00", rest: s.replace(/\bafternoon\b/, " ") };
    if (/\bevening\b/.test(s)) return { time: "17:00", rest: s.replace(/\bevening\b/, " ") };
    return { time: "", rest: s };
  }

  // Returns { date: "YYYY-MM-DD", time: "HH:MM" or "" } or null if it can't be understood.
  function parseSpoken(input, todayStr) {
    let s = " " + String(input || "").toLowerCase()
      .replace(/\b([ap])\.m\.?/g, "$1m")
      .replace(/[,;!?]/g, " ")
      .replace(/\.(\s|$)/g, " ") + " ";
    if (!s.trim()) return null;

    const t = parseYMD(todayStr);
    const tm = parseTime(s);
    if (tm.bad) return null;
    s = tm.rest;

    let d = null, m;
    if (/\bday after tomorrow\b/.test(s)) d = addDays(t, 2);
    else if (/\btomorrow\b/.test(s)) d = addDays(t, 1);
    else if (/\b(today|tonight)\b/.test(s)) d = t;
    else if ((m = s.match(/\bin\s+(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen)\s+(day|days|week|weeks)\b/))) {
      const n = /^\d+$/.test(m[1]) ? +m[1] : NUMS[m[1]];
      d = addDays(t, n * (m[2].startsWith("week") ? 7 : 1));
    }
    else if ((m = s.match(new RegExp("\\b" + MONTH_RE + "\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\b")))) d = monthDay(t, MONTHS[m[1]], +m[2]);
    else if ((m = s.match(new RegExp("\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?" + MONTH_RE + "\\b")))) d = monthDay(t, MONTHS[m[2]], +m[1]);
    else if ((m = s.match(/\b(\d{1,2})\/(\d{1,2})\b/))) d = monthDay(t, +m[1] - 1, +m[2]);
    else if ((m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/))) {
      const day = +m[1];
      d = monthDay(t, t.getMonth(), day);
      // "the 5th" said on the 20th means next month, not next year
      if (d && d.getFullYear() > t.getFullYear()) d = monthDay(new Date(t.getFullYear(), t.getMonth() + 1, 1), (t.getMonth() + 1) % 12, day);
    }
    else if ((m = s.match(new RegExp("\\b" + WEEKDAY_RE + "\\b")))) {
      const key = m[1];
      const wd = WEEKDAYS[key];
      let diff = (wd - t.getDay() + 7) % 7;
      if (diff === 0) diff = 7; // same weekday as today means next week
      d = addDays(t, diff);
    }
    else if (/\bnext week\b/.test(s)) d = addDays(t, 7);

    if (!d) return null;
    return { date: ymd(d), time: tm.time };
  }

  function formatTime(time) {
    if (!time) return "";
    let [h, m] = time.split(":").map(Number);
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${pad(m)} ${ap}`;
  }

  const api = { parseSpoken, formatTime };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DateParse = api;
})(typeof window !== "undefined" ? window : this);
