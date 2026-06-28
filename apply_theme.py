import re
import sys

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Add BouncingButton import if not present
    if "import { BouncingButton }" not in content and "BouncingButton" not in content:
        content = re.sub(r"(import React.*?;\n)", r"\1import { BouncingButton } from '../components/ui/BouncingButton';\n", content, count=1)

    # Replace TouchableOpacity with BouncingButton
    content = re.sub(r"<TouchableOpacity", r"<BouncingButton", content)
    content = re.sub(r"</TouchableOpacity>", r"</BouncingButton>", content)
    
    # Clean up any leftover activeOpacity from TouchableOpacity that might conflict or just leave them (React ignores them on custom components if not passed down)
    
    # Increase border radii for premium roundness
    content = re.sub(r"borderRadius:\s*8\b", "borderRadius: 16", content)
    content = re.sub(r"borderRadius:\s*12\b", "borderRadius: 20", content)
    content = re.sub(r"borderRadius:\s*10\b", "borderRadius: 16", content)

    # Soften and expand shadows
    content = re.sub(r"shadowOpacity:\s*0\.[1-9]\d*", "shadowOpacity: 0.08", content)
    content = re.sub(r"shadowRadius:\s*[1-9]\b", "shadowRadius: 16", content)
    content = re.sub(r"elevation:\s*[1-5]\b", "elevation: 4", content)

    # Make sure text color of headers is 'ink' not pure black if they were hardcoded
    # content = re.sub(r"color:\s*['\"]#000000['\"]", "color: colors.ink", content)

    with open(filepath, 'w') as f:
        f.write(content)

files = [
    "mobile/src/screens/HomeScreen.tsx",
    "mobile/src/screens/SearchScreen.tsx",
    "mobile/src/screens/CategoryScreen.tsx",
    "mobile/src/screens/ItemDetailScreen.tsx",
    "mobile/src/screens/CartScreen.tsx",
]

for f in files:
    process_file(f)
    print(f"Processed {f}")

