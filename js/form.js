/* js/form.js
   Option B (Sticky Telemetry):
   - Shows anonymous -> guest/live (deanonymized) state
   - Sticky right panel with:
       path/source, identity, time, valuable actions
   - Only tracks meaningful interactions:
       resume/linkedin/faq/start-over clicks + choose-your-path opens
   - Submit -> POST to API -> reveal experience (no auto-scroll)
   - Guest -> reveal experience (no API call)
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
  const chips = document.getElementById("chips");

  const statusText = document.getElementById("status-text");

  // Right telemetry
  const signalPill = document.getElementById("signal-pill");
  const signalChips = document.getElementById("signal-chips");
  const tMode = document.getElementById("t-mode");
  const tTime = document.getElementById("t-time");
  const tActions = document.getElementById("t-actions");
  const tRecent = document.getElementById("t-recent");

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

  function buildChips(state) {
    const out = [];
    function chip(key, value, opts = {}) {
      if (!value) return;
      const cls = opts.guest ? "chip guest" : "chip";
      const mono = opts.mono ? " mono" : "";
      out.push(`<span class="${cls}${mono}"><span class="k">${escapeHtml(key)}</span><span>${escapeHtml(value)}</span></span>`);
    }

    if (state.guest) {
      chip("mode", "guest", { guest: true, mono: true });
      chip("path", state.entryPath, { guest: true, mono: true });
      chip("source", state.leadSource, { guest: true, mono: true });
      chip("personalization", "limited", { guest: true });
    } else {
      chip("name", state.name || "(not provided)");
      if (state.email) chip("email", state.email);
      if (state.company) chip("company", state.company);
      if (state.title) chip("title", state.title);
      if (state.linkedin) chip("linkedin", shortenLinkedIn(state.linkedin));
      chip("path", state.entryPath, { mono: true });
      chip("source", state.leadSource, { mono: true });
      chip("follow-up", state.email ? "email queued" : "skipped (no email)");
    }

    return out.join("");
  }

  // -------------------------
  // Telemetry state (Option B)
  // -------------------------
  const sessionStart = Date.now();
  const telemetry = {
    identity: "anonymous", // anonymous | guest | live
    actions: 0,
    recent: []
  };

  function setIdentity(next) {
    telemetry.identity = next;
    if (tMode) tMode.textContent = next;
    if (signalPill) {
      signalPill.textContent = next === "live" ? "Live" : "Capturing";
    }
  }

  function pushRecent(label) {
    telemetry.recent.unshift(label);
    telemetry.recent = telemetry.recent.slice(0, 4);

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

  function initTelemetryPreview() {
    const entryPath = getEntryPath();
    const leadSource = getLeadSourceLabel();

    if (signalChips) {
      signalChips.innerHTML =
        `<span class="chip guest"><span class="k">path</span><span class="mono">${escapeHtml(entryPath)}</span></span>` +
        `<span class="chip guest"><span class="k">source</span><span class="mono">${escapeHtml(leadSource)}</span></span>`;
    }

    setIdentity("anonymous");

    // timer (UI only)
    setInterval(() => {
      const sec = Math.floor((Date.now() - sessionStart) / 1000);
      if (tTime) tTime.textContent = formatElapsed(sec);
    }, 1000);
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

  function trackIfIdentified(state, eventName, extra = {}) {
    // only attach server events if we have an email (aka deanonymized)
    if (state && state.email) {
      postEvent({ email: state.email, event: eventName, ...extra });
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

    // reset then stagger in
    stepEls.forEach(el => el.classList.remove("is-in"));
    stepEls.forEach((el, i) => setTimeout(() => el.classList.add("is-in"), 160 + i * 220));
  }

  function hideFormArea() {
    if (!formArea) return;
    formArea.classList.add("is-gone");
  }

  function reveal(state) {
    // Clear fog + show experience
    if (fog) fog.classList.add("is-cleared");
    if (experience) experience.classList.add("is-on");

    // Hide form smoothly (this is the “fog clears” moment)
    hideFormArea();

    // Copy
    if (statusText) statusText.textContent = state.guest ? "Guest mode" : "Live";
    if (heroTitle) heroTitle.textContent = state.guest ? "Guest walkthrough" : "Personalized walkthrough";
    if (heroSub) {
      heroSub.textContent = state.guest
        ? "You’re viewing the guest version of the live system. You can still see attribution + structure — personalization and CRM capture are limited."
        : "Nice to meet you. This page now adapts to what you submitted — and logs signals in real systems while you browse.";
    }

    const displayName = (state.name || state.email || "there").trim();
    if (hello) hello.textContent = `Welcome, ${displayName}`;

    if (context) {
      context.textContent = state.guest
        ? "You’re in guest mode. Want the full proof? Enter a work email above to trigger CRM capture + automated follow-up."
        : "This is intentionally subtle: personalization, attribution, capture, and follow-up are happening as you read.";
    }

    if (chips) chips.innerHTML = buildChips(state);

    // Right panel stays focused on “session signals + telemetry”
    if (signalChips) {
      signalChips.innerHTML =
        `<span class="chip guest"><span class="k">path</span><span class="mono">${escapeHtml(state.entryPath || "direct")}</span></span>` +
        `<span class="chip guest"><span class="k">source</span><span class="mono">${escapeHtml(state.leadSource || "Direct")}</span></span>`;
    }

    // Identity state
    setIdentity(state.guest ? "guest" : "live");

    // Steps animate
    animateSteps(state.guest);

    // NO AUTO-SCROLL (removed on purpose)
  }

  // -------------------------
  // Meaningful interactions wiring
  // -------------------------
  function wireOutboundTracking(state) {
    function onClick(a, label, eventName, toUrl) {
      if (!a) return;
      a.addEventListener("click", () => {
        incAction(label);
        trackIfIdentified(state, eventName);
        if (toUrl) a.href = toUrl;
      });
    }

    onClick(resumeLink, "Resume opened", "resume_clicked", RESUME_TO);
    onClick(linkedinLink, "LinkedIn opened", "linkedin_clicked", LINKEDIN_TO);

    // optional but useful
    onClick(faqLink, "FAQ opened", "faq_clicked");
    onClick(startOverLink, "Start over", "start_over_clicked");
  }

  function wirePathButtons(state) {
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
      b.addEventListener("click", () => {
        const key = b.getAttribute("data-toggle");
        const isExpanded = b.getAttribute("aria-expanded") === "true";
        const willOpen = !isExpanded;

        sections.forEach(k => setOpen(k, k === key ? willOpen : false));

        // Meaningful telemetry: section open/close
        const label = willOpen ? `Opened: ${key}` : `Closed: ${key}`;
        incAction(label);
        trackIfIdentified(state, "path_section_toggled", { section: key, open: willOpen });

        // keep the “feel” but not a full page jump
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

  function buildStateFromInputs({ guest }) {
    const firstName = (elFirst?.value || "").trim();
    const lastName = (elLast?.value || "").trim();
    const name = `${firstName} ${lastName}`.trim();

    return {
      guest: !!guest,
      name,
      email: (elEmail?.value || "").trim(),
      company: (elCompany?.value || "").trim(),
      title: (elTitle?.value || "").trim(),
      linkedin: (elLinkedIn?.value || "").trim(),
      entryPath: getEntryPath(),
      leadSource: getLeadSourceLabel(),
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(msgError, "");
    setMsg(msgSuccess, "");
    if (statusText) statusText.textContent = "Submitting…";
    if (btn) btn.disabled = true;

    const state = buildStateFromInputs({ guest: false });

    if (!state.email) {
      setMsg(msgError, "Please enter a work email (or use Guest mode).");
      if (statusText) statusText.textContent = "Ready";
      if (btn) btn.disabled = false;
      return;
    }

    const payload = {
      firstName: (elFirst?.value || "").trim(),
      lastName: (elLast?.value || "").trim(),
      company: state.company,
      title: state.title,
      linkedin: state.linkedin,
      email: state.email,
      portfolioSlug: state.entryPath,
      turnstileToken: getTurnstileToken(),
    };

    try {
      const data = await postIntro(payload);
      if (data && data.ok === false) throw new Error(data.error || "Something went wrong submitting the form.");

      setMsg(msgSuccess, "Captured. Clearing the fog…");
      incAction("Form submitted");
      // Once identified, we can post server-side events
      reveal(state);

      wireOutboundTracking(state);
      wirePathButtons(state);

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
    const state = buildStateFromInputs({ guest: true });

    incAction("Entered guest mode");
    reveal({ ...state, email: "" });

    // In guest mode we still want local telemetry + UI interactions
    wireOutboundTracking({ ...state, email: "" });
    wirePathButtons({ ...state, email: "" });

    if (statusText) statusText.textContent = "Guest mode";
  }

  // -------------------------
  // Init
  // -------------------------
  if (form) form.addEventListener("submit", handleSubmit);
  if (guestBtn) guestBtn.addEventListener("click", handleGuest);

  initTelemetryPreview();

  // Before submit/guest, we can still record meaningful topbar clicks locally (telemetry),
  // but not post server events since there’s no email yet.
  wireOutboundTracking({ email: "" });
})();
