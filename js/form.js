// /js/form.js
document.addEventListener('DOMContentLoaded', () => {
  const form   = document.querySelector('#lead-form');
  const errBox = document.querySelector('#msg-error');
  const okBox  = document.querySelector('#msg-success');
  const btn    = document.querySelector('#submitBtn');

  // Your Worker custom domain
  const API = 'https://api.drewwebbai.com/send';

  const show = (el, msg) => { el.textContent = msg; el.style.display = 'block'; };
  const hide = (el) => { el.style.display = 'none'; };

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hide(errBox); hide(okBox);
    btn.disabled = true;

    // Collect values
    const firstName = document.querySelector('#firstName')?.value?.trim() || '';
    const lastName  = document.querySelector('#lastName')?.value?.trim()  || '';
    const company   = document.querySelector('#company')?.value?.trim()   || '';
    const title     = document.querySelector('#title')?.value?.trim()     || '';
    const linkedin  = document.querySelector('#linkedin')?.value?.trim()  || '';
    const email     = document.querySelector('#email')?.value?.trim()     || '';

    // Turnstile response (fine if empty; Worker will handle failure)
    const token = (window.turnstile && window.turnstile.getResponse()) || '';

    // quick email check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      show(errBox, 'Please enter a valid email address.');
      btn.disabled = false;
      return;
    }

    const payload = {
      firstName, lastName, company, title, linkedin, email, token
    };

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const msg = data.error || 'Submission failed.';
        throw new Error(msg);
      }

      // success → go to welcome page with light personalization
      const name = [firstName, lastName].filter(Boolean).join(' ') || 'Friend';
      const params = new URLSearchParams({ name, email });
      window.location.href = `/welcome.html?${params.toString()}`;

    } catch (err) {
      show(errBox, 'Network or server error. Please try again.');
      if (window.turnstile) window.turnstile.reset();
    } finally {
      btn.disabled = false;
    }
  });
});
