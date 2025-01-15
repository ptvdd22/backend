// 📌 Database configuratie

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 5432,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Test de verbinding
pool.connect()
    .then(() => console.log('✅ PostgreSQL Database verbonden'))
    .catch((err) => {
        console.error('❌ Fout bij verbinden met PostgreSQL:', err.message);
        process.exit(1);
    });

module.exports = pool;