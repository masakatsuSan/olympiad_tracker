// Thin fetch wrapper. The session lives in an httpOnly cookie, so the browser sends it automatically.
export class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }

async function request(method, path, body, raw) {
  const res = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw && res.ok) return res.text();
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error || 'Request failed.');
  return json;
}

export const api = {
  get: (p) => request('GET', p),
  text: (p) => request('GET', p, undefined, true),
  post: (p, b) => request('POST', p, b ?? {}),
  put: (p, b) => request('PUT', p, b),
  patch: (p, b) => request('PATCH', p, b),
  del: (p) => request('DELETE', p),
};

// Offers a text file as a browser download.
export function saveText(filename, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
