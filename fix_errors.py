import re

# Fix ActivityTab
with open('web/app/admin/ActivityTab.tsx', 'r') as f:
    content = f.read()
content = content.replace("import { api } from '../../lib/api';", "import { api } from '../lib/api';")
content = content.replace("useSocketRefresh(['new_activity_log'], (newLog) => {", "useSocketRefresh(['new_activity_log'], () => {\n  // (newLog is not passed by useSocketRefresh, we should just call loadLogs)\n  loadLogs();\n});\n/*")
content = content.replace("});\n\n  const getRoleIcon", "*/\n\n  const getRoleIcon")
with open('web/app/admin/ActivityTab.tsx', 'w') as f:
    f.write(content)

# Fix KitchenPayoutsTab.tsx
with open('web/app/finance/KitchenPayoutsTab.tsx', 'r') as f:
    content = f.read()
content = content.replace("const load = async () => {", "async function load() {")
with open('web/app/finance/KitchenPayoutsTab.tsx', 'w') as f:
    f.write(content)

# Fix profile/page.tsx
with open('web/app/profile/page.tsx', 'r') as f:
    content = f.read()
content = content.replace("onClick={load}", "onClick={fetchProfile}")
content = content.replace("useSocketRefresh(['ticket_status_updated', 'user_updated'], load)", "useSocketRefresh(['ticket_status_updated', 'user_updated'], fetchProfile)")
with open('web/app/profile/page.tsx', 'w') as f:
    f.write(content)

print("Fixed TS errors")
