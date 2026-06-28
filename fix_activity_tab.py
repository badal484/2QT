import re
with open('web/app/admin/ActivityTab.tsx', 'r') as f:
    content = f.read()

content = content.replace("from 'lucide-react-native'", "from 'lucide-react'")

with open('web/app/admin/ActivityTab.tsx', 'w') as f:
    f.write(content)
print("Fixed ActivityTab.tsx")
