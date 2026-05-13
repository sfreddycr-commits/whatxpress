const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://vitruspm:vitruspm123@127.0.0.1:5432/whatxpress'
});

pool.query('SELECT 1', (err, res) => {
  if (err) {
    console.error('Connection failed:', err);
  } else {
    console.log('Connection successful:', res.rows[0]);
  }
  pool.end();
});
