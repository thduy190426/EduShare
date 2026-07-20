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
        await addColumnIfMissing('TAILIEU', 'PhanHoiTuChoi', 'TEXT DEFAULT NULL');
        await addColumnIfMissing('NGUOIDUNG', 'AvatarURL', 'VARCHAR(255) DEFAULT NULL');
        await addColumnIfMissing('NGUOIDUNG', 'Tuoi', 'INT DEFAULT NULL');
        await addColumnIfMissing('NGUOIDUNG', 'SoDuXu', 'INT DEFAULT 0');
        await addColumnIfMissing('NGUOIDUNG', 'GioiTinh', "ENUM('Nam', 'Nu', 'Khac') DEFAULT 'Khac'");
        await addColumnIfMissing('NGUOIDUNG', 'DiaChi', 'VARCHAR(255) DEFAULT NULL');
        await addColumnIfMissing('NGUOIDUNG', 'TruongHoc', 'VARCHAR(255) DEFAULT NULL');
        await addColumnIfMissing('NGUOIDUNG', 'KhoaNganh', 'VARCHAR(255) DEFAULT NULL');
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
        await addColumnIfMissing('NGUOIDUNG', 'NgayTao', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await addColumnIfMissing('MONHOC', 'NgayTao', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
        await addColumnIfMissing('MONHOC', 'NgayCapNhat', 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
        await pool.execute("ALTER TABLE MONHOC MODIFY COLUMN TrangThai ENUM('HoatDong', 'TamAn', 'DaXoa') DEFAULT 'HoatDong'");
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
        await createTableIfMissing('DEXUAT_MONHOC', `
            CREATE TABLE DEXUAT_MONHOC (
                MaDeXuat INT AUTO_INCREMENT PRIMARY KEY,
                TenMonHoc VARCHAR(255) NOT NULL,
                CapHoc VARCHAR(100) DEFAULT 'Khac',
                MoTa TEXT,
                LyDo TEXT,
                MaND_DeXuat INT NOT NULL,
                TrangThai ENUM('ChoDuyet', 'DaDuyet', 'TuChoi') DEFAULT 'ChoDuyet',
                LyDoTuChoi TEXT DEFAULT NULL,
                MaMonHocDaTao INT DEFAULT NULL,
                MaND_Duyet INT DEFAULT NULL,
                NgayDeXuat DATETIME DEFAULT CURRENT_TIMESTAMP,
                NgayDuyet DATETIME DEFAULT NULL,
                FOREIGN KEY (MaND_DeXuat) REFERENCES NGUOIDUNG(MaND),
                FOREIGN KEY (MaMonHocDaTao) REFERENCES MONHOC(MaMonHoc),
                FOREIGN KEY (MaND_Duyet) REFERENCES NGUOIDUNG(MaND)
            )
        `);
        await createTableIfMissing('GIAODICH_NAPXU', `
            CREATE TABLE GIAODICH_NAPXU (
                MaGD INT AUTO_INCREMENT PRIMARY KEY,
                MaND INT NOT NULL,
                SoTien INT NOT NULL,
                SoXu INT NOT NULL,
                TrangThai ENUM('ChoDuyet', 'DaDuyet', 'TuChoi') DEFAULT 'ChoDuyet',
                MaND_Duyet INT DEFAULT NULL,
                NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP,
                NgayDuyet DATETIME DEFAULT NULL,
                FOREIGN KEY (MaND) REFERENCES NGUOIDUNG(MaND),
                FOREIGN KEY (MaND_Duyet) REFERENCES NGUOIDUNG(MaND)
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
