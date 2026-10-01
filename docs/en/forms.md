# Forms and validation

All forms come ready with localized messages, live validation and several visual states. No validation library is installed.

## Form states

| State | Class / attribute |
| --- | --- |
| Default | `.form-control` |
| Focus | Automatic via CSS (`:focus-visible`) |
| Filled | `.is-filled` (set by JS after a value is entered) |
| Disabled | `disabled` |
| Read-only | `readonly` |
| Error | `.is-invalid` + `.field-feedback` |
| Success | `.is-valid` |
| Submitting | `.is-loading` on the submit button |

## Declarative validation

```html
<form data-validate novalidate>
  <div class="form-field">
    <label class="form-label" for="email">Email</label>
    <input id="email" name="email" class="form-control" type="email" required data-rule="email" data-validate-live="true">
    <p class="field-feedback" hidden></p>
  </div>

  <div class="form-field">
    <label class="form-label" for="nationalId">National ID</label>
    <input id="nationalId" name="nationalId" class="form-control" data-rule="nationalId">
  </div>

  <div class="form-field">
    <label class="form-label" for="password">Password</label>
    <input id="password" name="password" class="form-control" type="password" required data-rule="password" data-min="8" data-password-field="#password-meter">
    <div class="password-meter" id="password-meter"><span data-password-bar></span><span data-password-bar></span><span data-password-bar></span><span data-password-bar></span><small data-password-label></small></div>
  </div>

  <div class="form-field">
    <label class="form-label" for="confirm">Confirm password</label>
    <input id="confirm" name="confirm" class="form-control" type="password" required data-match="password">
  </div>

  <button class="btn btn-primary" type="submit">Save</button>
</form>
```

## Built-in rules

| Rule | Check |
| --- | --- |
| `required` | Not empty |
| `email` | Email format |
| `phone` | Iranian mobile number (09xxxxxxxxx) |
| `nationalId` | Iranian national ID with check digit |
| `postal` | 10-digit postal code |
| `iban` | IBAN (Sheba) with the IR prefix |
| `url` | Web address |
| `number` | Number (Persian digits supported) |
| `password` | Minimum length (`data-min`) |
| `pattern` | The `data-pattern` regex |
| `min` / `max` | Value length |
| `match` | Equal to another field |
| `terms` | Terms accepted |

Persian and Arabic digits are converted to Latin before checking; the user can type «۰۹۱۲۳۴۵۶۷۸۹» or "09123456789".

## Programmatic validation

```js
import { validateForm, validateField } from './js/core/form.js';

const { valid, fields } = validateForm(form);
if (!valid) {
  console.log(fields.filter((item) => !item.valid).map((item) => item.field.name));
}
```

## Form widgets

| Widget | HTML marker |
| --- | --- |
| File drop zone | `[data-file-drop]` |
| Tag input | `[data-tag-input]` |
| Password strength meter | `[data-password-field="#meter"]` + `[data-password-bar]` |
| Dependent select | `[data-depends-on="province"]` |
| Stepper | `[data-stepper]` |
| One-time code | `[data-otp]` with `.otp-row` and `.otp-input` |
| Date picker | `input[type="date"]` / `[data-datepicker]` |
| Amount input with thousands mask | `[data-currency-input]` |

All of these are initialised with `initForms()` in `main.js`, and can be applied to freshly rendered content with `initForms(scope)`.

## Dynamic forms

To build a form from a definition (like the "Add record" forms):

```js
import { formMarkup, collectValues, openRecordForm } from './js/pages/kit.js';

const markup = formMarkup([
  { name: 'title', label: 'Title', required: true },
  { name: 'price', label: 'Price', type: 'number', rule: 'number' },
  { name: 'status', label: 'Status', type: 'select', options: ['active', 'draft'] },
  { name: 'notes', label: 'Notes', type: 'textarea', col: 2, rows: 4 },
]);
```

> Tip: mark the submit button with the `is-loading` class so it is disabled and shows a spinner during the request; every form in the template uses this pattern.

> Warning: never use client-side validation in place of server validation. This layer is for user experience, not security.
