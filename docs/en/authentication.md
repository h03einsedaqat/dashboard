# Authentication

The template's authentication pages have a complete UI and real behaviour, but they are not connected to a backend. This section explains what is ready and what you need to do to connect them.

## Available pages

| Page | Path | Notes |
| --- | --- | --- |
| Sign in | `auth/login.html` | Two columns with an intro panel |
| Minimal sign-in | `auth/login-minimal.html` | No side panel, focused on the form |
| Split sign-in | `auth/login-split.html` | A different promotional layout |
| Sign up | `auth/register.html` | Full validation + password strength |
| Forgot password | `auth/forgot-password.html` | Sends a link |
| Reset password | `auth/reset-password.html` | New password + confirmation |
| Verify email | `auth/verify-email.html` | 6-digit code (OTP) |
| Two-factor sign-in | `auth/two-factor.html` | Authenticator app code |
| Lock screen | `auth/lock-screen.html` | Unlock with password |
| Sign out | `auth/logout.html` | Sign-out confirmation |
| Sign-in error | `auth/error.html` | Error state |

All pages use the `app-body--auth` shell: no sidebar, with theme/direction/language buttons and a "Sign in to demo" shortcut.

## What actually works?

- Validation of every field (email, phone, national ID, password, matching confirmation)
- One-time code inputs with automatic focus jumps between boxes and code pasting
- Button loading state and success/error messages
- Redirect to the dashboard after success (simulated)
- Rate limiting and "Sign in with Google/GitHub" buttons that show an info message in the demo

## Connecting to a real API

1. Create an authentication service:

```js
// src/services/auth.service.js
import { call } from './client.js';

export const authService = {
  login: (credentials) => call('post', 'auth/login', { body: credentials, resolver: () => ({ token: 'demo', user: { name: 'Sara Mohammadi' } }) }),
  register: (payload) => call('post', 'auth/register', { body: payload }),
  forgot: (email) => call('post', 'auth/forgot', { body: { email } }),
  verify: (code) => call('post', 'auth/verify', { body: { code } }),
  logout: () => call('post', 'auth/logout'),
};
```

2. In `src/js/pages/content.js`, inside `initAuth()`, wire the submit handler to it:

```js
const { authService } = await import('../../services/auth.service.js');

on($('[data-auth-form]', node), 'submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('[data-submit]', form);
  button.classList.add('is-loading');
  try {
    const session = await authService.login(collectValues(form));
    localStorage.setItem('nova:token', session.token);
    window.location.assign('dashboards/analytics.html');
  } catch (error) {
    toast.danger('Sign-in failed', error.message);
  } finally {
    button.classList.remove('is-loading');
  }
});
```

3. Add the token to the headers in `client.js`:

```js
const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
```

4. For protected routes, check at the top of `main.js` that a token exists and otherwise redirect to `auth/login.html`. (In the demo build this check is lenient so every page can be browsed freely.)

## Security notes

- Never keep the password in `localStorage`; only the token.
- Protect the `auth/*` routes on the server side too.
- For one-time codes, enforce expiry and attempt limits on the server.
- Use a CSRF token in real forms.

> Tip: the template does not install any external authentication service (no Firebase/Supabase), so your choice of backend stays open.

> Warning: in demo mode no user data is stored; whatever you enter stays only in that browser and in the page's memory.
