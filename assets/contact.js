/* blind contact form -> POST /api/contact
   the visitor never sees a phone number; the endpoint relays the message
   to the site owner. no third-party script, no tracking. */
(function () {
  var form = document.getElementById('cform');
  if (!form) return;

  var msg = form.querySelector('.form-msg');
  var btn = form.querySelector('button[type=submit]');
  var ERR = '#b3261e';

  function fail(text) {
    msg.textContent = text;
    msg.style.color = ERR;
    btn.disabled = false;
    btn.textContent = 'أرسل الرسالة';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    msg.textContent = '';
    msg.style.color = '';

    var data = {
      name: form.name_.value.trim(),
      reply: form.reply.value.trim(),
      topic: form.topic.value,
      message: form.message.value.trim(),
      ack: form.ack.checked,
      website: form.website.value,            // honeypot, must stay empty
      page: location.pathname
    };

    if (!data.name || data.name.length < 2) return fail('اكتب اسمك.');
    if (!data.reply) return fail('اكتب بريداً إلكترونياً أو رقم جوال للرد عليك.');

    var isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.reply);
    var isPhone = /^[+00]?[\d٠-٩\s-]{8,}$/.test(data.reply);
    if (!isEmail && !isPhone) return fail('وسيلة الرد غير واضحة — اكتب بريداً صحيحاً أو رقم جوال.');

    if (data.message.length < 15) return fail('الرسالة قصيرة جداً — اشرح طلبك في سطرين على الأقل.');
    if (data.message.length > 4000) return fail('الرسالة طويلة جداً. اختصرها إلى ٤٠٠٠ حرف.');
    if (!data.ack) return fail('الرجاء الموافقة على التنبيه قبل الإرسال.');

    btn.disabled = true;
    btn.textContent = 'جارٍ الإرسال…';

    var done = false;
    var timer = setTimeout(function () {
      if (!done) { done = true; fail('تعذّر الإرسال — الشبكة بطيئة. أعد المحاولة.'); }
    }, 15000);

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      clearTimeout(timer);
      if (done) return;
      done = true;
      form.innerHTML = '<h3 style="margin:0 0 10px">تم إرسال رسالتك.</h3>' +
        '<p class="ok" style="margin:0">وصلت الرسالة. إن كان الرد ممكناً فسيأتيك على ' +
        '<strong>' + data.reply.replace(/[<>&"]/g, '') + '</strong>.</p>';
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }).catch(function () {
      clearTimeout(timer);
      if (done) return;
      done = true;
      msg.innerHTML = 'نموذج الإرسال قيد التفعيل النهائي وسيعمل خلال ساعات قليلة. نعتذر عن التأخير.';
      msg.style.color = ERR;
      btn.disabled = false;
      btn.textContent = 'أرسل الرسالة';
    });
  });

})();
