// shared handler for the "register your interest" forms
(function () {
  var form = document.querySelector('form[data-interest]');
  if (!form) return;
  var msg = form.querySelector('.form-msg');
  var btn = form.querySelector('button[type=submit]');

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
      msg.style.color = '#b3261e';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'جارٍ الإرسال…';

    fetch('/api/interest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
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
      msg.innerHTML = 'تعذّر الإرسال — التسجيل لم يُفعَّل بعد على الخادم. حاول لاحقاً.';
      msg.style.color = '#b3261e';
    });
  });
})();
