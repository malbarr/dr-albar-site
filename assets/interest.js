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
      // the server endpoint is not live yet — fall back to WhatsApp
      btn.disabled = false;
      btn.textContent = 'سجّل اهتمامي';

      var lines = [
        'السلام عليكم، أرغب بتسجيل اهتمامي بدورة ' + data.course + '.',
        'الاسم: ' + data.name,
        'البريد: ' + data.email,
        'الصفة: ' + data.role
      ];
      var url = 'https://wa.me/966582701349?text=' + encodeURIComponent(lines.join('\n'));

      var a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.innerHTML = '<b>سجّل اهتمامك عبر واتساب</b>';

      msg.textContent = 'التسجيل الإلكتروني لم يُفعَّل بعد — ';
      msg.appendChild(a);
      msg.appendChild(document.createTextNode(' وسيصلك إشعار عند فتح التسجيل.'));
      msg.style.color = ERR;
    });
  });
})();
