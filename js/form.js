/* js/form.js
   Option B telemetry:
   - Attribution shown immediately (path/source)
   - Submit -> upsert -> reveal
   - Guest -> reveal (no API)
   - Track valuable interactions only (outbound links + choose-your-path opens)
   - UI timer starts on load (display only)
   - Server time markers only after submit (30s + 90s) and only if email exists
*/

(() => {
  const API_ROOT = "https://api.drewwebbai.com";
  const API_EVENT = API_ROOT + "/event";

  const RESUME_TO = "https://drewwebbai.com/resume";
  const LINKEDIN_TO = "https://www.linkedin.com/in/drewrwebb/";
  const FAQ_TO = "https://drewwebbai.com/faq.html";

  const form = document.getElementById("lead-form");
  const btn = document.getElementById("submitBtn");
  const guestBtn = document.getElementById("guestBtn");

  const msgError = document.getElementById("msg-error");

  const fog = document.getElementById("fog");
  const experience = document.getElementById("experience");

  const heroTitle = document.getElementById("hero-title");
  const heroSub = document.getElementById("hero-sub");

  const hello = document.getElementById("hello");
  const context = document.getElementById("context");

  const statusText = document.getElementById("status-text");
  const signalPill = document.getElementById("signal-pill");
  const signalChips = document.getElementById("signal-chips");

  const telemetryIdentity = document.getElementById("telemetry-identity");
  const telemetryTime = document.getElementById("telemetry-time");
  const telemetryClicks = document.getElementById("telemetry-clicks");
  const telemetryActions = document.getElementById("telemetry-actions");
  const telemetryCrm = document.getElementById("telemetry-crm");

  const introBlock = document.getElementById("intro-block");

  const stepsWrap = document.getElementById("steps");
  const stepEls = stepsWrap ? Array.from(stepsWrap.querySelectorAll(".step")) : [];

  const elFirst = document.getElementById("firstName");
  const elLast = document.getElementById("lastName");
  const elCompany = document.getElementById("company");
  const elTitle = document.getElementById("title");
  const elLinkedIn = document.getElementById("linkedin");
  const elEmail = document.getElementById("email");

  const resumeLink = document.getElementById("resume-link");
  const linkedinLink = document.getElementById("linkedin-link");
  const faqLink = document.getElementById("faq-link");

  let wired = false;
  let startTs = Date.now();
  let uiTimer = null;
  let interactions = 0;
  const recentActions = [];

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

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>'"]/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[c]);
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

  function addAction(text) {
    const t = String(text || "").trim();
    if (!t) return;
    const last = recentActions[0] || "";
    if (last === t) return;

    recentActions.unshift(t);
    if (recentActions.length > 6) recentActions.length = 6;

    if (telemetryActions) {
      telemetryActions.innerHTML = recentActions.map(x => `<li>${escapeHtml(x)}</li>`).join("");
    }
  }

  function setInteractions(n) {
    interactions = n;
    if (telemetryClicks) telemetryClicks.textContent = String(interactions);
  }

  function bumpInteractions(label) {
    setInteractions(interactions + 1);
    addAction(label);
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${String(s).padStart(2, "0")}s`;
  }

  function startUiTimer() {
    if (uiTimer) return;
    uiTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTs) / 1000);
      if (telemetryTime) telemetryTime.textContent = formatTime(elapsed);
    }, 500);
  }

  function initSignalsPreview() {
    const entryPath = getEntryPath();
    const leadSource = getLeadSourceLabel();

    if (signalChips) {
      signalChips.innerHTML =
        `<span class="chip guest"><span class="k">path</span><span class="mono">${escapeHtml(entryPath)}</span></span>` +
        `<span class="chip guest"><span class="k">source</span><span class="mono">${escapeHtml(leadSource)}</span></span>`;
    }

    if (telemetryIdentity) telemetryIdentity.textContent = "Anonymous";
    if (signalPill) signalPill.textContent = "Capturing";

    addAction("Page loaded");

    // UI timer starts on load (display only).
    // If you ever want it to start AFTER submit instead:
    // comment out startUiTimer() here, and call resetUiTimer() inside reveal().
    startUiTimer();
  }

  function resetUiTimer() {
    startTs = Date.now();
    if (uiTimer) clearInterval(uiTimer);
    uiTimer = null;
    startUiTimer();
  }

  function hideIntroBlock() {
    if (!introBlock) return;
    introBlock.classList.add("is-hidden");
  }

  function animateSteps(state) {
    const s1 = document.getElementById("step-1");
    const s2 = document.getElementById("step-2");
    const s3 = document.getElementById("step-3");
    const s4 = document.getElementById("step-4");
    const s5 = document.getElementById("step-5");

    if (state.guest) {
      if (s1) s1.textContent = "Attribution is captured (entry path + first-touch preserved).";
      if (s2) s2.textContent = "Guest mode selected (no CRM upsert, identity stays anonymous).";
      if (s3) s3.textContent = "You can still explore the system design and telemetry while browsing.";
      if (s4) s4.textContent = "Telemetry logs meaningful actions (links + section opens).";
      if (s5) s5.textContent = "This can be expanded with enrichment + routing rules in production.";
    } else {
      if (s1) s1.textContent = "You arrived via a tracked path. Your entry source was captured and attributed.";
      if (s2) s2.textContent = "You submitted the form. Your profile was upserted into the CRM and deduped by email.";
      if (s3) s3.textContent = "Your first-touch attribution is preserved. Future visits will not overwrite it.";
      if (s4) s4.textContent = "Automation is now active. Follow-up and engagement scoring have been triggered.";
      if (s5) s5.textContent = "As you explore, meaningful interactions are logged. Links and section opens are tracked in real time.";
    }

    stepEls.forEach(el => el.classList.remove("is-in"));
    stepEls.forEach((el, i) => setTimeout(() => el.classList.add("is-in"), 140 + i * 200));
  }

  function buildCrmTelemetry(state) {
    if (!telemetryCrm) return;

    if (state.guest) {
      telemetryCrm.innerHTML =
        `<span class="chip guest"><span class="k">status</span><span>Guest mode (no CRM upsert)</span></span>`;
      return;
    }

    const items = [];
    function tchip(k, v) {
      if (!v) return;
      items.push(`<span class="chip guest"><span class="k">${escapeHtml(k)}</span><span>${escapeHtml(v)}</span></span>`);
    }

    tchip("email", state.email);
    tchip("name", state.name || "(not provided)");
    tchip("company", state.company);
    tchip("title", state.title);
    if (state.linkedin) tchip("linkedin", shortenLinkedIn(state.linkedin));

    tchip("crm", "upserted");
    tchip("follow-up", "queued");

    telemetryCrm.innerHTML = items.join("");
  }

  function reveal(state) {
    if (fog) fog.classList.add("is-cleared");
    if (experience) experience.classList.add("is-on");

    hideIntroBlock();

    // OPTIONAL: if you want clock to start at submit/guest, uncomment this:
    // resetUiTimer();

    if (statusText) statusText.textContent = state.guest ? "Guest mode" : "Live";
    if (heroTitle) heroTitle.textContent = state.guest ? "Guest walkthrough" : "Welcome. This is the personalized walkthrough.";
    if (heroSub) {
      heroSub.textContent = state.guest
        ? "You’re viewing the guest version of the live system. Attribution is visible, but CRM capture and follow-up are skipped."
        : "This page has adapted to what you submitted, and real attribution, capture, and engagement signals continue to be written to live systems as you browse.";
    }

    const displayName = (state.name || state.email || "there").trim();
    if (hello) hello.textContent = `Welcome, ${displayName}`;

    if (context) {
      context.textContent = state.guest
        ? "You’re in guest mode. For full proof (CRM upsert + follow-up), enter a work email next time."
        : "The system now recognizes you and adapts as you explore. Keep an eye on the panel on the right to see live systems updating in real time.";
    }

    if (telemetryIdentity) telemetryIdentity.textContent = state.guest ? "Anonymous (guest)" : "Identified";
    if (signalPill) signalPill.textContent = state.guest ? "Guest" : "Live";

    buildCrmTelemetry(state);

    if (state.guest) addAction("Guest mode selected");
    else addAction("Form submitted");

    animateSteps(state);
  }

  async function postEvent(payload) {
    try {
      await fetch(API_EVENT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {}
  }

  function wireValuableTracking(state) {
    if (wired) return;
    wired = true;

    function trackIfIdentified(eventName, extra = {}) {
      bumpInteractions(eventName.replace(/_/g, " "));
      if (state.email) postEvent({ email: state.email, event: eventName, ...extra });
    }

    function onOutbound(a, eventName, toUrl) {
      if (!a) return;
      if (toUrl) a.href = toUrl;
      a.addEventListener("click", () => trackIfIdentified(eventName), { passive: true });
    }

    onOutbound(resumeLink, "resume_clicked", RESUME_TO);
    onOutbound(linkedinLink, "linkedin_clicked", LINKEDIN_TO);
    onOutbound(faqLink, "faq_clicked", FAQ_TO);

    const sections = ["about", "stacks", "behind"];

    function setOpen(key, open) {
      const panel = document.getElementById(`deep-${key}`);
      const b = document.querySelector(`.path[data-toggle="${key}"]`);
      if (!panel || !b) return;

      if (open) {
        panel.classList.add("is-open");
        panel.setAttribute("aria-hidden", "false");
        b.setAttribute("aria-expanded", "true");
        const hint = b.querySelector(".hint span");
        if (hint) hint.textContent = "Click to close";
      } else {
        panel.classList.remove("is-open");
        panel.setAttribute("aria-hidden", "true");
        b.setAttribute("aria-expanded", "false");
        const hint = b.querySelector(".hint span");
        if (hint) hint.textContent = "Click to open";
      }
    }

    sections.forEach(k => setOpen(k, false));

    document.querySelectorAll(".path[data-toggle]").forEach(b => {
      if (b.dataset.wired === "1") return;
      b.dataset.wired = "1";

      b.addEventListener("click", () => {
        const key = b.getAttribute("data-toggle");
        const isExpanded = b.getAttribute("aria-expanded") === "true";
        const willOpen = !isExpanded;

        sections.forEach(k => setOpen(k, k === key ? willOpen : false));

        if (willOpen) {
          trackIfIdentified("path_section_opened", { section: key });
          addAction(`Opened section: ${key}`);
        } else {
          addAction(`Closed section: ${key}`);
        }
      }, { passive: true });
    });
  }

  function startTimeOnPageServer(state) {
    if (!state.email) return;

    const fired = { 30: false, 90: false };
    const start = Date.now();

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);

      if (elapsed >= 30 && !fired[30]) {
        fired[30] = true;
        postEvent({ email: state.email, event: "time_on_page_sec", value: 30 });
      }
      if (elapsed >= 90 && !fired[90]) {
        fired[90] = true;
        postEvent({ email: state.email, event: "time_on_page_sec", value: 90 });
        clearInterval(timer);
      }
    }, 1000);
  }

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

      reveal(state);
      wireValuableTracking(state);
      startTimeOnPageServer(state);

      bumpInteractions("Form submit");
      addAction("CRM upsert: success");
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

    const state = buildStateFromInputs({ guest: true });

    reveal({ ...state, email: "" });
    wireValuableTracking({ ...state, email: "" });

    bumpInteractions("Guest mode");
    if (statusText) statusText.textContent = "Guest mode";
  }

  if (form) form.addEventListener("submit", handleSubmit);
  if (guestBtn) guestBtn.addEventListener("click", handleGuest);

  initSignalsPreview();
})();
