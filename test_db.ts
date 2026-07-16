import { query } from './backend/src/db';

async function run() {
    try {
        await query(`SELECT $1::jsonb as test`, [true]);
        console.log("Success with boolean");
    } catch(e: any) {
        console.error("Failed with boolean:", e.message);
    }
    
    try {
        await query(`SELECT $1::jsonb as test`, [JSON.stringify(true)]);
        console.log("Success with stringified");
    } catch(e: any) {
        console.error("Failed with stringified:", e.message);
    }
}
run().then(() => process.exit(0));
