/* ORL Daily read-only mirror. Scientific content stays in malbarr/orl-daily.
   No credentials, build step, copied editions, or third-party service required. */
(function () {
  'use strict';
  var app = document.getElementById('daily-app');
  var preview = document.getElementById('daily-preview');
  if (!app && !preview) return;
  var bases = [
    'https://raw.githubusercontent.com/malbarr/orl-daily/main/data/',
    'https://malbarr.github.io/orl-daily/data/'
  ];
  var dates = [], selected = '', issue = null, serial = 0, refreshing = false;
  var language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'ar';
  var lastChecked = 0;
  var memo = new Map();
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function text(value) { return typeof value === 'string' ? value.trim() : ''; }
  function field(article, name) {
    return text(article[name + '_' + language]) || text(article[name + '_ar']) || text(article[name + '_en']) || text(article[name]);
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var time = new Date(value + 'T12:00:00Z');
    return !isNaN(time.getTime()) && time.toISOString().slice(0, 10) === value;
  }
  function validIndex(value) {
    return value && Array.isArray(value.dates) && value.dates.every(validDate);
  }
  function validIssue(value, date) {
    return value && value.date === date && Array.isArray(value.articles) &&
      value.articles.every(function (a) { return a && typeof a === 'object' && !Array.isArray(a); });
  }
  async function readJSON(path, validate) {
    var lastError;
    for (var base of bases) {
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 10000);
      try {
        // A minute cache key avoids a stale CDN index; no-store avoids browser caching.
        var response = await fetch(base + path + '?v=' + Math.floor(Date.now() / 60000), {
          cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        var value = await response.json();
        if (!validate(value)) throw new Error('Invalid ORL Daily schema: ' + path);
        return value;
      } catch (error) { lastError = error; }
      finally { clearTimeout(timeout); }
    }
    throw lastError || new Error('Source unavailable');
  }
  function status(message, error) {
    if (!app) return;
    $('daily-status').textContent = message;
    $('daily-status').classList.toggle('daily-error', !!error);
    $('daily-retry').hidden = !error;
  }
  function editionURL(date, hash) {
    var url = new URL('/orl-daily/', location.origin);
    url.searchParams.set('date', date);
    if (language === 'en') url.searchParams.set('lang', 'en');
    if (hash) url.hash = hash;
    return url.pathname + url.search + url.hash;
  }
  function paperID(article, index) {
    return 'paper-' + (/^\d+$/.test(String(article.pmid || '')) ? article.pmid : index + 1);
  }
  function dateNode(date) {
    var node = el('time', '', date);
    node.dateTime = date; node.dir = 'ltr';
    return node;
  }
  function articleLink(url, label, className) {
    var node = el('a', className || 'btn ghost sm', label);
    node.href = url; node.target = '_blank'; node.rel = 'noopener noreferrer';
    return node;
  }
  function pubmedURL(article) {
    var pmid = String(article.pmid || '').trim();
    if (/^\d{1,12}$/.test(pmid)) return 'https://pubmed.ncbi.nlm.nih.gov/' + pmid + '/';
    try {
      var url = new URL(article.pubmed_url);
      if (url.protocol === 'https:' && url.hostname === 'pubmed.ncbi.nlm.nih.gov' && /^\/\d+\/?$/.test(url.pathname)) return url.origin + url.pathname;
    } catch (_) { /* Untrusted or absent URLs are not rendered. */ }
    return '';
  }
  function renderCard(article, index) {
    var card = el('article', 'card daily-paper');
    card.id = paperID(article, index);
    var meta = el('div', 'daily-meta');
    meta.append(el('span', 'tag', text(article.journal) || 'بحث علمي'));
    if (text(article.pub_date)) meta.append(el('span', '', 'تاريخ نشر البحث: ' + article.pub_date));
    card.append(meta);
    var heading = el('h3', '', field(article, 'title') || 'عنوان غير متاح في المصدر');
    heading.dir = 'auto'; card.append(heading);
    if (text(article.study_design)) {
      var design = el('p', 'daily-design', article.study_design); design.dir = 'auto'; card.append(design);
    }
    if (article.reject === true) card.append(el('p', 'note', 'مصنّف مستبعدًا في المصدر. ' + (text(article.reject_reason) || 'راجع تقييم المصدر.')));
    var summary = el('p', 'daily-summary', field(article, 'summary') || 'لا يتوفر ملخص في ملف هذا الإصدار.');
    summary.dir = 'auto'; summary.lang = text(article['summary_' + language]) ? language : (text(article.summary_ar) ? 'ar' : 'en');
    card.append(summary);
    var more = el('details', 'daily-analysis');
    more.append(el('summary', '', language === 'en' ? 'Scientific analysis' : 'التحليل العلمي'));
    var fields = [
      ['why_important', 'لماذا يهم؟', 'Why it matters'],
      ['practice_change', 'الأثر على الممارسة', 'Implications for practice'],
      ['vs_previous', 'مقارنة بالأدلة السابقة', 'Compared with prior evidence'],
      ['future_impact', 'الأثر المستقبلي', 'Future impact'],
      ['research_gap', 'الفجوة البحثية', 'Research gap'],
      ['stars_reason', 'تعليل تقييم المصدر', 'Source rating rationale'],
      ['jc_reason', 'نادي المجلة', 'Journal club'],
      ['watch_detail', 'ما يستحق المتابعة', 'Watch points']
    ];
    var count = 0;
    fields.forEach(function (entry) {
      var value = field(article, entry[0]);
      if (!value) return;
      var block = el('div', 'daily-detail'); block.dir = language === 'en' ? 'ltr' : 'rtl';
      block.append(el('h4', '', entry[language === 'en' ? 2 : 1]));
      var paragraph = el('p', '', value); paragraph.dir = 'auto'; block.append(paragraph);
      more.append(block); count++;
    });
    if (count) card.append(more);
    var links = el('div', 'daily-links');
    var pubmed = pubmedURL(article);
    if (pubmed) links.append(articleLink(pubmed, 'PubMed · البحث الأصلي'));
    var doi = text(article.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
    if (/^10\.\d{4,9}\/\S+$/.test(doi)) links.append(articleLink('https://doi.org/' + encodeURIComponent(doi), 'DOI · الناشر'));
    if (!links.childElementCount) links.append(el('span', 'muted', 'لا يتوفر رابط بحث موثوق في هذا الإصدار.'));
    card.append(links);
    return card;
  }
  function renderArticles() {
    if (!issue) return;
    var query = $('daily-search').value.trim().toLocaleLowerCase();
    var fragment = document.createDocumentFragment();
    var count = 0;
    issue.articles.forEach(function (article, index) {
      var haystack = ['title_ar', 'title_en', 'summary_ar', 'summary_en', 'journal', 'pmid'].map(function (k) { return String(article[k] || ''); }).join(' ').toLocaleLowerCase();
      if (query && !haystack.includes(query)) return;
      fragment.append(renderCard(article, index)); count++;
    });
    $('daily-articles').replaceChildren(fragment);
    $('daily-no-results').hidden = count > 0;
    $('daily-no-results').textContent = issue.articles.length ? 'لا توجد نتائج مطابقة داخل هذا الإصدار.' : 'هذا الإصدار موجود في الأرشيف، لكنه لا يتضمن دراسات.';
    $('daily-count').textContent = count + ' / ' + issue.articles.length + ' دراسة';
    app.querySelectorAll('[data-daily-lang]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.dailyLang === language));
    });
  }
  function syncSelection() {
    $('daily-date').value = selected;
    app.querySelectorAll('[data-daily-date]').forEach(function (link) {
      if (link.dataset.dailyDate === selected) link.setAttribute('aria-current', 'date');
      else link.removeAttribute('aria-current');
      link.href = editionURL(link.dataset.dailyDate);
    });
  }
  function renderArchive() {
    var select = $('daily-date'); select.replaceChildren();
    dates.forEach(function (date) {
      var option = el('option', '', date + (date === dates[0] ? ' — الأحدث' : ''));
      option.value = date; select.append(option);
    });
    var groups = new Map();
    dates.forEach(function (date) {
      var month = date.slice(0, 7);
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month).push(date);
    });
    var archive = $('daily-archive'); archive.replaceChildren();
    groups.forEach(function (items, month) {
      var group = el('section', 'daily-month');
      var heading = el('h3', '', month + ' · ' + items.length + ' إصدار'); heading.dir = 'auto';
      group.append(heading);
      var nav = el('nav', 'daily-dates'); nav.setAttribute('aria-label', 'إصدارات ' + month);
      items.forEach(function (date) {
        var link = el('a', 'daily-date-link'); link.href = editionURL(date); link.dataset.dailyDate = date;
        link.append(dateNode(date));
        link.addEventListener('click', function (event) {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button) return;
          event.preventDefault(); selectIssue(date, true);
        });
        nav.append(link);
      });
      group.append(nav); archive.append(group);
    });
    $('daily-archive-count').textContent = 'الأرشيف الكامل · ' + dates.length + ' إصدار';
    $('daily-latest').replaceChildren(el('span', '', 'أحدث إصدار: '), dates[0] ? dateNode(dates[0]) : el('span', '', 'لا يوجد'));
    syncSelection();
  }
  async function selectIssue(date, push, force) {
    var run = ++serial;
    if (!dates.includes(date)) {
      selected = ''; issue = null; $('daily-reader').hidden = true;
      status('التاريخ المطلوب غير موجود في فهرس المصدر. اختر إصدارًا من الأرشيف.', true); return;
    }
    var same = selected === date;
    selected = date; syncSelection();
    if (!same) { issue = null; $('daily-reader').hidden = true; $('daily-search').value = ''; }
    if (push) history.pushState({}, '', editionURL(date));
    status('جارٍ تحميل إصدار ' + date + ' من المصدر…');
    $('daily-reader').setAttribute('aria-busy', 'true');
    try {
      var data = !force && memo.has(date) ? memo.get(date) : await readJSON(date + '.json', function (value) { return validIssue(value, date); });
      if (run !== serial) return;
      var unchanged = issue && JSON.stringify(issue) === JSON.stringify(data);
      memo.set(date, data); issue = data;
      $('daily-issue-heading').replaceChildren(el('span', '', 'إصدار '), dateNode(date));
      var generated = new Date(data.generated_at);
      $('daily-generated').textContent = isNaN(generated.getTime()) ? '' : 'تحديث ملف المصدر: ' + generated.toLocaleString('ar-SA-u-ca-gregory', {timeZone: 'Asia/Riyadh'}) + ' · الرياض';
      $('daily-reader').hidden = false;
      if (!unchanged) renderArticles();
      status('متصل بالمصدر · ' + dates.length + ' إصدار في الأرشيف · لا يحتاج إلى نقل يدوي');
      if (location.hash && !same) {
        var target = document.getElementById(location.hash.slice(1));
        if (target && $('daily-articles').contains(target)) target.scrollIntoView({block: 'start'});
      }
    } catch (_) {
      if (run !== serial) return;
      status(issue ? 'تعذّر التحديث الآن؛ المعروض آخر نسخة حُمّلت في هذه الجلسة. حاول مجددًا.' : 'تعذّر تحميل هذا الإصدار من المصدر الآن. لم يُحذف من الأرشيف؛ حاول مجددًا.', true);
    } finally { if (run === serial) $('daily-reader').setAttribute('aria-busy', 'false'); }
  }
  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      var index = await readJSON('index.json', validIndex);
      dates = Array.from(new Set(index.dates)).sort().reverse();
      lastChecked = Date.now();
      if (app) {
        renderArchive();
        if (!dates.length) { status('فهرس المصدر متاح، لكنه لا يحتوي على إصدارات.', true); return; }
        var wanted = new URLSearchParams(location.search).get('date') || dates[0];
        await selectIssue(wanted, false, true);
      } else {
        if (!dates.length) throw new Error('Empty index');
        var data = await readJSON(dates[0] + '.json', function (value) { return validIssue(value, dates[0]); });
        var fragment = document.createDocumentFragment();
        data.articles.slice(0, 3).forEach(function (article, index) {
          var item = el('a', 'feed-item daily-preview-item'); item.href = editionURL(data.date, paperID(article, index));
          item.append(el('span', 'meta', text(article.journal)), el('h4', '', field(article, 'title')));
          var summary = field(article, 'summary');
          item.append(el('p', '', summary.length > 210 ? summary.slice(0, 210) + '…' : summary));
          item.dir = 'auto'; fragment.append(item);
        });
        if (!data.articles.length) fragment.append(el('p', 'muted', 'لا يتضمن هذا الإصدار دراسات. الأرشيف الكامل متاح في صفحة القسم.'));
        preview.replaceChildren(fragment);
        $('daily-preview-date').replaceChildren(el('span', '', 'أحدث إصدار · '), dateNode(data.date));
        $('daily-preview-note').textContent = 'محتوى فعلي من ORL Daily · اقرأ الملخصات الكاملة والأرشيف داخل الموقع.';
      }
    } catch (_) {
      if (app) status(dates.length ? 'تعذّر تحديث الفهرس؛ المعروض آخر محتوى حُمّل في هذه الجلسة. حاول مجددًا.' : 'تعذّر الاتصال بفهرس الأبحاث الآن. هذه مشكلة تحميل وليست غيابًا للأرشيف.', true);
      else {
        if (!preview.querySelector('a')) preview.replaceChildren(el('p', 'muted', 'تعذّر تحميل معاينة الأبحاث الآن. افتح صفحة القسم لإعادة المحاولة.'));
        $('daily-preview-note').textContent = 'تعذّر التحديث الآن. افتح الأرشيف لإعادة المحاولة.';
      }
    } finally { refreshing = false; }
  }
  if (app) {
    $('daily-date').addEventListener('change', function () { selectIssue(this.value, true); });
    $('daily-latest').addEventListener('click', function () { history.pushState({}, '', '/orl-daily/' + (language === 'en' ? '?lang=en' : '')); refresh(); });
    $('daily-retry').addEventListener('click', refresh);
    $('daily-search').addEventListener('input', renderArticles);
    app.querySelectorAll('[data-daily-lang]').forEach(function (button) {
      button.addEventListener('click', function () {
        language = button.dataset.dailyLang;
        var url = new URL(location.href); url.searchParams.set('lang', language);
        history.replaceState({}, '', url.pathname + url.search + url.hash);
        syncSelection(); renderArticles();
      });
    });
    window.addEventListener('popstate', function () {
      language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'ar';
      issue = null;
      selectIssue(new URLSearchParams(location.search).get('date') || dates[0], false);
    });
  }
  // Passive refresh: returning visitors and an open visible page see future editions.
  // No scheduled job, new site commit, paid plan, or secret is needed per edition.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && Date.now() - lastChecked > 60000) refresh();
  });
  setInterval(function () { if (!document.hidden) refresh(); }, 300000);
  refresh();
}());
