// /js/form.js
document.addEventListener('DOMContentLoaded', () => {
  const form   = document.querySelector('#lead-form');
  const errBox = document.querySelector('#msg-error');
  const okBox  = document.querySelector('#msg-success');
  const btn    = document.querySelector('#submitBtn');

  const API = 'https://api.drewwebbai.com/send';

  const show = (el, msg) => { el.textContent = msg; el.style.display = 'block'; };
  const hide = (el) => { el.style.display = 'none'; };

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hide(errBox); hide(okBox);
    btn.disabled = true;

    const token     = window.turnstile && window.turnstile.getResponse();
    const firstName = document.querySelector('#firstName')?.value?.trim() || '';
    const lastName  = document.querySelector('#lastName')?.value?.trim()  || '';
    const company   = document.querySelector('#company')?.value?.trim()   || '';
    const title     = document.querySelector('#title')?.value?.trim()     || '';
    const linkedin  = document.querySelector('#linkedin')?.value?.trim()  || '';
    const email     = document.querySelector('#email')?.value?.trim()     || '';

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
          firstName, lastName, company, title, linkedin, email, token
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        show(errBox, `Submission failed: ${data.error || res.statusText || 'unknown'}`);
        window.turnstile && window.turnstile.reset();
        btn.disabled = false;
        return;
      }

      const params = new URLSearchParams({ name: `${firstName} ${lastName}`.trim() || 'Friend', email });
      window.location.href = `/welcome.html?${params.toString()}`;

    } catch (err) {
      show(errBox, 'Network or server error. Please try again.');
      window.turnstile && window.turnstile.reset();
      btn.disabled = false;
    }
  });
});
