
import re

content = open(r"c:\Users\Karan Bohara\Downloads\procaresoft-main\src\pages\dashboard\pathology.tsx", 'r', encoding='utf-8').read()
lines = content.splitlines()

block_lines = lines[1812:1964] # from return to before modal
block = "\n".join(block_lines)

# Robust tag finder
tags = re.findall(r'<([a-zA-Z0-9]+)[^>]*?(/?)\s*>|</([a-zA-Z0-9]+)>', block)
stack = []
void_tags = ['img','br','hr','input','meta','link', 'col', 'base', 'area', 'param', 'source', 'track', 'wbr']

for o, self_close, c in tags:
    if o:
        if self_close != '/' and o.lower() not in void_tags:
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
