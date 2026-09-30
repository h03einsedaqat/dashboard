# Converting to Laravel

If your project is Laravel, you can turn this template into Blade in a few steps. None of these steps is mandatory; the template also works fully as a static site.

## Step 1 — build the output

```bash
npm run build
```

Copy the contents of `dist/` into the Laravel project's `public/`:

```bash
cp -r dist/* /path/to/laravel/public/
```

From then on the site works at `https://example.com/` and all CSS/JS/fonts are relative.

## Step 2 — convert pages to Blade (optional)

Generated pages live in `src/pages/**` and shared fragments in `src/partials/**`. Convert the fragments into a layout once:

```blade
{{-- resources/views/layouts/app.blade.php --}}
<!doctype html>
<html lang="{{ config('nova.default_language') }}" dir="{{ config('nova.default_direction') }}" data-theme="{{ config('nova.default_theme') }}">
<head>
  @include('partials.head')
  <title>@yield('title', 'Admin panel')</title>
</head>
<body class="app-body" data-page="@yield('page')" data-section="@yield('section')">
  @include('partials.sidebar')
  <div class="app-main">
    @include('partials.header')
    <div class="app-content">
      <div class="container-fluid">
        <main id="main-content" class="page-body">
          @yield('content')
        </main>
      </div>
    </div>
    @include('partials.footer')
  </div>
  @include('partials.overlays')
  @include('partials.scripts')
</body>
</html>
```

And each page:

```blade
{{-- resources/views/dashboards/analytics.blade.php --}}
@extends('layouts.app')

@section('page', 'dashboards/analytics.html')
@section('title', 'Analytics dashboard')

@section('content')
  <div class="dashboard-shell" data-dashboard="analytics" data-range="30d">…</div>
@endsection
```

## Step 3 — routes

```php
// routes/web.php
use App\Http\Controllers\DashboardController;

Route::middleware('auth')->group(function () {
    Route::get('/', [DashboardController::class, 'analytics'])->name('dashboard');
    Route::get('/orders', [DashboardController::class, 'orders'])->name('orders');
    Route::get('/api/orders', [Api\OrderController::class, 'index']);
});
```

Links inside the template are relative (`../users/list.html`), so after converting to Blade replace them with `route()` or `url()`:

```blade
<a class="landing-demo" href="{{ route('orders') }}">…</a>
```

## Step 4 — API

The front-end services expect the same REST contract:

```php
// routes/api.php
Route::apiResource('orders', Api\OrderController::class);
```

Then set `api.useMocks` to `false` in `src/config/config.js` and `api.baseUrl` to `/api`. If Laravel returns responses in a custom envelope, convert it to the standard shape right there in the controller:

```php
return response()->json([
    'items' => $orders->items(),
    'total' => $orders->total(),
    'page' => $orders->currentPage(),
    'perPage' => $orders->perPage(),
    'pages' => $orders->lastPage(),
    'hasNext' => $orders->hasMorePages(),
    'hasPrev' => $orders->currentPage() > 1,
]);
```

## Step 5 — assets with Laravel Vite

If you want Laravel's Vite to build the bundle, replace the template's `vite.config.js` with the Laravel settings and import `src/main.js` in `resources/js/app.js`. Import the SCSS in the same entry so it ends up in the Laravel bundle.

## Notes

| Topic | Suggestion |
| --- | --- |
| Language | Handle `app()->getLocale()` and the fa/en/ar dictionary choice in a middleware |
| Calendar | Convert dates on the server or with the same `jalali.js` on the front end |
| Permissions | Check roles with Gate/Policy and make menu items conditional |
| Validation | Take localized messages from `resources/lang/<locale>/validation.php` |

> Tip: the template does not need Blade; if you want to ship quickly, the static `dist/` output in `public/` is enough.

> Warning: this template's naming and structure are deliberately framework-agnostic. If your server side is PHP, keep the front-end services untouched and only align `client.js` with your API.
