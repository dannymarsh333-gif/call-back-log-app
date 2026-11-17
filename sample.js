// FAKE sample contacts so the app is never empty on first run. Not real people.
// Used by the browser (window.CallBackSample) and by server.js (require), so both start the same.
(function (root) {
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const daysFromToday = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };

  function sampleState() {
    return {
      contacts: [
        {
          id: "c1", name: "Maria Lopez (sample)", phone: "555-0101",
          callbackDate: daysFromToday(0), dnc: false, dncLog: [],
          calls: [{
            id: "k1", date: daysFromToday(-7),
            topics: "Term life vs whole life. She wants something affordable.",
            companies: "Currently with Acme Mutual",
            next: "Send a 20-year term quote",
            objections: "Worried about monthly cost",
            lifeIssues: "Husband recently lost his job",
          }],
          issues: [{ id: "i1", text: "Husband recently lost his job", resolved: false, added: daysFromToday(-7) }],
        },
        {
          id: "c2", name: "James Carter (sample)", phone: "555-0102",
          callbackDate: daysFromToday(-1), dnc: false, dncLog: [],
          calls: [{
            id: "k2", date: daysFromToday(-5),
            topics: "Home and auto bundle",
            companies: "Comparing with Northstar Insurance",
            next: "Call back with bundle discount numbers",
            objections: "Already has a policy through work",
            lifeIssues: "Daughter starting college in the fall",
          }],
          issues: [{ id: "i2", text: "Daughter starting college in the fall", resolved: false, added: daysFromToday(-5) }],
        },
        {
          id: "c3", name: "Priya Shah (sample)", phone: "555-0103",
          callbackDate: daysFromToday(-3), dnc: false, dncLog: [],
          calls: [{
            id: "k3", date: daysFromToday(-10),
            topics: "Disability insurance for a new job",
            companies: "Mentioned Harbor Life",
            next: "Explain waiting periods",
            objections: "Not sure she needs it yet",
            lifeIssues: "Just moved to a new city",
          }],
          issues: [{ id: "i3", text: "Just moved to a new city", resolved: false, added: daysFromToday(-10) }],
        },
        {
          id: "c4", name: "Tom Becker (sample)", phone: "555-0104",
          callbackDate: "", dnc: true,
          dncLog: [{ date: daysFromToday(-2), action: "flagged", reason: "Asked not to be called again" }],
          calls: [], issues: [],
        },
      ],
    };
  }

  const api = { sampleState };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CallBackSample = api;
})(typeof window !== "undefined" ? window : this);
