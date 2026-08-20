from pathlib import Path
from bs4 import BeautifulSoup

html_path = Path('/home/ubuntu/browser_html/chatgpt_com_t_6a871acb23608191ae8b9ed399e0c925_1787239409701.html')
out_path = Path('/home/ubuntu/eventverse/docs/linked-directive-6a871acb-role-governance.md')
soup = BeautifulSoup(html_path.read_text(errors='ignore'), 'html.parser')
blocks = []
for node in soup.find_all(['pre', 'code']):
    text = node.get_text('\n', strip=False)
    if 'END OF DIRECTIVE' in text or 'FINAL REPORT' in text:
        blocks.append(text)
if not blocks:
    blocks = [soup.get_text('\n', strip=False)]
out_path.write_text('\n\n'.join(blocks))
print(out_path)
print('lines', len(out_path.read_text().splitlines()))
