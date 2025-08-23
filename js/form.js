// /js/form.js
document.addEventListener('DOMContentLoaded', () => {
  const form   = document.querySelector('#lead-form');
  const errBox = document.querySelector('#msg-error');
  const btn    = document.querySelector('#submitBtn');

  const endpoint = 'https://api.drewwebbai.com/send';

  const show = (el, msg) => { el.textContent = msg; el.style.display = 'block'; };
  const hide = (el) => { el.style.display = 'none'; };

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hide(errBox);
    btn.disabled = true;

    const payload = {
      firstName: document.querySelector('#firstName')?.value?.trim() || '',
      lastName : document.querySelector('#lastName') ?.value?.trim() || '',
      company  : document.querySelector('#company') ?.value?.trim() || '',
      title    : document.querySelector('#title')   ?.value?.trim() || '',
      linkedin : document.querySelector('#linkedin')?.value?.trim() || '',
      email    : document.querySelector('#email')   ?.value?.trim() || '',
      token    : (window.turnstile && window.turnstile.getResponse()) || ''
    };

    // quick email check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      show(errBox, 'Please enter a valid email address.');
      btn.disabled = false;
      return;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'submission_failed');
      }

      const name = [payload.firstName, payload.lastName].filter(Boolean).join(' ') || 'Friend';
      const params = new URLSearchParams({ name, email: payload.email });
      window.location.href = `/welcome.html?${params.toString()}`;

    } catch (err) {
      show(errBox, 'Network or server error. Please try again.');
      window.turnstile && window.turnstile.reset();
    } finally {
      btn.disabled = false;
    }
  });
});
