const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://postgres.kkftttimpfenlgtjafnj:badal483454@13.239.87.90:6543/postgres?pgbouncer=true'
});

async function extractSchema() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT 
        table_name, 
        column_name, 
        data_type, 
        column_default, 
        is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);
    
    let schemaStr = '';
    let currentTable = '';
    
    for (const row of res.rows) {
      if (row.table_name !== currentTable) {
        schemaStr += `\nTable: ${row.table_name}\n------------------------\n`;
        currentTable = row.table_name;
      }
      schemaStr += `- ${row.column_name} (${row.data_type}) ${row.is_nullable === 'NO' ? 'NOT NULL' : ''} ${row.column_default ? 'DEFAULT ' + row.column_default : ''}\n`;
    }
    
    fs.writeFileSync('./scratch/schema_dump.txt', schemaStr);
    console.log('Schema dumped successfully.');
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

extractSchema();
