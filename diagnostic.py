
import re

def check_tags(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    stack = []
    mismatches = []

    for i, line in enumerate(lines):
        line_num = i + 1
        
        # Find all divs and closing divs
        # This is a bit naive but should help
        tokens = re.findall(r'<(div)\b|</(div)>', line)
        for open_tag, close_tag in tokens:
            if open_tag:
                stack.append((line_num, line.strip()))
            elif close_tag:
                if not stack:
                    mismatches.append(f"Unexpected closing div at line {line_num}")
                else:
                    stack.pop()
    
    for line_num, content in stack:
        mismatches.append(f"Unclosed div from line {line_num}: {content}")
    
    return mismatches

mismatches = check_tags(r"c:\Users\Karan Bohara\Downloads\procaresoft-main\src\pages\dashboard\pathology.tsx")
for m in mismatches:
    print(m)
