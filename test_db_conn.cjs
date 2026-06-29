const mysql = require('mysql2/promise');

async function test() {
  const connectionString = process.env.DATABASE_URL || 'mysql://whatxpress:WhatXpress2026_Secure@127.0.0.1:3306/whatxpress';
  try {
    const match = connectionString.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!match) {
      console.error('Invalid connection string');
      process.exit(1);
    }
    const [, user, password, host, port, database] = match;
    const conn = await mysql.createConnection({
      host, port: Number(port), user, password, database
    });
    const [rows] = await conn.query('SELECT 1 as ok');
    console.log('Connection successful:', rows[0]);
    await conn.end();
  } catch (err) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  }
}

test();
