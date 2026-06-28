const fs = require('fs');

// Fix KitchenPayoutsTab.tsx
let f1 = 'web/app/finance/KitchenPayoutsTab.tsx';
let c1 = fs.readFileSync(f1, 'utf8');
// To fix hoisting, let's just change `const load = useCallback(async () => {` to `async function load() {` or move the useEffects below it.
// Actually, since there are dependencies in useCallback, it's safer to move the useEffects below the load declaration.
// But it's easier to just change `useEffect(() => { load(); }, [load]);` to not include `load` in dependency array or ignore hoisting by declaring it before.
// Wait, I can just use sed to change `const load = useCallback(async () => {` to `const load = async () => {`? That won't fix hoisting.
// Let's just move `load` definition above `useEffect(() => { loadSummary(); }, [loadSummary]);`

c1 = c1.replace('  useEffect(() => { loadSummary(); }, [loadSummary]);\n  useEffect(() => { load(); }, [load]);\n\n  useSocketRefresh(["kitchen_payout_updated", "order_status_update"], () => {\n    loadSummary();\n    load();\n  });', '');

let insertIdx = c1.indexOf('  const load = useCallback(async () => {');
if (insertIdx !== -1) {
    let endIdx = c1.indexOf('  }, [fetchKitchens]);', insertIdx);
    if (endIdx !== -1) {
        let snippet = '\n\n  useEffect(() => { loadSummary(); }, [loadSummary]);\n  useEffect(() => { load(); }, [load]);\n\n  useSocketRefresh(["kitchen_payout_updated", "order_status_update"], () => {\n    loadSummary();\n    load();\n  });\n';
        c1 = c1.slice(0, endIdx + 22) + snippet + c1.slice(endIdx + 22);
    }
}
fs.writeFileSync(f1, c1);


// Fix profile/page.tsx
let f2 = 'web/app/profile/page.tsx';
let c2 = fs.readFileSync(f2, 'utf8');
c2 = c2.replace(/useSocketRefresh\(\['ticket_status_updated', 'user_updated'\], fetchProfile\)/g, "useSocketRefresh(['ticket_status_updated', 'user_updated'], load)");
c2 = c2.replace(/useSocketRefresh\(\['ticket_status_updated', 'user_updated'\], loadTickets\)/g, "useSocketRefresh(['ticket_status_updated', 'user_updated'], load)");
c2 = c2.replace(/onClick=\{fetchProfile\}/g, "onClick={load}");
fs.writeFileSync(f2, c2);

