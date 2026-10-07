/* dr-albar.com — shared behaviour (no dependencies) */
(function () {
  'use strict';

  /* ---- current year ---- */
  var yrs = document.querySelectorAll('#yr, .yr');
  for (var i = 0; i < yrs.length; i++) yrs[i].textContent = new Date().getFullYear();

  /* ---- sticky header shadow ---- */
  var hdr = document.querySelector('header.site');
  if (hdr) {
    var onScroll = function () {
      hdr.classList.toggle('scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---- mobile nav ---- */
  var burger = document.querySelector('.burger');
  var links  = document.querySelector('.nav-links');
  if (burger && links) {
    burger.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        links.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---- WhatsApp links: add a pre-filled message ----
     HTML keeps a bare wa.me href so it still works without JS. */
  var WA_NUM = '966582701349';
  var WA_TEXT = {
    appointment: 'السلام عليكم، أرغب بحجز موعد في عيادة د. محمد البار.\nالاسم:\nالمدينة:\nسبب الزيارة بإيجاز:',
    ask: 'السلام عليكم، لدي استفسار عن مواعيد عيادة د. محمد البار.\nالاسم:',
    course: 'السلام عليكم، أرغب بالاستفسار عن دورات ORL101 / FESS101.\nالاسم:\nالصفة (طالب / مقيم / استشاري):'
  };
  var waLinks = document.querySelectorAll('a[data-wa]');
  for (var w = 0; w < waLinks.length; w++) {
    var kind = waLinks[w].getAttribute('data-wa') || 'appointment';
    var body = WA_TEXT[kind] || WA_TEXT.appointment;
    waLinks[w].href = 'https://wa.me/' + WA_NUM + '?text=' + encodeURIComponent(body);
  }

  /* ---- scroll reveal ---- */
  var targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;

  if (!('IntersectionObserver' in window)) {
    for (var k = 0; k < targets.length; k++) targets[k].classList.add('in');
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      var d = parseInt(el.getAttribute('data-reveal'), 10);
      el.style.transitionDelay = (isNaN(d) ? 0 : d) + 'ms';
      el.classList.add('in');
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  for (var j = 0; j < targets.length; j++) io.observe(targets[j]);
})();
