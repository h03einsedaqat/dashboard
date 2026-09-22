# تبدیل به Laravel

اگر پروژه شما Laravel است، می‌توانید همین قالب را در چند گام به Blade تبدیل کنید. هیچ‌کدام از این مراحل اجباری نیست؛ قالب به‌صورت استاتیک هم کامل کار می‌کند.

## گام ۱ — ساخت خروجی

```bash
npm run build
```

محتوای `dist/` را در `public/` پروژه Laravel کپی کنید:

```bash
cp -r dist/* /path/to/laravel/public/
```

از این لحظه سایت روی `https://example.com/` کار می‌کند و همه CSS/JS/فونت‌ها نسبی هستند.

## گام ۲ — تبدیل صفحات به Blade (اختیاری)

صفحات تولیدشده در `src/pages/**` و قطعه‌های مشترک در `src/partials/**` قرار دارند. یک‌بار قطعه‌ها را به layout تبدیل کنید:

```blade
{{-- resources/views/layouts/app.blade.php --}}
<!doctype html>
<html lang="{{ config('nova.default_language') }}" dir="{{ config('nova.default_direction') }}" data-theme="{{ config('nova.default_theme') }}">
<head>
  @include('partials.head')
  <title>@yield('title', 'پنل مدیریت')</title>
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

و هر صفحه:

```blade
{{-- resources/views/dashboards/analytics.blade.php --}}
@extends('layouts.app')

@section('page', 'dashboards/analytics.html')
@section('title', 'داشبورد آنالیتیکس')

@section('content')
  <div class="dashboard-shell" data-dashboard="analytics" data-range="30d">…</div>
@endsection
```

## گام ۳ — مسیرها

```php
// routes/web.php
use App\Http\Controllers\DashboardController;

Route::middleware('auth')->group(function () {
    Route::get('/', [DashboardController::class, 'analytics'])->name('dashboard');
    Route::get('/orders', [DashboardController::class, 'orders'])->name('orders');
    Route::get('/api/orders', [Api\OrderController::class, 'index']);
});
```

لینک‌های داخل قالب نسبی هستند (`../users/list.html`)، پس پس از تبدیل به Blade آن‌ها را با `route()` یا `url()` جایگزین کنید:

```blade
<a class="landing-demo" href="{{ route('orders') }}">…</a>
```

## گام ۴ — API

سرویس‌های فرانت‌اند همان قرارداد REST را انتظار دارند:

```php
// routes/api.php
Route::apiResource('orders', Api\OrderController::class);
```

سپس در `src/config/config.js` مقدار `api.useMocks` را `false` بگذارید و `api.baseUrl` را روی `/api` تنظیم کنید. اگر پاسخ Laravel را در پاکت دلخواه می‌فرستید، همان‌جا در کنترلر آن را به شکل استاندارد برگردانید:

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

## گام ۵ — دارایی‌ها با Vite لاراول

اگر می‌خواهید Vite لاراول باندل را بسازد، `vite.config.js` قالب را با تنظیمات Laravel جایگزین کنید و در `resources/js/app.js` فایل `src/main.js` را import کنید. SCSS را هم در همان ورودی import کنید تا در باندل Laravel بیاید.

## نکات

| موضوع | پیشنهاد |
| --- | --- |
| زبان | `app()->getLocale()` و انتخاب دیکشنری fa/en/ar را از یک میدل‌ور مدیریت کنید |
| تقویم | تبدیل تاریخ در سمت سرور یا با همان `jalali.js` در فرانت |
| مجوزها | نقش‌ها را با Gate/Policy بررسی کنید و آیتم‌های منو را شرطی کنید |
| اعتبارسنجی | پیام‌های فارسی را از `resources/lang/fa/validation.php` بگیرید |

> نکته: قالب Blade لازم ندارد؛ اگر می‌خواهید سریع منتشر کنید، همان خروجی استاتیک `dist/` در `public/` کافی است.

> هشدار: نام‌گذاری و ساختار این قالب عمداً فریم‌ورک‌محور نیست. اگر سمت سرور شما PHP است، سرویس‌های فرانت را دست‌نخورده نگه دارید و فقط `client.js` را با API خودتان هماهنگ کنید.
