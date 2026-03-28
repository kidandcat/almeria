#!/usr/bin/env python3
"""Embed baked route data into index.html - no regex backreferences"""

with open('/Users/jairo/almeria/index.html') as f:
    html = f.read()

with open('/Users/jairo/almeria/baked_data.js') as f:
    new_baked = f.read()

MARKER = '// ─── MAP SETUP'
start = html.find('const BAKED')
end = html.find(MARKER)

if start == -1 or end == -1:
    print(f'ERROR: start={start} end={end}')
    exit(1)

# Find the start of the line containing 'const BAKED'
line_start = html.rfind('\n', 0, start) + 1

new_html = html[:line_start] + new_baked + '\n    ' + html[end:]

with open('/Users/jairo/almeria/index.html', 'w') as f:
    f.write(new_html)

print(f'{len(new_html)//1024}KB - OK')
