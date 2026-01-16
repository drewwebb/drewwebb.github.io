/* js/form.js
   Single-page reveal:
   - Slug attribution (from URL or cookies)
   - Submit -> POST to API -> reveal experience
   - Guest -> reveal experience (no API call)
   - Click tracking -> POST /event
   - Time-on-page -> POST /event at 30s + 90s (only if email exists)
*/

(() => {
  // ✅ Your Worker/API root
  const API_ROOT = "https://api.drewwebbai.com";
  const API_EVENT = API_ROOT + "/event";

  // Targets
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

  const heroTitle = document.getElementById("hero-title");
  const heroSub = document.getElementById("hero-sub");

  const hello = document.getElementById("hello");
  const context = document.getElementById("context");
  const chips = document.getElementById("chips");

  const statusText = document.getElementById("status-text");
  const signalChips = document.getElementById("signal-chips");

  const stepsWrap = document.getElementById("steps");
  const stepEls = stepsWrap ? Array.from(stepsWrap.querySelectorAll(".step")) : [];

  // Inputs
  const elFirst = document.getElementById("firstName");
  const elLast = document.getElementById("lastName");
  const elCompany = document.getElementById("company");
  const elTitle = document.getElementById("title");
  const elLinkedIn = document.getElementById("linkedin");
  const elEmail = document.getElementById("email");

  // Top links (we convert clicks to tracked events)
  const resumeLink = document.getElementById("resume-link");
  const linkedinLink = document.getElementById("linkedin-link");

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
    const m = document.cookie.match(new RegExp("(^|; )" + name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") + "=([^;]*)"));
    return m ? decodeURIComponent(m[2]) : "";
  }

  // We support:
  // - portfolioSlug (preferred)
  // - ref (older)
  // - portfolio_slug cookie (set by /r/:slug)
  // - first_ref cookie (set by /r/:slug?ref=)
  function getEntryPath() {
    const fromQuery = (qs("portfolioSlug") || qs("portfolio_slug") || qs("ref") || "").trim();
    if (fromQuery) return fromQuery;

    const fromCookie = (readCookie("portfolio_slug") || readCookie("first_ref") || "").trim();
    if (fromCookie) return fromCookie;

    return "direct";
  }

  function getLeadSourceLabel() {
    // /r/:slug sets leadSource=... already in your redirect worker
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
      // prefer showing /in/xxxx
      if (u.pathname && u.pathname.startsWith("/in/")) return u.pathname.replace(/\/$/, "");
      return (u.hostname + u.pathname).replace(/\/$/, "");
    } catch {
      // fallback if not a full URL
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
      out.push(
        `<span class="${cls}${mono}"><span class="k">${escapeHtml(key)}</span><span>${escapeHtml(value)}</span></span>`
      );
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

      // this is “true” if they gave an email (your worker sends it)
      chip("follow-up", state.email ? "email queued" : "skipped (no email)");
    }

    return out.join("");
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

  // -------------------------
  // Reveal logic
  // -------------------------
  function animateSteps(isGuest) {
    // 3 steps: tweak copy depending on guest vs personalized
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

    // stagger in
    stepEls.forEach((el, i) => {
      setTimeout(() => el.classList.add("is-in"), 180 + i * 220);
    });
  }

  function reveal(state) {
    // Clear fog + show experience
    if (fog) fog.classList.add("is-cleared");
    if (experience) experience.classList.add("is-on");

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

    // Session signals panel on the right
    if (signalChips) {
      signalChips.innerHTML =
        `<span class="chip guest"><span class="k">path</span><span class="mono">${escapeHtml(state.entryPath || "direct")}</span></span>` +
        `<span class="chip guest"><span class="k">source</span><span class="mono">${escapeHtml(state.leadSource || "Direct")}</span></span>`;
    }

    // Steps animate
    animateSteps(state.guest);

    // Deep dive toggles (single open)
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
        sections.forEach(k => setOpen(k, k === key ? !isExpanded : false));
        b.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    });

    // Scroll to experience (feel like “walking in”)
    setTimeout(() => {
      experience.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);
  }

  // -------------------------
  // Tracking events
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

  function wireOutboundTracking(state) {
    // We track only if we have an email (so it can attach to HubSpot contact)
    function onClick(a, eventName, toUrl) {
      if (!a) return;
      a.addEventListener("click", (e) => {
        // open in new tab regardless
        // (keep default behavior for normal anchors; we just fire event)
        if (state.email) {
          postEvent({ email: state.email, event: eventName });
        }
        // ensure the actual destination is correct (resume route already pretty)
        if (toUrl) a.href = toUrl;
      });
    }

    // Your resume link is a route on drewwebbai.com (pretty). Keep it.
    onClick(resumeLink, "resume_clicked", RESUME_TO);
    onClick(linkedinLink, "linkedin_clicked", LINKEDIN_TO);
  }

  function startTimeOnPage(state) {
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

    // require email for full flow (since your worker requires it)
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

      // IMPORTANT: pass slug/path into your worker to keep attribution consistent
      portfolioSlug: state.entryPath,

      // optional token (only useful if worker validates it)
      turnstileToken: getTurnstileToken(),
    };

    try {
      const data = await postIntro(payload);

      if (data && data.ok === false) {
        throw new Error(data.error || "Something went wrong submitting the form.");
      }

      setMsg(msgSuccess, "Captured. Clearing the fog…");

      // reveal UI
      reveal(state);
      wireOutboundTracking(state);
      startTimeOnPage(state);

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

    // In guest mode, still show entry path/source (from slug)
    reveal({ ...state, email: "" });
    wireOutboundTracking({ ...state, email: "" }); // no event posts without email
    if (statusText) statusText.textContent = "Guest mode";
  }

  // Init: show session signals immediately (without needing submit)
  function initSignalsPreview() {
    const entryPath = getEntryPath();
    const leadSource = getLeadSourceLabel();

    if (signalChips) {
      signalChips.innerHTML =
        `<span class="chip guest"><span class="k">path</span><span class="mono">${escapeHtml(entryPath)}</span></span>` +
        `<span class="chip guest"><span class="k">source</span><span class="mono">${escapeHtml(leadSource)}</span></span>`;
    }
  }

  // Hook up
  if (form) form.addEventListener("submit", handleSubmit);
  if (guestBtn) guestBtn.addEventListener("click", handleGuest);

  initSignalsPreview();
})();
