// /js/form.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#lead-form');
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

    // Optional: Turnstile token (Worker currently ignores it; fine to send anyway)
    const token = window.turnstile && window.turnstile.getResponse();

    const firstName = document.querySelector('#firstName')?.value?.trim() || '';
    const lastName  = document.querySelector('#lastName')?.value?.trim()  || '';
    const company   = document.querySelector('#company')?.value?.trim()   || '';
    const title     = document.querySelector('#title')?.value?.trim()     || '';
    const linkedin  = document.querySelector('#linkedin')?.value?.trim()  || '';
    const email     = document.querySelector('#email')?.value?.trim()     || '';

    // basic email check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      show(errBox, 'Please enter a valid email address.');
      btn.disabled = false;
      return;
    }

    // compose the 'message' field for the Worker email
    const name = `${firstName} ${lastName}`.trim();
    const message =
`Company: ${company || '(n/a)'}
Title: ${title || '(n/a)'}
LinkedIn: ${linkedin || '(n/a)'}
Turnstile token: ${token || '(none)'}
`;

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, message })
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || 'Submission failed');
      }

      // success → send to welcome page with personalization
      const params = new URLSearchParams({ name: name || 'Friend', email });
      window.location.href = `/welcome.html?${params.toString()}`;

    } catch (err) {
      show(errBox, 'Network or server error. Please try again.');
      window.turnstile && window.turnstile.reset();
    } finally {
      btn.disabled = false;
    }
  });
});
