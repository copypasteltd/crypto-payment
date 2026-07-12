const API_BASE = import.meta.env.VITE_API_BASE ||'https://api.lastpush.xyz/api/v1';// 'http://127.0.0.1:4000/api/v1'//'https://api.lastpush.xyz/api/v1';

const getToken = () => localStorage.getItem('lastpush_token');

type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
};

const buildHeaders = (headers?: Record<string, string>) => {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };
};

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: buildHeaders(options.headers),
  });

  if (!res.ok) {
    let details = '';
    try {
      const data = await res.json();
      details = data?.error?.message || res.statusText;
    } catch {
      details = res.statusText;
    }
    throw new Error(details || 'Request failed');
  }

  if (res.status === 204) {
    return null as T;
  }

  return res.json() as Promise<T>;
};

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }),
  del: <T>(path: string) =>
    request<T>(path, {
      method: 'DELETE',
    }),
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, {
      method: 'POST',
      body: formData,
    }),
};
