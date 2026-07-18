const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('Adding TrangThai to TAILIEU_NHOM...');
        await pool.execute("ALTER TABLE TAILIEU_NHOM ADD COLUMN TrangThai ENUM('Hien', 'An') DEFAULT 'Hien'");
        console.log('Migration successful');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('Column TrangThai already exists.');
        } else {
            console.error('Migration failed:', err);
        }
    } finally {
        await pool.end();
    }
}
migrate();
