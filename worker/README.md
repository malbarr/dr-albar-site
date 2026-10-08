# نموذج التواصل المغلق — خطوات التشغيل

الهدف: الزائر يكتب رسالة في `/contact/` فتصل إلى الدكتور، **بلا أن يرى الزائر أي رقم**.

```
الزائر → dr-albar.com/api/contact → Cloudflare Worker → مخزن KV
                                              ↓ (اختياري) إشعار تيليجرام فوري
                            سكربت pull_contact.js عند الدكتور → واتساب
```

الواجهة (الصفحة والنموذج) **منشورة وجاهزة**. الناقص هو تشغيل الـWorker.

---

## 1. التنصيب

```bash
cd dr-albar-site/worker
npm i -g wrangler
wrangler login                      # يفتح المتصفح على حساب Cloudflare
wrangler kv namespace create CONTACT
# انسخ الـ id الناتج إلى wrangler.toml
```

## 2. الأسرار

```bash
wrangler secret put PULL_KEY        # أي نص عشوائي طويل — يحمي نقطة السحب
wrangler secret put TG_TOKEN        # اختياري: توكن بوت تيليجرام للإشعار الفوري
wrangler secret put TG_CHAT         # اختياري: 1276595563  (أو chat:thread)
```

## 3. النشر

```bash
wrangler deploy
```

المسار `dr-albar.com/api/contact*` معرَّف في `wrangler.toml`، فلا حاجة لإعداد يدوي.

## 4. التحقق

```bash
curl -s https://dr-albar.com/api/contact -H 'content-type: application/json' \
  -d '{"name":"اختبار","reply":"test@example.com","topic":"موضوع آخر","message":"رسالة تجريبية للتأكد من عمل النموذج","ack":true}'
# المتوقع: {"ok":true}
```

## 5. التسليم على واتساب

`scripts/pull_contact.js` يسحب الرسائل الجديدة ويرسلها إلى واتساب الدكتور،
ويُجدوَل كل ٥ دقائق. يحتاج متغيّرين:

```
CONTACT_PULL_URL=https://dr-albar.com/api/contact/pull
CONTACT_PULL_KEY=<نفس PULL_KEY>
```

الرسائل تبقى في KV ٣٠ يوماً، فلا تُفقد لو تعطّل السحب مؤقتاً.

---

## ملاحظات

- حدّ الإرسال: ٥ رسائل لكل عنوان IP في الساعة.
- حقل `website` في النموذج مصيدة للبريد المزعج — إذا امتلأ يُهمَل الطلب بصمت.
- لا يوجد أي طرف ثالث في المسار: لا Formspree ولا تحليلات.
- لا يَظهر رقم ولا عنوان في أي كود يُنزَّل إلى متصفح الزائر — تحقّق:
  `grep -r "966" assets/ contact/` يجب أن يعود فارغاً.

---

## حالة التشغيل — مُنشور وحيّ (2026-10-08 18:45)

| العنصر | القيمة |
| --- | --- |
| Worker | `dr-albar-contact` |
| المسار | `dr-albar.com/api/contact*` |
| KV namespace | `CONTACT` → `5aee80d5269745de83a56acc650913fe` |
| النطاق (zone) | `dr-albar.com` → `8b2d583fd3ca993640729ee21f1c1aba` |
| التسليم الحالي | إشعار تيليجرام فوري إلى خاص د. محمد (`1276595563`) |
| مفتاح السحب | محفوظ خارج المستودع: `state/contact_pull_key.txt` |

نُشر عبر Cloudflare API من جلسة المتصفح المسجّلة (لا توكن جديد أُنشئ).
اختبار حيّ: `POST /api/contact` أعاد `{"ok":true}` ووصل الإشعار.

### المتبقّي: التسليم على واتساب
لا توجد اليوم قناة واتساب فعّالة على هذه البوابة (`channels` = telegram, discord فقط).
لإضافتها لاحقاً أحد مسارين: ربط واتساب على الراسبيري، أو واجهة واتساب للأعمال (مدفوعة).
الرسائل محفوظة في KV ٣٠ يوماً، فأي مسار يُضاف لاحقاً يسحبها بلا فقدان.
