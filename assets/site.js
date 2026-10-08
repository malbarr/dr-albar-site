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
