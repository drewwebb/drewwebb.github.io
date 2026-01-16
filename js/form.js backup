/* js/form.js
   Posts intro form to your Worker API (NOT GitHub Pages).
*/

(() => {
  // ✅ Your Worker/API root
  const API_ROOT = "https://api.drewwebbai.com";
  const WELCOME_PATH = "/welcome.html";
  const INDEX_PATH = "/index.html";

  // Try these endpoints in order (prevents the 404 you saw)
  const POST_ENDPOINTS = ["/send", "/"]; // "/send" first, then fallback to "/"

  // Form + UI elements (match your existing IDs)
  const form = document.getElementById("introForm");
  const errorBanner = document.getElementById("serverError"); // your red banner area (if present)
  const btn = document.getElementById("continueBtn"); // if you have a button id; optional

  // Inputs
  const elFirst = document.getElementById("firstName");
  const elLast = document.getElementById("lastName");
  const elCompany = document.getElementById("company");
  const elTitle = document.getElementById("title");
  const elLinkedIn = document.getElementById("linkedin");
  const elEmail = document.getElementById("email");

  // Cloudflare Turnstile (optional)
  function getTurnstileToken() {
    const hidden = document.querySelector('input[name="cf-turnstile-response"]');
    return hidden ? hidden.value : "";
  }

  function setError(msg) {
    if (!msg) return;
    if (errorBanner) {
      errorBanner.textContent = msg;
      errorBanner.style.display = "block";
    } else {
      alert(msg);
    }
  }

  function clearError() {
    if (errorBanner) {
      errorBanner.textContent = "";
      errorBanner.style.display = "none";
    }
  }

  function qs(key) {
    return new URLSearchParams(location.search).get(key) || "";
  }

  // --- Attribution helpers --------------------------------------------------

  function getRef() {
    return (qs("ref") || "").trim();
  }

  // If you’re using ?ref=... or /r/:slug sets ref into query, we’ll pass it through.
  // We also normalize it into a portfolioSlug convention.
  function getPortfolioSlug() {
    const direct =
      (qs("portfolioSlug") || qs("portfolio_slug") || "").trim();
    if (direct) return direct;

    const ref = getRef();
    if (!ref) return "";
    return ref;
  }

  // Lead source: prefer explicit params; fallback to UTM-ish; else infer from ref/direct
  function getLeadSource() {
    const explicit =
      (qs("leadSource") || qs("lead_source") || "").trim();
    if (explicit) return explicit;

    const utmSource = (qs("utm_source") || "").trim();
    const utmMedium = (qs("utm_medium") || "").trim();
    const utmCampaign = (qs("utm_campaign") || "").trim();

    if (utmSource || utmMedium || utmCampaign) {
      // Keep it readable, not noisy
      const parts = [];
      if (utmSource) parts.push(`utm_source:${utmSource}`);
      if (utmMedium) parts.push(`utm_medium:${utmMedium}`);
      if (utmCampaign) parts.push(`utm_campaign:${utmCampaign}`);
      return parts.join(" | ");
    }

    // Inference:
    // - if ref exists, it came from a tracked link (slug routing)
    // - else direct
    return getRef() ? "Tracked link" : "Direct";
  }

  // --- API posting ----------------------------------------------------------

  async function postIntro(payload) {
    let lastErr = null;

    for (const path of POST_ENDPOINTS) {
      try {
        const url = API_ROOT + path;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const text = await res.text().catch(() => "");

        if (!res.ok) {
          // If this endpoint isn't found, try the next one.
          if (res.status === 404) {
            lastErr = new Error(`Server error: HTTP 404 at ${path}${text ? ` — ${text}` : ""}`);
            continue;
          }
          throw new Error(`Server error: HTTP ${res.status}${text ? ` — ${text}` : ""}`);
        }

        // Worker returns JSON; parse from text so we can show body on weird errors
        let data = {};
        try { data = JSON.parse(text); } catch {}
        return data;

      } catch (e) {
        lastErr = e;
        // try next endpoint
      }
    }

    throw lastErr || new Error("Server error: unable to submit form");
  }

  // --- Redirect -------------------------------------------------------------

  function redirectToWelcome(payload) {
    const u = new URL(WELCOME_PATH, window.location.origin);

    const fullName = `${payload.firstName || ""} ${payload.lastName || ""}`.trim();
    if (fullName) u.searchParams.set("name", fullName);
    if (payload.email) u.searchParams.set("email", payload.email);
    if (payload.company) u.searchParams.set("company", payload.company);
    if (payload.title) u.searchParams.set("title", payload.title);
    if (payload.linkedin) u.searchParams.set("linkedin", payload.linkedin);

    // NEW: carry the exact attribution your welcome page expects
    if (payload.portfolioSlug) u.searchParams.set("portfolioSlug", payload.portfolioSlug);
    if (payload.leadSource) u.searchParams.set("leadSource", payload.leadSource);

    // Backward compatibility: still carry ref if present
    const ref = getRef();
    if (ref) u.searchParams.set("ref", ref);

    window.location.assign(u.toString());
  }

  // --- Submit handler -------------------------------------------------------

  async function handleSubmit(e) {
    e.preventDefault();
    clearError();

    const payload = {
      firstName: (elFirst?.value || "").trim(),
      lastName: (elLast?.value || "").trim(),
      company: (elCompany?.value || "").trim(),
      title: (elTitle?.value || "").trim(),
      linkedin: (elLinkedIn?.value || "").trim(),
      email: (elEmail?.value || "").trim(),

      // NEW: attribution fields
      portfolioSlug: getPortfolioSlug(),
      leadSource: getLeadSource(),

      // Optional; only useful if your Worker validates it
      turnstileToken: getTurnstileToken(),
    };

    // Basic validation (email required for “full” flow)
    if (!payload.email) {
      setError("Please enter a work email (or choose Continue as guest).");
      return;
    }

    // UI disable (optional)
    if (btn) btn.disabled = true;

    try {
      const data = await postIntro(payload);

      // If Worker reported an application-level error
      if (data && data.ok === false) {
        setError(data.error || "Something went wrong submitting the form.");
        if (btn) btn.disabled = false;
        return;
      }

      // Success → go to welcome
      redirectToWelcome(payload);
    } catch (err) {
      setError(err?.message || "Unexpected error");
      if (btn) btn.disabled = false;
    }
  }

  // Hook up submit
  if (form) {
    form.addEventListener("submit", handleSubmit);
  } else {
    // If you wired it to a button click instead of form submit
    const fallbackBtn = btn || document.querySelector('button[type="submit"]');
    if (fallbackBtn) fallbackBtn.addEventListener("click", handleSubmit);
  }

  // Start over button (optional convenience)
  const startOver = document.getElementById("startOver");
  if (startOver) startOver.addEventListener("click", () => window.location.assign(INDEX_PATH));
})();
