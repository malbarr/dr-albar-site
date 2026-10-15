// shared handler for the "register your interest" forms
(function () {
  var form = document.querySelector('form[data-interest]');
  if (!form) return;
  var msg = form.querySelector('.form-msg');
  var btn = form.querySelector('button[type=submit]');
  var ERR = '#c0455c';

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    msg.textContent = '';
    msg.style.color = '';

    var data = {
      course: form.dataset.interest,
      name: form.name_.value.trim(),
      email: form.email.value.trim(),
      role: form.role.value
    };

    if (!data.name || !data.email) {
      msg.textContent = 'الرجاء تعبئة الاسم والبريد.';
      msg.style.color = ERR;
      return;
    }

    btn.disabled = true;
    btn.textContent = 'جارٍ الإرسال…';

    /* /api/interest was never deployed; the contact relay is live, so the
       registration rides on it as a normal, clearly-labelled message. */
    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        reply: data.email,
        topic: 'تسجيل اهتمام — ' + data.course,
        message: 'تسجيل اهتمام بدورة ' + data.course + '. الصفة: ' + data.role +
                 '. يرغب بإشعار عند فتح التسجيل في الدورة.',
        page: location.pathname,
        ack: true
      })
    }).then(function (r) {
      if (r.ok) {
        form.innerHTML = '<p style="margin:0"><strong>تم التسجيل.</strong> سنراسلك على ' +
          data.email.replace(/[<>&]/g, '') + ' عند فتح التسجيل في الدورة.</p>';
        return;
      }
      throw new Error('http ' + r.status);
    }).catch(function () {
      btn.disabled = false;
      btn.textContent = 'سجّل اهتمامي';
      msg.textContent = 'تعذّر الإرسال الآن. أعد المحاولة بعد قليل، أو استخدم نموذج التواصل في الموقع.';
      msg.style.color = ERR;
    });
  });
})();
