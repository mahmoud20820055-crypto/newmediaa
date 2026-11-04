# New Media – newmediaa.com

ملفات موقع **نيو ميديا** (WordPress + قالب Woodmart + Elementor) وأدوات التعديل عليه.

> ⚠️ هذا الريبو **خاص (Private)**. لا يحتوي على قاعدة البيانات ولا كلمات السر ولا النسخ الاحتياطية، ولا يجوز إضافتها.

## المحتوى

| المجلد | ماذا فيه |
|---|---|
| `css/newmedia-midnight-ai.css` | ثيم **Midnight AI** (أسود ليلي + سماوي + بنفسجي، خلفية متحركة). يُلصق في: المظهر ← تخصيص ← CSS إضافي |
| `css/newmedia-dark-3d.css` | النسخة الأولى (أسود + سماوي) |
| `plugins/newmedia-site-fixes/` | إضافة تطبّق تصحيحات المحتوى مرة واحدة عند التفعيل (إملاء، هيدر أسود، سياسة الخصوصية، المدونة). **لم تُركّب على الموقع** بناءً على طلب صاحب الموقع بعدم تغيير المحتوى |
| `themes/woodmart-child/` | القالب الفرعي كما هو على الموقع |
| `scripts/wp.py` | أداة تعديل الموقع عبر REST API (مع نسخة احتياطية تلقائية قبل كل تعديل) |
| `scripts/*.js` | أدوات معاينة وفحص (Playwright): معاينة CSS على الموقع الحي بدون تغييره، وفحص التباين والأخطاء |
| `docs/site-notes.md` | معلومات الموقع والمشاكل المعروفة |
| `screenshots/` | صور المعاينة |

## التعديل على الموقع

```bash
export WP_USER='...'          # اسم المستخدم
export WP_APP_PASSWORD='...'   # من متغيرات البيئة فقط، لا تضعها في الملفات
python3 scripts/wp.py whoami
python3 scripts/wp.py replace pages 92 "أراء عملائنا" "آراء عملائنا"          # تجربة
python3 scripts/wp.py replace pages 92 "أراء عملائنا" "آراء عملائنا" --apply  # تطبيق
```

## معاينة CSS قبل تطبيقه

```bash
node scripts/preview.js css/newmedia-midnight-ai.css /tmp/out
node scripts/qa.js css/newmedia-midnight-ai.css /tmp/out
```
