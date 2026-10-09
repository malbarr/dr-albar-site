"""Read-only browser checks; fixtures are intercepted locally and never published.
python tests/test_orl_daily.py --source ../source --artifacts ../test-artifacts
Add --live https://dr-albar.com for real post-deployment checks.
Requires Python, Playwright and Chromium (or Microsoft Edge).
"""
import argparse, copy, functools, hashlib, json, threading, traceback
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

p = argparse.ArgumentParser()
p.add_argument('--source', type=Path, required=True)
p.add_argument('--artifacts', type=Path, required=True)
p.add_argument('--live', default='')
a = p.parse_args()
a.artifacts.mkdir(parents=True, exist_ok=True)
root = Path(__file__).resolve().parents[1]
index = json.loads((a.source / 'data/index.json').read_text(encoding='utf-8'))
dates = sorted(set(index['dates']), reverse=True)
data = {d: json.loads((a.source / ('data/' + d + '.json')).read_text(encoding='utf-8')) for d in dates}
files = [a.source / 'data/index.json'] + [a.source / ('data/' + d + '.json') for d in dates]
def hashes():
    return {f.name: hashlib.sha256(f.read_bytes()).hexdigest() for f in files}
before = hashes()
report = {'started_at': datetime.now(timezone.utc).isoformat(), 'mode': 'deployed' if a.live else 'local', 'dates': dates, 'checks': [], 'source_hashes': before}
def record(name, **values):
    report['checks'].append({'check': name, **values})
    (a.artifacts/'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(name, json.dumps(values, ensure_ascii=False), flush=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass
server = None
if a.live:
    base = a.live.rstrip('/')
else:
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(root)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = 'http://127.0.0.1:' + str(server.server_port)
try:
    with sync_playwright() as pw:
        try: browser = pw.chromium.launch(headless=True)
        except Exception: browser = pw.chromium.launch(headless=True, channel='msedge')
        context = browser.new_context(viewport={'width':1280,'height':900})
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        r = page.goto(base+'/orl-daily/', wait_until='domcontentloaded', timeout=45000)
        page.wait_for_selector('.daily-paper', timeout=40000)
        assert r.status == 200
        assert page.locator('#daily-date option').count() == len(dates)
        assert page.locator('.daily-paper').count() == len(data[dates[0]]['articles'])
        record('real-network-initial-load', status=r.status, url=page.url, dates=len(dates), cards=page.locator('.daily-paper').count(), status_text=page.locator('#daily-status').inner_text())
        business = sum(x.get('subspecialty') == 'business' for x in data[dates[0]]['articles'])
        assert page.locator('.daily-business-label').count() == business
        record('source-content-types-labeled', total=len(data[dates[0]]['articles']), industry_news=business)
        page.screenshot(path=str(a.artifacts/'desktop.png'))
        entries = 0
        for date in dates:
            page.select_option('#daily-date', date)
            page.wait_for_function("d => !document.querySelector('#daily-reader').hidden && document.querySelector('#daily-issue-heading time').dateTime === d", arg=date, timeout=40000)
            cards = page.locator('.daily-paper')
            expected = data[date]['articles']
            assert cards.count() == len(expected), (date, cards.count(), len(expected))
            for i, article in enumerate(expected):
                summary = article.get('summary_ar') or article.get('summary_en') or article.get('summary') or 'لا يتوفر ملخص في ملف هذا الإصدار.'
                assert cards.nth(i).locator('.daily-summary').text_content() == summary.strip(), (date,i,'summary')
                pmid = str(article.get('pmid') or '')
                if pmid.isdigit():
                    assert cards.nth(i).locator('a[href="https://pubmed.ncbi.nlm.nih.gov/'+pmid+'/"]').count() == 1, (date,pmid)
            entries += len(expected)
        record('all-editions-exact-arabic-summaries-and-pubmed', editions=len(dates), article_entries=entries, oldest=dates[-1], newest=dates[0])
        page.select_option('#daily-date', dates[0])
        page.wait_for_function("d => document.querySelector('#daily-issue-heading time').dateTime === d", arg=dates[0])
        page.locator('[data-daily-lang="en"]').click()
        assert page.locator('.daily-summary').first.text_content() == data[dates[0]]['articles'][0]['summary_en'].strip()
        page.locator('[data-daily-lang="ar"]').click()
        record('language-toggle', passed=True)
        page.locator('#daily-search').fill('zz_nonexistent_zz')
        assert page.locator('#daily-no-results').is_visible()
        page.locator('#daily-search').fill(str(data[dates[0]]['articles'][0]['pmid']))
        assert page.locator('.daily-paper').count() >= 1
        page.locator('#daily-search').fill('')
        record('in-edition-search', passed=True)
        for width,height in [(320,568),(375,812),(390,844),(430,932),(1280,900)]:
            page.set_viewport_size({'width':width,'height':height})
            page.evaluate('window.scrollTo(0,0)')
            page.wait_for_timeout(150)
            overflow = page.evaluate("""() => ({width:document.documentElement.scrollWidth,bad:[...document.querySelectorAll('#daily-app *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.right>innerWidth+1||r.left < -1);}).slice(0,5).map(e=>e.id||e.className)})""")
            assert overflow['width'] <= width and not overflow['bad'], (width,overflow)
            if width == 375:
                page.screenshot(path=str(a.artifacts/'iphone-mini.png'))
                page.locator('.daily-paper').first.screenshot(path=str(a.artifacts/'mobile-paper.png'))
                page.locator('.burger').click()
                assert page.locator('.burger').get_attribute('aria-expanded') == 'true'
                assert page.locator('#menu a[href="/orl-daily/"]').is_visible()
                page.locator('.burger').click()
                record('mobile-navigation', passed=True)
            record('responsive-layout', width=width,height=height,horizontal_overflow=False)
        page.set_viewport_size({'width':390,'height':844})
        page.locator('.daily-archive-box > summary').click()
        assert page.locator('#daily-archive a').count() == len(dates)
        page.locator('.daily-archive-box').screenshot(path=str(a.artifacts/'archive.png'))
        record('complete-monthly-archive', links=len(dates))
        page.goto(base+'/orl-daily/?date='+dates[-1]+'&lang=en',wait_until='domcontentloaded')
        page.wait_for_selector('.daily-paper',timeout=40000)
        assert page.locator('#daily-issue-heading time').get_attribute('datetime') == dates[-1]
        record('historical-deep-link',date=dates[-1],passed=True)
        page.goto(base+'/',wait_until='domcontentloaded',timeout=45000)
        page.wait_for_selector('#daily-preview a',timeout=40000)
        links=page.locator('#daily-preview a').evaluate_all('(nodes)=>nodes.map(n=>n.getAttribute("href"))')
        assert len(links)==min(3,len(data[dates[0]]['articles']))
        assert all(x.startswith('/orl-daily/?date='+dates[0]) for x in links)
        assert 'نماذج توضيحية للشكل' not in page.locator('body').inner_text()
        record('real-homepage-previews-internal-links',links=links)
        page.locator('#daily-preview').screenshot(path=str(a.artifacts/'home-preview.png'))
        assert not errors,errors
        if not a.live:
            fixture_index=copy.deepcopy(index); fixture_data=copy.deepcopy(data)
            mode={'failure':False,'raw_blocked':False}; seen=[]
            def route_source(route):
                url=route.request.url
                if not (url.startswith('https://raw.githubusercontent.com/malbarr/orl-daily/main/data/') or url.startswith('https://malbarr.github.io/orl-daily/data/')):
                    return route.continue_()
                seen.append(url)
                if mode['failure'] or (mode['raw_blocked'] and 'raw.githubusercontent.com' in url):
                    return route.fulfill(status=503,content_type='application/json',body='{}',headers={'Access-Control-Allow-Origin':'*'})
                name=urlparse(url).path.rsplit('/',1)[-1]
                value=fixture_index if name=='index.json' else fixture_data[name[:-5]]
                route.fulfill(status=200,content_type='application/json',body=json.dumps(value),headers={'Access-Control-Allow-Origin':'*'})
            context.route('**/*',route_source)
            page.clock.install()
            page.goto(base+'/orl-daily/',wait_until='domcontentloaded'); page.wait_for_selector('.daily-paper')
            future='2099-01-02'; fixture_index['dates'].insert(0,future)
            fixture_data[future]=copy.deepcopy(data[dates[0]]); fixture_data[future]['date']=future; fixture_data[future]['generated_at']=future+'T03:00:00Z'
            page.clock.fast_forward(300001)
            page.wait_for_function("d=>document.querySelector('#daily-issue-heading time').dateTime===d",arg=future)
            assert page.locator('#daily-date option').count()==len(dates)+1
            record('future-edition-auto-refresh-browser-only-simulation',synthetic_date=future,added_without_site_edit=True,old_dates_retained=len(dates),published=False)
            fixture_index['dates'].remove(future); mode['raw_blocked']=True
            page.goto(base+'/orl-daily/',wait_until='domcontentloaded'); page.wait_for_selector('.daily-paper')
            assert any(x.startswith('https://malbarr.github.io/orl-daily/data/') for x in seen)
            record('secondary-source-fallback',passed=True)
            mode['failure']=True
            page.goto(base+'/orl-daily/',wait_until='domcontentloaded'); page.wait_for_selector('#daily-retry:visible')
            assert 'أول عدد لم' not in page.locator('body').inner_text()
            assert 'مشكلة تحميل' in page.locator('#daily-status').inner_text()
            record('network-failure-not-false-empty-archive',passed=True)
            mode.update(failure=False,raw_blocked=False)
            fixture_data[dates[0]]['articles'][0].update(title_ar='<img src=x onerror="window.injected=1">',summary_ar='<script>window.injected=1</script>',pmid='',pubmed_url='javascript:alert(1)',doi='javascript:alert(1)')
            page.goto(base+'/orl-daily/',wait_until='domcontentloaded'); page.wait_for_selector('.daily-paper')
            assert page.locator('.daily-paper img,.daily-paper script,.daily-paper a[href^="javascript:"]').count()==0
            assert page.evaluate('window.injected||0')==0
            record('source-text-and-url-safety',passed=True)
            page.goto(base+'/orl-daily/?date=invalid',wait_until='domcontentloaded'); page.wait_for_selector('#daily-retry:visible')
            assert page.locator('#daily-reader').is_hidden()
            record('invalid-date-not-silently-replaced',passed=True)
        browser.close()
    assert hashes()==before
    record('scientific-source-unchanged',files=len(before),passed=True)
    report['success']=True
except Exception:
    report['success']=False; report['error']=traceback.format_exc(); print(report['error'],flush=True)
finally:
    if server: server.shutdown()
    report['finished_at']=datetime.now(timezone.utc).isoformat()
    (a.artifacts/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
if not report['success']: raise SystemExit(1)
print('ALL TESTS PASSED',flush=True)
