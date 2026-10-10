#!/usr/bin/env python3
"""Heuristic privacy guard. Reports locations/rules, never matched values.
CI checks happen after upload; install local hooks for pre-commit protection.
"""
import argparse, html, re, subprocess, sys
from pathlib import Path
from urllib.parse import unquote
ROOT = Path(__file__).resolve().parents[1]
PHONE = re.compile(r'(?<!\w)(?:(?:\+|00)?966[ .()\-]*[15](?:[ .()\-]*\d){8}|0[15](?:[ .()\-]*\d){8}|\+(?:\d[ .()\-]*){8,15})(?!\w)')
DIRECT = re.compile(r'(?i)(?:wa[.]me/|(?:api|web)[.]whatsapp[.]com/|(?:tel|sms|whatsapp):)[^\s<>"\x27`]+')
EMAIL = re.compile(r'[\w.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
TELEGRAM = re.compile(r'(?is)(?:TG_CHAT|chat_id|telegram|تيليجرام).{0,180}?(?<!\w)-?\d{7,15}(?!\w)')
MAP = re.compile(r'(?i)(?:maps[.]app[.]goo[.]gl/|goo[.]gl/maps/|maps[.]google[.]|google[.][^\s/]+/maps/)')
GEOMETRY = re.compile(r'\b(?:d|points|viewBox|transform)\s*=\s*(["\x27])(.*?)\1', re.S)
ALLOWED_DOMAINS = {'example.com','example.org','example.net','users.noreply.github.com'}
def normalize(text):
 text = html.unescape(unquote(text))
 text = re.sub(r'\\u([0-9a-fA-F]{4})',lambda m:chr(int(m[1],16)),text)
 return text.translate(str.maketrans('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789')).replace('\u200b','').replace('\u200e','').replace('\u200f','')
def inspect(text,path=''):
 text = normalize(text)
 if path.endswith(('.svg','.html')):
  # Ignore only geometry. Preserve text, comments, links and metadata.
  text = GEOMETRY.sub(lambda m:m.group(0).replace(m[2],re.sub(r'[^\n]',' ',m[2])),text)
 hits=[]
 for rule,pattern in [('phone',PHONE),('direct-contact',DIRECT),('private-destination',TELEGRAM),('map-location',MAP)]:
  for m in pattern.finditer(text):hits.append((text.count('\n',0,m.start())+1,rule))
 for m in EMAIL.finditer(text):
  value=m.group().lower()
  if value.split('@')[-1] not in ALLOWED_DOMAINS and value not in {'noreply@anthropic.com','noreply@openai.com'}:
   hits.append((text.count('\n',0,m.start())+1,'private-email'))
 return sorted(set(hits))
def git(*args):
 p=subprocess.run(['git',*args],cwd=ROOT,capture_output=True)
 if p.returncode:raise RuntimeError('Git read failed; raw details withheld.')
 return p.stdout
def main(argv=None):
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--staged',action='store_true')
 p.add_argument('--message-file',type=Path)
 p.add_argument('--since',help='Base SHA: scan only new messages and identities.')
 p.add_argument('--check-identity',action='store_true')
 a=p.parse_args(argv);findings=[]
 def check(label,data,path=''):
  for line,rule in inspect(data.decode('utf-8',errors='replace'),path):findings.append((label,line,rule))
 try:
  if not a.message_file:
   for raw in git('ls-files','-z').split(b'\0'):
    if not raw:continue
    path=raw.decode('utf-8');file=ROOT/path
    if a.staged:check(path,git('show',':'+path),path)
    elif file.is_file():check(path,file.read_bytes(),path)
  if a.message_file:check('proposed-commit-message',a.message_file.read_bytes())
  if a.check_identity:
   check('proposed-author',git('var','GIT_AUTHOR_IDENT'))
   check('proposed-committer',git('var','GIT_COMMITTER_IDENT'))
  if a.since:
   if not re.fullmatch(r'[0-9a-fA-F]{40,64}',a.since):raise RuntimeError('Full base SHA required.')
   for sha in git('rev-list',a.since+'..HEAD').decode().splitlines():
    check('new-commit-'+sha[:12],git('show','-s','--format=%B%n%an <%ae>%n%cn <%ce>',sha))
 except (OSError,RuntimeError):
  print('Privacy check incomplete; raw error details withheld.',file=sys.stderr);return 2
 for label,line,rule in findings:print(f'{label}:{line}: {rule} [VALUE WITHHELD]')
 if findings:
  print('Privacy check FAILED. Use external secrets and a GitHub noreply Git identity.');return 1
 print('Privacy check passed for the requested scope.');return 0
if __name__=='__main__':raise SystemExit(main())
