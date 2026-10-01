# التحويل إلى Laravel

إذا كان مشروعك مبنياً على Laravel، فيمكنك تحويل هذا القالب إلى Blade في بضع خطوات. لا شيء من هذه الخطوات إلزامي؛ فالقالب يعمل بالكامل كموقع ثابت أيضاً.

## الخطوة ١ — بناء المخرجات

```bash
npm run build
```

انسخ محتوى `dist/` إلى `public/` في مشروع Laravel:

```bash
cp -r dist/* /path/to/laravel/public/
```

من هذه اللحظة يعمل الموقع على `https://example.com/` وجميع ملفات CSS/JS/الخطوط نسبية.

## الخطوة ٢ — تحويل الصفحات إلى Blade (اختياري)

توجد الصفحات المولّدة في `src/pages/**` والأجزاء المشتركة في `src/partials/**`. حوّل الأجزاء إلى تخطيط مرة واحدة:

```blade
{{-- resources/views/layouts/app.blade.php --}}
<!doctype html>
<html lang="{{ config('nova.default_language') }}" dir="{{ config('nova.default_direction') }}" data-theme="{{ config('nova.default_theme') }}">
<head>
  @include('partials.head')
  <title>@yield('title', 'لوحة الإدارة')</title>
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

وكل صفحة:

```blade
{{-- resources/views/dashboards/analytics.blade.php --}}
@extends('layouts.app')

@section('page', 'dashboards/analytics.html')
@section('title', 'لوحة التحليلات')

@section('content')
  <div class="dashboard-shell" data-dashboard="analytics" data-range="30d">…</div>
@endsection
```

## الخطوة ٣ — المسارات

```php
// routes/web.php
use App\Http\Controllers\DashboardController;

Route::middleware('auth')->group(function () {
    Route::get('/', [DashboardController::class, 'analytics'])->name('dashboard');
    Route::get('/orders', [DashboardController::class, 'orders'])->name('orders');
    Route::get('/api/orders', [Api\OrderController::class, 'index']);
});
```

الروابط داخل القالب نسبية (`../users/list.html`)؛ لذا استبدلها بعد التحويل إلى Blade بـ `route()` أو `url()`:

```blade
<a class="landing-demo" href="{{ route('orders') }}">…</a>
```

## الخطوة ٤ — API

تتوقع خدمات الواجهة الأمامية عقد REST نفسه:

```php
// routes/api.php
Route::apiResource('orders', Api\OrderController::class);
```

ثم اضبط `api.useMocks` على `false` في `src/config/config.js` و`api.baseUrl` على `/api`. إذا كان Laravel يرسل الاستجابة في غلاف مخصص، فأعدها إلى الشكل القياسي في المتحكم نفسه:

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

## الخطوة ٥ — الأصول مع Vite الخاص بـ Laravel

إذا أردت أن يبني Vite الخاص بـ Laravel الحزمة، فاستبدل `vite.config.js` الخاص بالقالب بإعدادات Laravel واستورد `src/main.js` في `resources/js/app.js`. واستورد SCSS في نقطة الدخول نفسها ليدخل في حزمة Laravel.

## ملاحظات

| الموضوع | الاقتراح |
| --- | --- |
| اللغة | أدِر `app()->getLocale()` واختيار قاموس fa/en/ar من وسيط (middleware) |
| التقويم | تحويل التاريخ من جهة الخادم أو بـ `jalali.js` نفسه في الواجهة الأمامية |
| الصلاحيات | تحقّق من الأدوار بـ Gate/Policy واجعل عناصر القائمة شرطية |
| التحقق | خذ الرسائل المحلية من `resources/lang/<اللغة>/validation.php` |

> ملاحظة: لا يحتاج القالب إلى Blade؛ إذا أردت النشر بسرعة، فالمخرجات الثابتة `dist/` داخل `public/` تكفي.

> تحذير: تسمية هذا القالب وبنيته مستقلتان عن أي إطار عمل عمداً. إذا كانت جهة الخادم لديك PHP، فأبقِ خدمات الواجهة الأمامية كما هي ووائم `client.js` فقط مع واجهتك البرمجية.
