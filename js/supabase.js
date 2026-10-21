import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const isConfigured = () =>
    SUPABASE_URL.startsWith('https://') && !SUPABASE_KEY.startsWith('PEGA_');

const TOKEN_KEY = 'staff_token';
export const getToken = () => {
    try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t) => {
    try {
        if (t) sessionStorage.setItem(TOKEN_KEY, t);
        else sessionStorage.removeItem(TOKEN_KEY);
    } catch { /* sin almacenamiento: la sesión dura hasta recargar */ }
};

async function call(path, { method = 'GET', body, token, prefer, headers } = {}) {
    const res = await fetch(`${SUPABASE_URL}${path}`, {
        method,
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token || SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            ...(prefer ? { Prefer: prefer } : {}),
            ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        try { err.detail = await res.json(); } catch { /* sin cuerpo */ }
        throw err;
    }
    return res.status === 204 ? null : res.json().catch(() => null);
}

export const submitRecord = (row) =>
    call('/rest/v1/submissions', { method: 'POST', body: row, prefer: 'return=minimal' });

export async function login(email, password) {
    const data = await call('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: { email, password },
    });
    setToken(data.access_token);
}

export const listSubmissions = () =>
    call('/rest/v1/submissions?select=*&order=created_at.desc', { token: getToken() });

export const setStatus = (id, status) =>
    call(`/rest/v1/submissions?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', body: { status }, token: getToken(), prefer: 'return=minimal',
    });

export const deleteSubmission = (id) =>
    call(`/rest/v1/submissions?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE', token: getToken(), prefer: 'return=minimal',
    });
