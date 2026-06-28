import re

with open('web/app/profile/page.tsx', 'r') as f:
    content = f.read()
content = content.replace("onClick={load}", "onClick={fetchProfile}")
content = content.replace("useSocketRefresh(['ticket_status_updated', 'user_updated'], load)", "useSocketRefresh(['ticket_status_updated', 'user_updated'], fetchProfile)")
with open('web/app/profile/page.tsx', 'w') as f:
    f.write(content)

with open('web/app/finance/KitchenPayoutsTab.tsx', 'r') as f:
    content = f.read()
# Find where `load` is used on line 178.
content = content.replace("onClick={load}", "onClick={() => load()}")
with open('web/app/finance/KitchenPayoutsTab.tsx', 'w') as f:
    f.write(content)

