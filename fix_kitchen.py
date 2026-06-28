import re

with open('web/app/finance/KitchenPayoutsTab.tsx', 'r') as f:
    content = f.read()

# Fix the double invocation on line 178
content = content.replace("useEffect(() => { () => load()(); }, [() => load()]);", "useEffect(() => { load(); }, [load]);")

# Move load = useCallback above the useEffects
# Wait, rather than doing complex string manipulation, I can just change const load = useCallback to function load() ... but it has dependencies.
# Let's just do a sed on line 178 first.
with open('web/app/finance/KitchenPayoutsTab.tsx', 'w') as f:
    f.write(content)
