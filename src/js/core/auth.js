/**
 * NOVAADMIN — demo session (single source of truth)
 * ------------------------------------------------------------------
 * Every piece of code that reads, writes or ends the demo session goes through
 * this module. Before v1.1 the logic was copy-pasted in five places with
 * slightly different rules, which produced two real bugs:
 *
 *   • “random logout”: preference resets wiped every `nova:` key (including
 *     the session) and any reload that landed on `/` showed the marketing page;
 *   • “login skips the form”: the landing CTA jumped straight to the dashboard
 *     whenever an old session existed, so the login page was never shown.
 *
 * The session lives in localStorage (survives reloads / new tabs), mirrored to
 * sessionStorage and a first-party cookie so it also survives browsers or
 * embedded previews where one of those stores is blocked. It is sliding: every
 * guarded page view renews it, and it only expires after `TTL_DAYS` of total
 * inactivity (or when “remember me” is off and the browser session ends).
 */

const KEY = 'nova:session';
const COOKIE = 'nova_session';
const LAST_ROUTE = 'nova:lastRoute';
const TAB_FLAG = 'nova:tabInPanel';
const TTL_DAYS = 14;
const DAY = 86_400_000;

const safe = (fn, fallback = null) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

function readCookie() {
  return safe(() => {
    const match = document.cookie.split('; ').find((row) => row.startsWith(`${COOKIE}=`));
    return match ? decodeURIComponent(match.slice(COOKIE.length + 1)) : null;
  });
}

function writeCookie(value, days) {
  safe(() => {
    const age = days ? `; max-age=${Math.round(days * 86400)}` : '';
    document.cookie = `${COOKIE}=${encodeURIComponent(value)}; path=/${age}; SameSite=Lax`;
  });
}

function parse(raw) {
  if (!raw) return null;
  const data = safe(() => JSON.parse(raw), null);
  /* Legacy builds stored plain strings — still a valid session. */
  if (!data || typeof data !== 'object') return { email: 'demo@novaadmin.dev', name: 'سارا محمدی', at: Date.now(), remember: true };
  return data;
}

function isExpired(session) {
  if (!session) return true;
  const seen = Number(session.seen ?? session.at ?? 0);
  if (!seen) return false;
  return Date.now() - seen > TTL_DAYS * DAY;
}

/** The current session object or `null`. */
export function getSession() {
  const raw =
    safe(() => window.localStorage.getItem(KEY)) ??
    safe(() => window.sessionStorage.getItem(KEY)) ??
    readCookie() ??
    safe(() => window.__nova_session ?? null);
  const session = parse(raw);
  if (session && isExpired(session)) {
    clearSession();
    return null;
  }
  return session;
}

export function isAuthenticated() {
  return Boolean(getSession());
}

/**
 * Starts a session.
 * @param {{email?: string, name?: string, role?: string, remember?: boolean}} user
 */
export function setSession(user = {}) {
  const remember = user.remember !== false;
  const session = {
    email: user.email || 'demo@novaadmin.dev',
    name: user.name || 'سارا محمدی',
    role: user.role || 'مدیر ارشد',
    token: `demo-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    remember,
    at: Date.now(),
    seen: Date.now(),
  };
  const raw = JSON.stringify(session);
  if (remember) safe(() => window.localStorage.setItem(KEY, raw));
  else safe(() => window.localStorage.removeItem(KEY));
  safe(() => window.sessionStorage.setItem(KEY, raw));
  writeCookie(raw, remember ? TTL_DAYS : 0);
  safe(() => {
    window.__nova_session = raw;
  });
  safe(() => window.localStorage.setItem('nova:lastLogin', String(Date.now())));
  return session;
}

/** Renews the sliding expiry and remembers where the user is. */
export function touchSession(page = '') {
  const session = getSession();
  if (!session) return null;
  session.seen = Date.now();
  const raw = JSON.stringify(session);
  if (session.remember !== false) safe(() => window.localStorage.setItem(KEY, raw));
  safe(() => window.sessionStorage.setItem(KEY, raw));
  writeCookie(raw, session.remember !== false ? TTL_DAYS : 0);
  if (page) {
    safe(() => window.localStorage.setItem(LAST_ROUTE, JSON.stringify({ page, at: Date.now() })));
    safe(() => window.sessionStorage.setItem(TAB_FLAG, '1'));
  }
  return session;
}

/** Ends the session everywhere (all stores + cookie). */
export function clearSession() {
  safe(() => window.localStorage.removeItem(KEY));
  safe(() => window.sessionStorage.removeItem(KEY));
  safe(() => window.sessionStorage.removeItem(TAB_FLAG));
  safe(() => window.localStorage.removeItem(LAST_ROUTE));
  writeCookie('', 0);
  safe(() => {
    document.cookie = `${COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  });
  safe(() => {
    delete window.__nova_session;
  });
}

/** Last guarded page visited (template-relative path) within `maxAge` ms. */
export function lastRoute(maxAge = 30 * 60 * 1000) {
  const data = safe(() => JSON.parse(window.localStorage.getItem(LAST_ROUTE) || 'null'));
  if (!data?.page || !/^[a-z0-9][a-z0-9./_-]*\.html$/i.test(data.page)) return null;
  if (Date.now() - Number(data.at || 0) > maxAge) return null;
  return data.page;
}

/** True when this browser tab was inside the panel before (survives reloads). */
export function tabWasInPanel() {
  return safe(() => window.sessionStorage.getItem(TAB_FLAG) === '1', false);
}

/** Sanitises a `?next=` target: template-relative `.html`, never an auth page. */
export function safeNext(value, fallback = 'dashboards/analytics.html') {
  if (!value || !/^[a-z0-9][a-z0-9./_-]*\.html$/i.test(value) || value.startsWith('auth/') || value.includes('..')) return fallback;
  return value;
}

/** Storage keys that must survive “reset preferences / clear data”. */
export const PROTECTED_KEYS = ['session', 'lastRoute', 'lastLogin'];

export default { getSession, setSession, touchSession, clearSession, isAuthenticated, lastRoute, tabWasInPanel, safeNext, PROTECTED_KEYS };
