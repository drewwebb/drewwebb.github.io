/* js/form.js
   Posts intro form to your Worker API (NOT GitHub Pages).
*/

(() => {
  // ✅ Your Worker/API root
  const API_ROOT = "https://api.drewwebbai.com";
  const WELCOME_PATH = "/welcome.html";
  const INDEX_PATH = "/index.html";

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

  // Cloudflare Turnstile (optional; only used if present)
  // If your site already handles this elsewhere, no harm — we just try to read it.
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

  // If you’re using ?ref=... or /r/:slug sets ref into query, we’ll pass it through.
  // We also turn it into a portfolioSlug convention you’re already using.
  function getPortfolioSlug() {
    // Prefer explicit portfolioSlug if you set one somewhere
    const direct = qs("portfolioSlug");
    if (direct) return direct;

    const ref = qs("ref");
    if (!ref) return "";
    // You’ve been using values like recruiter-draftkings; keep it consistent
    // If ref is already recruiter-draftkings, this returns it unchanged.
    return ref;
  }

  async function postIntro(payload) {
    const res = await fetch(API_ROOT + "/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      throw new Error(`Server error: HTTP ${res.status}${text ? ` — ${text}` : ""}`);
    }

    // Worker returns JSON; but we parse from text so we can display body on weird errors
    let data = {};
    try { data = JSON.parse(text); } catch {}
    return data;
  }

  function redirectToWelcome(payload) {
    const u = new URL(WELCOME_PATH, window.location.origin);

    const fullName = `${payload.firstName || ""} ${payload.lastName || ""}`.trim();
    if (fullName) u.searchParams.set("name", fullName);
    if (payload.email) u.searchParams.set("email", payload.email);
    if (payload.company) u.searchParams.set("company", payload.company);
    if (payload.title) u.searchParams.set("title", payload.title);
    if (payload.linkedin) u.searchParams.set("linkedin", payload.linkedin);

    // Keep attribution/ref if present
    const ref = qs("ref");
    if (ref) u.searchParams.set("ref", ref);

    window.location.assign(u.toString());
  }

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
      portfolioSlug: getPortfolioSlug(),
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
