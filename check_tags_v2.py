
import re

with open(r"c:\Users\Karan Bohara\Downloads\procaresoft-main\src\pages\dashboard\pathology.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Find all <div or </div>
tags = re.findall(r'<div\b|</div>', content)
stack = []
for i, tag in enumerate(tags):
    if tag == '<div':
        stack.append(i)
    else:
        if stack:
            stack.pop()
        else:
            print(f"Extra closing tag at index {i}")

print(f"Total unclosed tags: {len(stack)}")

# Let's find one near the return
lines = content.splitlines()
stack = []
for i, line in enumerate(lines):
    line_num = i + 1
    if line_num < 1812: continue
    
    # Simple count per line
    opens = line.count('<div')
    closes = line.count('</div')
    
    for _ in range(opens):
        stack.append(line_num)
    for _ in range(closes):
        if stack:
            stack.pop()
        else:
            print(f"Extra closing tag at line {line_num}")

print(f"Final unclosed stack (line numbers): {stack}")
