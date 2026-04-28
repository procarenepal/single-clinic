
import re

with open(r"c:\Users\Karan Bohara\Downloads\procaresoft-main\src\pages\dashboard\pathology.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

stack = []
for i, line in enumerate(lines):
    # This is a very simple check, might be confused by strings/comments
    # but should give a rough idea.
    clean_line = re.sub(r'\{/*.*?*/\}', '', line) # remove comments
    clean_line = re.sub(r'//.*', '', clean_line)
    
    opens = re.findall(r'<div\b', clean_line)
    closes = re.findall(r'</div\s*>', clean_line)
    
    for _ in opens:
        stack.append(i + 1)
    for _ in closes:
        if stack:
            stack.pop()
        else:
            print(f"Extra closing tag at line {i + 1}")

print(f"Unclosed tags started at lines: {stack}")
