const mysql = require('mysql2/promise');
require('dotenv').config();

async function addPreviewUrlColumn() {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'edushare_db'
        });

        console.log('Adding PreviewURL to TAILIEU...');
        await pool.execute('ALTER TABLE TAILIEU ADD COLUMN PreviewURL VARCHAR(255) DEFAULT NULL;');
        console.log('Success!');
        process.exit(0);
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('Column PreviewURL already exists.');
            process.exit(0);
        } else {
            console.error('Error:', err);
            process.exit(1);
        }
    }
}

addPreviewUrlColumn();
