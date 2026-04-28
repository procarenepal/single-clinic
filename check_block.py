
import re

content = open(r"c:\Users\Karan Bohara\Downloads\procaresoft-main\src\pages\dashboard\pathology.tsx", 'r', encoding='utf-8').read()
start_marker = 'testModalState.isOpen &&'
end_marker = 'categoryModalState.isOpen &&'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Markers not found")
    exit(1)

block = content[start_idx:end_idx]
# Find tags like <div or </div
tags = re.findall(r'<([a-zA-Z0-9]+)|</([a-zA-Z0-9]+)>', block)
stack = []
void_tags = ['img','br','hr','input','meta','link', 'col', 'base', 'area', 'param', 'source', 'track', 'wbr']

for o, c in tags:
    if o:
        if o.lower() not in void_tags:
            stack.append(o)
    else:
        if stack:
            # Check if it matches (case insensitive for HTML)
            if stack[-1].lower() == c.lower():
                stack.pop()
            else:
                print(f"Mismatch: expected {stack[-1]}, got {c}")
        else:
            print(f"Extra closing tag: {c}")

print(f"Unclosed in block: {stack}")
