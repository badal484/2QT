import re
import os

def process_file(filepath):
    if not os.path.exists(filepath):
        return

    with open(filepath, 'r') as f:
        content = f.read()

    # Replace specific hex codes used for orange/amber
    content = re.sub(r"(?i)#D97B4F", "#1B5E46", content) # Terracotta -> Primary
    content = re.sub(r"(?i)'#F97316'", "G.primary", content) # Orange -> Primary
    content = re.sub(r"(?i)'#F59E0B'", "G.primary", content) # Amber -> Primary
    content = re.sub(r"(?i)'rgba\(249,115,22,.*?_'", "G.primaryDim", content)
    content = re.sub(r"(?i)'rgba\(245,158,11,.*?_'", "G.primaryDim", content)

    # In CartScreen.tsx, tipChipActive background #FFF5F0 -> #E8F2EC
    content = re.sub(r"(?i)#FFF5F0", "#E8F2EC", content)

    # In colors.ts
    content = re.sub(r"accent:\s*'#1B5E46',", "accent: '#1B5E46',", content) # Already handled by D97B4F replace, but just in case
    content = re.sub(r"accentTint:\s*'#FBEAE0',", "accentTint: '#E8F2EC',", content)

    with open(filepath, 'w') as f:
        f.write(content)

for root, _, files in os.walk('mobile/src'):
    for file in files:
        if file.endswith('.ts') or file.endswith('.tsx'):
            process_file(os.path.join(root, file))

print("Orange replaced globally.")
