// Call Back Log - front end. Plain JavaScript, no libraries.
(function () {
  const app = document.getElementById("app");
  let state = { contacts: [] };
  let draft = null; // the call debrief in progress

  // ---------- helpers ----------
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => ymd(new Date());
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000); // b minus a
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const nice = (s) => parse(s).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const find = (id) => state.contacts.find((c) => c.id === id);

  // Where data lives: on your computer when server.js is running ("server"),
  // otherwise in this browser only ("local"), which is how the GitHub Pages version works.
  let mode = "server";
  const KEY = "callbacklog.v1";
  async function load() {
    try {
      const r = await fetch("api/state", { cache: "no-store" });
      if (!r.ok) throw new Error("no server");
      const j = await r.json();
      if (!j || !Array.isArray(j.contacts)) throw new Error("bad data");
      state = j; mode = "server"; return;
    } catch (e) { /* no server here: fall back to this browser */ }
    mode = "local";
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const j = JSON.parse(raw); if (j && Array.isArray(j.contacts)) { state = j; return; } }
    } catch (e) { /* storage blocked or unreadable: start from the samples */ }
    state = CallBackSample.sampleState();
  }
  async function save() {
    if (mode === "server") {
      const r = await fetch("api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state) });
      if (!r.ok) throw new Error("Save failed");
    } else {
      localStorage.setItem(KEY, JSON.stringify(state));
    }
  }
  async function trySave() {
    try { await save(); } catch (e) {
      alert(mode === "server" ? "Could not save. Is the server still running?" : "Could not save in this browser. Private or incognito windows may block saving.");
    }
  }
  function localNote() {
    return mode === "local"
      ? `<p class="note">Saved in this browser only. The sample contacts are fake. <button class="linkbtn" id="resetSample" type="button">Reset to samples</button></p>`
      : "";
  }
  function bindReset() {
    const b = document.getElementById("resetSample");
    if (b) b.addEventListener("click", async () => {
      if (!confirm("Erase everything in this browser and go back to the sample contacts?")) return;
      state = CallBackSample.sampleState();
      await trySave();
      route();
    });
  }

  // Overdue rule: due today = green label, 1 day overdue = yellow, 2+ days = red. Always with text.
  function status(c) {
    if (c.dnc) return { kind: "dnc", label: "Do not call" };
    if (!c.callbackDate) return null;
    const over = daysBetween(c.callbackDate, today());
    if (over < 0) return { kind: "later", label: "Due " + nice(c.callbackDate) };
    if (over === 0) return { kind: "due", label: "Due today" };
    if (over === 1) return { kind: "yellow", label: "1 day overdue" };
    return { kind: "red", label: over + " days overdue" };
  }
  function badge(s) {
    return s ? `<span class="badge ${s.kind}">${esc(s.label)}</span>` : "";
  }
  function contactRow(c) {
    const s = status(c);
    const cls = s && (s.kind === "yellow" || s.kind === "red") ? s.kind : "";
    return `<a class="card row ${cls}" href="#/c/${c.id}">
      <div class="row-top"><span class="name">${esc(c.name)}</span>${badge(s)}</div>
      <div class="muted">${esc(c.phone)}${c.callbackTime && !c.dnc ? " &middot; " + esc(DateParse.formatTime(c.callbackTime)) : ""}</div>${preview(c)}</a>`;
  }
  // A one-line "before you dial" reminder: the oldest open life issue, or else the last call's next step.
  function preview(c) {
    if (c.dnc) return "";
    const open = (c.issues || []).filter((i) => !i.resolved);
    if (open.length) return `<div class="prev">Open: ${esc(open[0].text)}${open.length > 1 ? ` <span class="muted">+${open.length - 1} more</span>` : ""}</div>`;
    const last = [...(c.calls || [])].sort((a, b) => b.date.localeCompare(a.date))[0];
    return last && last.next ? `<div class="prev">Next: ${esc(last.next)}</div>` : "";
  }

  // ---------- views ----------
  function viewHome() {
    const t = today();
    const due = state.contacts
      .filter((c) => !c.dnc && c.callbackDate && c.callbackDate <= t)
      .sort((a, b) => a.callbackDate.localeCompare(b.callbackDate) || (a.callbackTime || "99").localeCompare(b.callbackTime || "99") || a.name.localeCompare(b.name));
    app.innerHTML = `
      <h1>Today's callbacks</h1>
      <p class="muted">${esc(nice(t))}</p>
      <a class="btn primary block" href="#/add">+ Add contact</a>
      ${due.length ? due.map(contactRow).join("") : `<div class="empty">No callbacks due today. Nice.</div>`}
      ${localNote()}`;
    bindReset();
  }

  function viewAll() {
    const list = [...state.contacts].sort((a, b) => a.name.localeCompare(b.name));
    app.innerHTML = `
      <h1>All contacts</h1>
      <a class="btn primary block" href="#/add">+ Add contact</a>
      ${list.length ? list.map(contactRow).join("") : `<div class="empty">No contacts yet.</div>`}
      ${localNote()}`;
    bindReset();
  }

  function viewAdd() {
    app.innerHTML = `
      <h1>Add contact</h1>
      <form id="addForm">
        <label for="name">Name (required)</label>
        <input id="name" required autocomplete="off">
        <label for="phone">Phone (required)</label>
        <input id="phone" type="tel" required autocomplete="off">
        <label for="date">First callback date (optional)</label>
        <input id="date" type="date">
        <div class="actions">
          <a class="btn" href="#/">Cancel</a>
          <button class="btn primary" type="submit">Save</button>
        </div>
      </form>`;
    document.getElementById("addForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("name").value.trim();
      const phone = document.getElementById("phone").value.trim();
      const date = document.getElementById("date").value;
      if (!name || !phone) return;
      const c = { id: uid(), name, phone, callbackDate: date, dnc: false, dncLog: [], calls: [], issues: [] };
      state.contacts.push(c);
      await trySave();
      location.hash = "#/c/" + c.id;
    });
  }

  function viewContact(id) {
    const c = find(id);
    if (!c) { app.innerHTML = `<div class="empty">Contact not found. <a href="#/">Back</a></div>`; return; }
    const s = status(c);
    const digits = c.phone.replace(/[^\d+]/g, "");
    const callBtn = c.dnc
      ? `<span class="btn disabled">Call (do not call)</span>`
      : `<a class="btn primary" href="tel:${esc(digits)}">Call ${esc(c.phone)}</a>`;
    const openIssues = (c.issues || []).filter((i) => !i.resolved);
    const doneIssues = (c.issues || []).filter((i) => i.resolved);
    const issueRow = (i) => `<div class="issue ${i.resolved ? "done" : ""}"><span>${esc(i.text)}</span>
      <button class="btn" data-issue="${i.id}">${i.resolved ? "Reopen" : "Resolve"}</button></div>`;
    const calls = [...(c.calls || [])].sort((a, b) => b.date.localeCompare(a.date));
    const dl = (k, v) => (v ? `<dt>${k}</dt><dd>${esc(v)}</dd>` : "");

    app.innerHTML = `
      <a href="#/" class="muted">&larr; Back</a>
      <h1>${esc(c.name)} ${badge(s)}</h1>
      ${c.dnc ? `<div class="banner">DO NOT CALL. ${esc((c.dncLog[c.dncLog.length - 1] || {}).reason || "")}</div>` : ""}
      <div class="card">
        <div class="muted">Phone: ${esc(c.phone)}</div>
        <div class="muted">Next callback: ${c.callbackDate && !c.dnc ? esc(nice(c.callbackDate)) + (c.callbackTime ? " at " + esc(DateParse.formatTime(c.callbackTime)) : "") : "none set"}</div>
      </div>
      <div class="actions">
        ${callBtn}
        <a class="btn" href="#/debrief/${c.id}">Finish call</a>
      </div>

      <h2>Open issues</h2>
      <div class="card">
        ${openIssues.length ? openIssues.map(issueRow).join("") : `<span class="muted">Nothing open.</span>`}
        ${doneIssues.length ? `<div class="muted" style="margin-top:8px">Resolved</div>${doneIssues.map(issueRow).join("")}` : ""}
      </div>

      <h2>Call history (newest first)</h2>
      ${calls.length ? calls.map((k) => `
        <div class="card call"><h3>${esc(nice(k.date))}</h3><dl>
          ${dl("Topics covered", k.topics)}${dl("Companies discussed", k.companies)}
          ${dl("Next points of progress", k.next)}${dl("Objections", k.objections)}${dl("Life issues", k.lifeIssues)}
        </dl></div>`).join("") : `<div class="empty">No calls logged yet.</div>`}

      <h2>Do not call</h2>
      ${c.dnc
        ? `<button class="btn danger block" id="undoDnc">Remove do-not-call flag</button>`
        : `<button class="btn danger block" id="setDnc">Mark do not call</button>`}
      ${(c.dncLog || []).length ? `<div class="card muted">${c.dncLog.map((l) => `${esc(l.date)}: ${esc(l.action)}. ${esc(l.reason)}`).join("<br>")}</div>` : ""}`;

    app.querySelectorAll("[data-issue]").forEach((b) => b.addEventListener("click", async () => {
      const i = c.issues.find((x) => x.id === b.dataset.issue);
      i.resolved = !i.resolved;
      await trySave();
      viewContact(id);
    }));
    const setBtn = document.getElementById("setDnc");
    if (setBtn) setBtn.addEventListener("click", async () => {
      if (!confirm("Mark " + c.name + " as do not call?")) return;
      const reason = (prompt("Reason (optional):") || "").trim();
      c.dnc = true;
      c.dncLog.push({ date: today(), action: "flagged", reason: reason || "No reason given" });
      await trySave();
      viewContact(id);
    });
    const undoBtn = document.getElementById("undoDnc");
    if (undoBtn) undoBtn.addEventListener("click", async () => {
      const reason = (prompt("Why is it OK to call this person again? (required)") || "").trim();
      if (!reason) { alert("A reason is required to remove the flag."); return; }
      if (!confirm("Remove the do-not-call flag for " + c.name + "?")) return;
      c.dnc = false;
      c.dncLog.push({ date: today(), action: "flag removed", reason });
      await trySave();
      viewContact(id);
    });
  }

  const STEPS = [
    { key: "topics", q: "What topics did you cover?", hint: "Tap the box, then use your keyboard's microphone to talk." },
    { key: "companies", q: "What companies were discussed?", hint: "Their current insurer, competitors, anyone they mentioned." },
    { key: "next", q: "What are the next points of progress?", hint: "What needs to happen to move this person forward?" },
    { key: "date", q: "When should you call back?", hint: "Tap the first box and use your keyboard's microphone to say it, or pick a date." },
    { key: "objections", q: "Any objections?", hint: "Optional. What held them back?" },
    { key: "lifeIssues", q: "Any life issues to follow up on?", hint: "Optional. One per line, e.g. \"new baby\" or \"changing jobs\"." },
  ];

  function viewDebrief(id) {
    const c = find(id);
    if (!c) { location.hash = "#/"; return; }
    if (!draft || draft.id !== id) draft = { id, step: 0, topics: "", companies: "", next: "", date: "", time: "", spoken: "", objections: "", lifeIssues: "" };
    const st = STEPS[draft.step];
    const last = draft.step === STEPS.length - 1;
    let body;
    if (st.key === "date") {
      const t = today();
      body = `<label for="spoken">Say or type it</label>
        <input id="spoken" autocomplete="off" placeholder='e.g. "Thursday at 2" or "in 3 days"' value="${esc(draft.spoken)}">
        <label for="field">Or pick a date</label>
        <input id="field" type="date" min="${t}" value="${esc(draft.date)}">
        <div class="quick">
          <button class="btn" data-add="1">Tomorrow</button>
          <button class="btn" data-add="3">In 3 days</button>
          <button class="btn" data-add="7">Next week</button>
        </div>
        <div id="dateConfirm"></div>`;
    } else {
      body = `<textarea id="field" autofocus>${esc(draft[st.key])}</textarea>`;
    }
    app.innerHTML = `
      <div class="step">${esc(c.name)} &middot; Step ${draft.step + 1} of ${STEPS.length}</div>
      <h1>${esc(st.q)}</h1>
      ${st.hint ? `<p class="muted">${esc(st.hint)}</p>` : ""}
      ${body}
      <div class="actions">
        <button class="btn" id="back">${draft.step === 0 ? "Cancel" : "Back"}</button>
        <button class="btn primary" id="next">${last ? "Save call" : "Next"}</button>
      </div>`;

    const field = document.getElementById("field");
    // Shows the interpreted date back to you so a misheard date can't slip through.
    const showConfirm = (problem) => {
      const box = document.getElementById("dateConfirm");
      if (!box) return;
      if (problem) box.innerHTML = `<div class="error">${esc(problem)}</div>`;
      else if (draft.date) box.innerHTML = `<div class="confirm">Callback: ${esc(nice(draft.date))}${draft.time ? " at " + esc(DateParse.formatTime(draft.time)) : ""}. Is that right?</div>`;
      else box.innerHTML = `<div class="muted">No date set: this person will not appear in your callback list.</div>`;
    };
    const setDate = (v, time) => {
      draft.date = v;
      draft.time = time || "";
      if (st.key === "date") field.value = v;
      showConfirm();
    };
    if (st.key === "date") showConfirm();
    field.addEventListener("input", () => {
      if (st.key === "date") { draft.spoken = ""; document.getElementById("spoken").value = ""; setDate(field.value); }
      else draft[st.key] = field.value;
    });
    const spoken = document.getElementById("spoken");
    if (spoken) spoken.addEventListener("input", () => {
      draft.spoken = spoken.value;
      if (!spoken.value.trim()) { setDate("", ""); return; }
      const r = DateParse.parseSpoken(spoken.value, today());
      if (r) setDate(r.date, r.time);
      else { draft.date = ""; draft.time = ""; field.value = ""; showConfirm("Could not understand that date. Try \"Thursday at 2\", \"tomorrow\", or \"Nov 19\", or pick a date below."); }
    });
    app.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => {
      draft.spoken = ""; document.getElementById("spoken").value = "";
      setDate(addDays(today(), Number(b.dataset.add)));
    }));
    document.getElementById("back").addEventListener("click", () => {
      if (draft.step === 0) { draft = null; location.hash = "#/c/" + id; } else { draft.step--; viewDebrief(id); }
    });
    document.getElementById("next").addEventListener("click", async () => {
      if (!last) { draft.step++; viewDebrief(id); return; }
      c.calls.push({ id: uid(), date: today(), topics: draft.topics.trim(), companies: draft.companies.trim(), next: draft.next.trim(), objections: draft.objections.trim(), lifeIssues: draft.lifeIssues.trim() });
      draft.lifeIssues.split("\n").map((l) => l.trim()).filter(Boolean).forEach((text) => c.issues.push({ id: uid(), text, resolved: false, added: today() }));
      c.callbackDate = draft.date;
      c.callbackTime = draft.time || "";
      draft = null;
      await trySave();
      location.hash = "#/c/" + id;
    });
  }

  // ---------- routing ----------
  function route() {
    const h = location.hash || "#/";
    document.getElementById("nav-home").classList.toggle("active", h === "#/");
    document.getElementById("nav-all").classList.toggle("active", h === "#/all");
    let m;
    if (h === "#/all") return viewAll();
    if (h === "#/add") return viewAdd();
    if ((m = h.match(/^#\/c\/(.+)$/))) return viewContact(m[1]);
    if ((m = h.match(/^#\/debrief\/(.+)$/))) return viewDebrief(m[1]);
    return viewHome();
  }

  window.addEventListener("hashchange", route);
  load().then(route).catch(() => {
    app.innerHTML = `<div class="error">Call Back Log could not start. Try reloading the page.</div>`;
  });
})();
