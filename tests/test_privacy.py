"""Synthetic detector checks: no real contact information is used."""
import contextlib, importlib.util, io, tempfile, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('privacy',Path(__file__).resolve().parents[1]/'scripts/check_privacy.py')
privacy=importlib.util.module_from_spec(spec);spec.loader.exec_module(privacy)
PHONE='+'+'9'+'66'+'5'+'0'*8
LOCAL='0'+'5'+'0'*8
class PrivacyTests(unittest.TestCase):
 def kinds(self,text,path=''):
  return {rule for _,rule in privacy.inspect(text,path)}
 def test_international_phone(self):self.assertIn('phone',self.kinds(PHONE))
 def test_local_phone(self):self.assertIn('phone',self.kinds(LOCAL))
 def test_spaced_phone(self):self.assertIn('phone',self.kinds(PHONE[:4]+' '+PHONE[4:]))
 def test_arabic_digits(self):
  value=PHONE.translate(str.maketrans(''.join(str(i) for i in range(10)), ''.join(chr(0x660+i) for i in range(10))))
  self.assertIn('phone',self.kinds(value))
 def test_html_entities(self):
  self.assertIn('phone',self.kinds(''.join('&#'+str(ord(c))+';' for c in PHONE)))
 def test_url_encoding(self):
  self.assertIn('phone',self.kinds('%2B'+PHONE[1:]))
 def test_json_unicode(self):
  self.assertIn('phone',self.kinds(''.join('\\u'+format(ord(c),'04x') for c in PHONE)))
 def test_direct_link(self):
  self.assertIn('direct-contact',self.kinds('https://'+'wa'+'.me/'+PHONE[1:]))
 def test_telegram_destination(self):
  self.assertIn('private-destination',self.kinds('TG_'+'CHAT = '+('7'*9)))
 def test_private_email(self):
  self.assertIn('private-email',self.kinds('private'+'@'+'mail.invalid'))
 def test_safe_examples(self):
  self.assertEqual(set(),self.kinds('sample@example.com'))
  self.assertEqual(set(),self.kinds('user@users.noreply.github.com'))
 def test_svg_geometry_not_contact(self):
  self.assertEqual(set(),self.kinds('<svg><path d="M'+LOCAL+' 0"/></svg>','icon.svg'))
 def test_svg_text_is_not_exempt(self):
  self.assertIn('phone',self.kinds('<svg><text>'+PHONE+'</text></svg>','icon.svg'))
 def test_svg_comment_is_not_exempt(self):
  self.assertIn('phone',self.kinds('<svg><!-- '+PHONE+' --></svg>','icon.svg'))
 def test_output_never_echoes_match(self):
  with tempfile.TemporaryDirectory() as folder:
   path=Path(folder)/'message';path.write_text('Test '+PHONE,encoding='utf-8')
   output=io.StringIO()
   with contextlib.redirect_stdout(output):code=privacy.main(['--message-file',str(path)])
   self.assertEqual(1,code)
   self.assertNotIn(PHONE,output.getvalue())
   self.assertIn('VALUE WITHHELD',output.getvalue())
if __name__=='__main__':unittest.main()
