// /js/form.js
document.addEventListener('DOMContentLoaded', () => {
  const form   = document.querySelector('#lead-form');
  const errBox = document.querySelector('#msg-error');
  const okBox  = document.querySelector('#msg-success');
  const btn    = document.querySelector('#submitBtn');

  const API = 'https://api.drewwebbai.com/send';

  const show = (el, msg) => { el.textContent = msg; el.style.display = 'block'; };
  const hide = (el) => { el.style.display = 'none'; };

  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[2]) : '';
  }

  function getQueryParam(name) {
    try { return new URLSearchParams(window.location.search).get(name) || ''; }
    catch { return ''; }
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hide(errBox); hide(okBox);
    btn.disabled = true;

    const firstName = document.querySelector('#firstName')?.value?.trim() || '';
    const lastName  = document.querySelector('#lastName')?.value?.trim()  || '';
    const company   = document.querySelector('#company')?.value?.trim()   || '';
    const title     = document.querySelector('#title')?.value?.trim()     || '';
    const linkedin  = document.querySelector('#linkedin')?.value?.trim()  || '';
    const email     = document.querySelector('#email')?.value?.trim()     || '';

    // NEW: capture slug attribution (first-touch)
    const portfolioSlug =
      getCookie('portfolio_slug') ||
      getQueryParam('ps') ||
      getQueryParam('ref') || '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      show(errBox, 'Please enter a valid email address.');
      btn.disabled = false;
      return;
    }

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          firstName, lastName, company, title, linkedin, email,
          portfolioSlug // NEW
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const detail = (data && (data.detail || data.error)) || `HTTP ${res.status}`;
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
      }

      // still pass name/email to your welcome page UX
      const name = [firstName, lastName].filter(Boolean).join(' ') || 'Friend';
      const params = new URLSearchParams({ name, email });
      window.location.href = `/welcome.html?${params.toString()}`;

    } catch (err) {
      show(errBox, `Server error: ${err.message || 'please try again.'}`);
    } finally {
      btn.disabled = false;
    }
  });
});
