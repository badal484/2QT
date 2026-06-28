import re

with open('web/app/admin/page.tsx', 'r') as f:
    content = f.read()

# Import ActivityTab
if 'import ActivityTab' not in content:
    content = content.replace("import MenuTab from './MenuTab';", "import MenuTab from './MenuTab';\nimport ActivityTab from './ActivityTab';")

# Add to navigation tabs (e.g. inside TABS array or similar structure)
# Let's find where the tabs are mapped
if '{ id: "activity", label: "Activity Log", icon: Activity },' not in content:
    # Wait, the tabs are usually defined in a TABS array.
    content = re.sub(r'(\{\s*id:\s*["\']kitchen["\'].*?\},)', r'\1\n    { id: "activity", label: "Activity Log", icon: Activity },', content)

# Add to the switch/case renderer
if 'case "activity":' not in content:
    content = re.sub(r'(case\s*["\']kitchen["\']:\s*return\s*<KitchenTab[^>]*/>;?)', r'\1\n      case "activity":\n        return <ActivityTab />;', content)

# Also ensure Activity icon is imported from lucide-react if not already
if 'Activity' not in content:
    content = re.sub(r'import\s*\{(.*?)\}\s*from\s*["\']lucide-react["\'];', lambda m: f"import {{{m.group(1)}, Activity}} from 'lucide-react';", content)

with open('web/app/admin/page.tsx', 'w') as f:
    f.write(content)

print("Wired ActivityTab")
