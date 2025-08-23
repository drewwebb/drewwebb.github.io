// ...keep your existing code above

try {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, email, message })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.ok) {
    const detail = (data && (data.detail || data.error)) || `HTTP ${res.status}`;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }

  const params = new URLSearchParams({ name: name || 'Friend', email });
  window.location.href = `/welcome.html?${params.toString()}`;

} catch (err) {
  show(errBox, `Server error: ${err.message || 'please try again.'}`);
  window.turnstile && window.turnstile.reset();
} finally {
  btn.disabled = false;
}
