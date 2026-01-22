/* js/form.js
   Fixes:
   1) sticky panel works (handled by index.html removing overflow clipping)
   2) no double-counting (bind listeners once; use currentState)
   3) move CRM/identity chips to right panel ("CRM upserted data")
   4) FAQ opens in new tab (handled by index.html target=_blank)
   5) identity labels: anonymous -> guest -> identified
*/

(() => {
  const API_ROOT = "https://api.drewwebbai.com";
  const API_EVENT = API_ROOT + "/event";

  const RESUME_TO = "https://drewwebbai.com/resume";
  const LINKEDIN_TO = "https://www.linkedin.com/in/drewrwebb/";

  // Form + UI
  const form = document.getElementById("lead-form");
  const btn = document.getElementById("submitBtn");
  const guestBtn = document.getElementById("guestBtn");

  const msgError = document.getElementById("msg-error");
  const msgSuccess = document.getElementById("msg-success");

  const fog = document.getElementById("fog");
  const experience = document.getElementById("experience");
  const formArea = document.getElementById("form-area");

  const heroTitle = document.getElementById("hero-title");
  const heroSub = document.getElementById("hero-sub");

  const hello = document.getElementById("hello");
  const context = document.getElementById("context");
  const chips = document.getElementById("chips"); // main-body chips (now session-only)

  const statusText = document.getElementById("status-text");

  // Right telemetry
  const signalPill = document.getElementById("signal-pill");
  const signalChips = document.getElementById("signal-chips");
  const tMode = document.getElementById("t-mode");
  const tTime = document.getElementById("t-time");
  const tActions = document.getElementById("t-actions");
  const tRecent = document.getElementById("t-recent");

  // CRM box
  const crmBox = document.getElementById("crm-box");
  const crmChips = document.getElementById("crm-chips");

  // Steps
  const stepsWrap = document.getElementById("steps");
  const stepEls = stepsWrap ? Array.from(stepsWrap.querySelectorAll(".step")) : [];

  // Inputs
  const elFirst = document.getElementById("firstName");
  const elLast = document.getElementById("lastName");
  const elCompany = document.getElementById("company");
  const elTitle = document.getElementById("title");
  const elLinkedIn = document.getElementById("linkedin");
  const elEmail = document.getElementById("email");

  // Links
  const resumeLink = document.getElementById("resume-link");
  const linkedinLink = document.getElementById("linkedin-link");
  const faqLink = document.getElementById("faq-link");
  const startOverLink = document.getElementById("start-over");

  // -------------------------
  // Helpers
  // -------------------------
  function setMsg(el, text) {
    if (!el) return;
    if (!text) {
      el.style.display = "none";
      el.textContent = "";
      return;
    }
    el.style.display = "block";
    el.textContent = text;
  }

  function qs(key) {
    return new URLSearchParams(location.search).get(key) || "";
  }

  function readCookie(name) {
    const m = document.cookie.match(
      new RegExp("(^|; )" + name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") + "=([^;]*)")
    );
    return m ? decodeURIComponent(m[2]) : "";
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>'"]/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[c]);
  }

  function formatElapsed(sec) {
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${String(s).padStart(2, "0")}s`;
  }

  function getEntryPath() {
    const fromQuery = (qs("portfolioSlug") || qs("portfolio_slug") || qs("ref") || "").trim();
    if (fromQuery) return fromQuery;

    const fromCookie = (readCookie("portfolio_slug") || readCookie("first_ref") || "").trim();
    if (fromCookie) return fromCookie;

    return "direct";
  }

  function getLeadSourceLabel() {
    const v = (qs("leadSource") || qs("lead_source") || "").trim();
    return v || "Direct";
  }

  function getTurnstileToken() {
    return window.__turnstileToken || "";
  }

  function shortenLinkedIn(url) {
    const s = String(url || "").trim();
    if (!s) return "";
    try {
      const u = new URL(s);
      if (u.pathname && u.pathname.startsWith("/in/")) return u.pathname.replace(/\/$/, "");
      return (u.hostname + u.pathname).replace(/\/$/, "");
    } catch {
      if (s.includes("/in/")) {
        const idx = s.indexOf("/in/");
        return s.slice(idx).replace(/\/$/, "");
      }
      return s.length > 34 ? (s.slice(0, 30) + "…") : s;
    }
  }

  // -------------------------
  // State
  // -------------------------
  const sessionStart = Date.now();

  // ✅ Single source of truth to prevent double listeners
  const currentState = {
    guest: false,
    name: "",
    email: "",
    company: "",
    title: "",
    linkedin: "",
    entryPath: getEntryPath(),
    leadSource: getLeadSourceLabel(),
  };

  const telemetry = {
    identity: "anonymous", // anonymous | guest | identified
    actions: 0,
    recent: []
  };

  function setIdentity(next) {
    telemetry.identity = next;
    if (tMode) tMode.textContent = next;

    if (signalPill) {
      // pill is more “status” than “identity”
      signalPill.textContent = next === "identified" ? "Identified" : "Capturing";
    }
  }

  function pushRecent(label) {
    telemetry.recent.unshift(label);
    telemetry.recent = telemetry.recent.slice(0, 5);

    if (!tRecent) return;
    tRecent.innerHTML = telemetry.recent.length
      ? telemetry.recent.map(x => `<li>${escapeHtml(x)}</li>`).join("")
      : `<li>Waiting for a meaningful interaction…</li>`;
  }

  function incAction(label) {
    telemetry.actions += 1;
    if (tActions) tActions.textContent = String(telemetry.actions);
    pushRecent(label);
  }

  function updateSignalChips() {
    if (!signalChips) return;
    signalChips.innerHTML =
      `<span class="chip guest"><span class="k">path</span><span class="mono">${escapeHtml(currentState.entryPath || "direct")}</span></span>` +
      `<span class="chip guest"><span class="k">source</span><span class="mono">${escapeHtml(currentState.leadSource || "Direct")}</span></span>`;
  }

  function renderMainBodyChips() {
    // ✅ Session-only under welcome; CRM data moved to right panel
    if (!chips) return;

    const out = [];
    function chip(key, value, opts = {}) {
      if (!value) return;
      const cls = opts.guest ? "chip guest" : "chip";
      const mono = opts.mono ? " mono" : "";
      out.push(`<span class="${cls}${mono}"><span class="k">${escapeHtml(key)}</span><span>${escapeHtml(value)}</span></span>`);
    }

    if (currentState.guest) {
      chip("mode", "guest", { guest: true, mono: true });
      chip("path", currentState.entryPath, { guest: true, mono: true });
      chip("source", currentState.leadSource, { guest: true, mono: true });
      chip("personalization", "limited", { guest: true });
    } else {
      chip("path", currentState.entryPath, { mono: true });
      chip("source", currentState.leadSource, { mono: true });
      chip("follow-up", currentState.email ? "email queued" : "skipped (no email)");
    }

    chips.innerHTML = out.join("");
  }

  function renderCrmUpsertedData() {
    if (!crmBox || !crmChips) return;

    // show only when we actually have an identity
    if (!currentState.email && currentState.guest) {
      crmBox.style.display = "none";
      crmChips.innerHTML = "";
      return;
    }

    if (!currentState.email) {
      crmBox.style.display = "none";
      crmChips.innerHTML = "";
      return;
    }

    crmBox.style.display = "block";

    const rows = [];
    function chip(key, value) {
      if (!value) return;
      rows.push(`<span class="chip"><span class="k">${escapeHtml(key)}</span><span>${escapeHtml(value)}</span></span>`);
    }

    chip("name", currentState.name || "(not provided)");
    chip("email", currentState.email);
    chip("company", currentState.company);
    chip("title", currentState.title);
    chip("linkedin", shortenLinkedIn(currentState.linkedin));

    crmChips.innerHTML = rows.join("");
  }

  // -------------------------
  // Tracking events (server)
  // -------------------------
  async function postEvent(payload) {
    try {
      await fetch(API_EVENT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {}
  }

  function trackIfIdentified(eventName, extra = {}) {
    if (currentState.email) {
      postEvent({ email: currentState.email, event: eventName, ...extra });
    }
  }

  // -------------------------
  // Reveal logic
  // -------------------------
  function animateSteps(isGuest) {
    const step1 = document.getElementById("step-1");
    const step2 = document.getElementById("step-2");
    const step3 = document.getElementById("step-3");

    if (isGuest) {
      if (step1) step1.textContent = "Attribution is captured (entry path + first-touch preserved).";
      if (step2) step2.textContent = "Guest mode: CRM capture is skipped (no email).";
      if (step3) step3.textContent = "You can still explore the system and how it’s designed.";
    } else {
      if (step1) step1.textContent = "Attribution is captured (entry path + first-touch preserved).";
      if (step2) step2.textContent = "A CRM profile is created or updated (deduped by email).";
      if (step3) step3.textContent = "Automation is triggered (email + engagement scoring).";
    }

    stepEls.forEach(el => el.classList.remove("is-in"));
    stepEls.forEach((el, i) => setTimeout(() => el.classList.add("is-in"), 160 + i * 220));
  }

  function hideFormArea() {
    if (!formArea) return;
    formArea.classList.add("is-gone");
  }

  function reveal() {
    if (fog) fog.classList.add("is-cleared");
    if (experience) experience.classList.add("is-on");
    hideFormArea();

    if (statusText) statusText.textContent = currentState.guest ? "Guest mode" : "Live";
    if (heroTitle) heroTitle.textContent = currentState.guest ? "Guest walkthrough" : "Personalized walkthrough";
    if (heroSub) {
      heroSub.textContent = currentState.guest
        ? "You’re viewing the guest version of the live system. You can still see attribution + structure — personalization and CRM capture are limited."
        : "Nice to meet you. This page now adapts to what you submitted — and logs signals in real systems while you browse.";
    }

    const displayName = (currentState.name || currentState.email || "there").trim();
    if (hello) hello.textContent = `Welcome, ${displayName}`;

    if (context) {
      context.textContent = currentState.guest
        ? "You’re in guest mode. Want the full proof? Enter a work email above to trigger CRM capture + automated follow-up."
        : "This is intentionally subtle: personalization, attribution, capture, and follow-up are happening as you read.";
    }

    updateSignalChips();
    renderMainBodyChips();
    renderCrmUpsertedData();

    setIdentity(currentState.guest ? "guest" : (currentState.email ? "identified" : "anonymous"));

    animateSteps(currentState.guest);
    // ✅ No auto-scroll
  }

  // -------------------------
  // Bind meaningful interactions ONCE
  // -------------------------
  function bindOnce(el, key, fn) {
    if (!el) return;
    const k = `bound_${key}`;
    if (el.dataset[k] === "1") return;
    el.dataset[k] = "1";
    el.addEventListener("click", fn);
  }

  function wireOutboundTrackingOnce() {
    bindOnce(resumeLink, "resume", () => {
      incAction("Resume opened");
      trackIfIdentified("resume_clicked");
      resumeLink.href = RESUME_TO;
    });

    bindOnce(linkedinLink, "linkedin", () => {
      incAction("LinkedIn opened");
      trackIfIdentified("linkedin_clicked");
      linkedinLink.href = LINKEDIN_TO;
    });

    bindOnce(faqLink, "faq", () => {
      incAction("FAQ opened");
      trackIfIdentified("faq_clicked");
      // opens in new tab via HTML target=_blank
    });

    bindOnce(startOverLink, "startover", () => {
      incAction("Start over");
      trackIfIdentified("start_over_clicked");
    });
  }

  function wirePathButtonsOnce() {
    const sections = ["about", "stacks", "behind"];

    function setOpen(key, open) {
      const panel = document.getElementById(`deep-${key}`);
      const btn = document.querySelector(`.path[data-toggle="${key}"]`);
      if (!panel || !btn) return;

      if (open) {
        panel.classList.add("is-open");
        panel.setAttribute("aria-hidden", "false");
        btn.setAttribute("aria-expanded", "true");
        const hint = btn.querySelector(".hint span");
        if (hint) hint.textContent = "Click to close";
      } else {
        panel.classList.remove("is-open");
        panel.setAttribute("aria-hidden", "true");
        btn.setAttribute("aria-expanded", "false");
        const hint = btn.querySelector(".hint span");
        if (hint) hint.textContent = "Click to open";
      }
    }

    sections.forEach(k => setOpen(k, false));

    document.querySelectorAll(".path[data-toggle]").forEach(b => {
      bindOnce(b, `path_${b.getAttribute("data-toggle")}`, () => {
        const key = b.getAttribute("data-toggle");
        const isExpanded = b.getAttribute("aria-expanded") === "true";
        const willOpen = !isExpanded;

        sections.forEach(k => setOpen(k, k === key ? willOpen : false));

        const label = willOpen ? `Opened: ${key}` : `Closed: ${key}`;
        incAction(label);
        trackIfIdentified("path_section_toggled", { section: key, open: willOpen });

        b.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    });
  }

  // -------------------------
  // API submit
  // -------------------------
  async function postIntro(payload) {
    const res = await fetch(API_ROOT + "/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(`Server error: HTTP ${res.status}${text ? ` — ${text}` : ""}`);

    let data = {};
    try { data = JSON.parse(text); } catch {}
    return data;
  }

  function buildFromInputs() {
    const firstName = (elFirst?.value || "").trim();
    const lastName = (elLast?.value || "").trim();
    const name = `${firstName} ${lastName}`.trim();

    return {
      name,
      email: (elEmail?.value || "").trim(),
      company: (elCompany?.value || "").trim(),
      title: (elTitle?.value || "").trim(),
      linkedin: (elLinkedIn?.value || "").trim(),
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(msgError, "");
    setMsg(msgSuccess, "");
    if (statusText) statusText.textContent = "Submitting…";
    if (btn) btn.disabled = true;

    const input = buildFromInputs();

    if (!input.email) {
      setMsg(msgError, "Please enter a work email (or use Guest mode).");
      if (statusText) statusText.textContent = "Ready";
      if (btn) btn.disabled = false;
      return;
    }

    const payload = {
      firstName: (elFirst?.value || "").trim(),
      lastName: (elLast?.value || "").trim(),
      company: input.company,
      title: input.title,
      linkedin: input.linkedin,
      email: input.email,
      portfolioSlug: currentState.entryPath,
      turnstileToken: getTurnstileToken(),
    };

    try {
      const data = await postIntro(payload);
      if (data && data.ok === false) throw new Error(data.error || "Something went wrong submitting the form.");

      // update state
      currentState.guest = false;
      currentState.name = input.name;
      currentState.email = input.email;
      currentState.company = input.company;
      currentState.title = input.title;
      currentState.linkedin = input.linkedin;

      setMsg(msgSuccess, "Captured. Clearing the fog…");
      incAction("Form submitted");

      reveal();

      if (statusText) statusText.textContent = "Live";
    } catch (err) {
      setMsg(msgError, err?.message || "Unexpected error");
      if (statusText) statusText.textContent = "Ready";
      if (btn) btn.disabled = false;
    }
  }

  function handleGuest(e) {
    e.preventDefault();
    setMsg(msgError, "");
    setMsg(msgSuccess, "");

    currentState.guest = true;
    currentState.name = buildFromInputs().name;
    currentState.email = ""; // remain anonymous
    currentState.company = "";
    currentState.title = "";
    currentState.linkedin = "";

    incAction("Entered guest mode");
    reveal();

    if (statusText) statusText.textContent = "Guest mode";
  }

  // -------------------------
  // Init
  // -------------------------
  function initTelemetryPreview() {
    updateSignalChips();
    setIdentity("anonymous");

    setInterval(() => {
      const sec = Math.floor((Date.now() - sessionStart) / 1000);
      if (tTime) tTime.textContent = formatElapsed(sec);
    }, 1000);

    renderMainBodyChips();
  }

  if (form) form.addEventListener("submit", handleSubmit);
  if (guestBtn) guestBtn.addEventListener("click", handleGuest);

  // bind once (prevents double-counting)
  wireOutboundTrackingOnce();
  wirePathButtonsOnce();

  initTelemetryPreview();
})();
