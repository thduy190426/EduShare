require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mysql = require('mysql2/promise');

async function run() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'edushare_db',
    });

    async function addColumnIfMissing(tableName, columnName, definition) {
        const [rows] = await pool.execute(
            `SELECT COLUMN_NAME
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            [tableName, columnName]
        );

        if (rows.length > 0) {
            console.log(`Column ${tableName}.${columnName} already exists`);
            return;
        }

        await pool.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
        console.log(`Added column ${tableName}.${columnName}`);
    }

    async function createTableIfMissing(tableName, ddl) {
        const [rows] = await pool.execute(
            `SELECT TABLE_NAME
             FROM INFORMATION_SCHEMA.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
            [tableName]
        );

        if (rows.length > 0) {
            console.log(`Table ${tableName} already exists`);
            return;
        }

        await pool.execute(ddl);
        console.log(`Created table ${tableName}`);
    }

    try {
        await addColumnIfMissing('TAILIEU', 'LyDoTuChoi', 'TEXT DEFAULT NULL');
        await addColumnIfMissing('NGUOIDUNG', 'AvatarURL', 'VARCHAR(255) DEFAULT NULL');
        await addColumnIfMissing('NGUOIDUNG', 'Tuoi', 'INT DEFAULT NULL');
        await addColumnIfMissing('NGUOIDUNG', 'GioiTinh', "ENUM('Nam', 'Nu', 'Khac') DEFAULT 'Khac'");
        await addColumnIfMissing('NGUOIDUNG', 'DiaChi', 'VARCHAR(255) DEFAULT NULL');
        await pool.execute('ALTER TABLE NGUOIDUNG MODIFY COLUMN GioiTinh VARCHAR(20) DEFAULT NULL');
        await pool.execute(`
            UPDATE NGUOIDUNG
            SET GioiTinh = CASE
                WHEN GioiTinh IN ('Nam') THEN 'Nam'
                WHEN GioiTinh IN ('Nu', 'Nữ', 'Ná»¯') THEN 'Nu'
                ELSE 'Khac'
            END
            WHERE GioiTinh IS NOT NULL
        `);
        await pool.execute("ALTER TABLE NGUOIDUNG MODIFY COLUMN GioiTinh ENUM('Nam', 'Nu', 'Khac') DEFAULT 'Khac'");
        console.log('Normalized NGUOIDUNG.GioiTinh enum');
        await addColumnIfMissing('MONHOC', 'NgayTao', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await addColumnIfMissing('MONHOC', 'NgayCapNhat', 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
        await createTableIfMissing('NGUOIDUNG_MONHOC', `
            CREATE TABLE NGUOIDUNG_MONHOC (
                MaND INT NOT NULL,
                MaMonHoc INT NOT NULL,
                NgayTheoDoi DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (MaND, MaMonHoc),
                FOREIGN KEY (MaND) REFERENCES NGUOIDUNG(MaND),
                FOREIGN KEY (MaMonHoc) REFERENCES MONHOC(MaMonHoc)
            )
        `);
    } finally {
        await pool.end();
    }
}

run().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
