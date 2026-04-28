
import re

content = open(r"c:\Users\Karan Bohara\Downloads\procaresoft-main\src\pages\dashboard\pathology.tsx", 'r', encoding='utf-8').read()

# Very simple tag count - only div for now
opens = len(re.findall(r'<div\b', content))
closes = len(re.findall(r'</div\s*>', content))

print(f"Total opens: {opens}, Total closes: {closes}")
print(f"Need to add {opens - closes} closing tags.")
