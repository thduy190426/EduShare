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
        await addColumnIfMissing('TAILIEU', 'GiaXu', 'INT DEFAULT 0');
        await addColumnIfMissing('NGUOIDUNG', 'AvatarURL', 'VARCHAR(255) DEFAULT NULL');
        await addColumnIfMissing('NGUOIDUNG', 'Tuoi', 'INT DEFAULT NULL');
        await addColumnIfMissing('NGUOIDUNG', 'SoDuXu', 'INT DEFAULT 0');
        await addColumnIfMissing('NGUOIDUNG', 'GioiTinh', "ENUM('Nam', 'Nu', 'Khac') DEFAULT 'Khac'");
        await addColumnIfMissing('NGUOIDUNG', 'DiaChi', 'VARCHAR(255) DEFAULT NULL');
        await addColumnIfMissing('NGUOIDUNG', 'TruongHoc', 'VARCHAR(255) DEFAULT NULL');
        await addColumnIfMissing('NGUOIDUNG', 'KhoaNganh', 'VARCHAR(255) DEFAULT NULL');
        await addColumnIfMissing('NGUOIDUNG', 'TwoFactorSecret', 'VARCHAR(255) DEFAULT NULL');
        await addColumnIfMissing('NGUOIDUNG', 'IsTwoFactorEnabled', 'BOOLEAN DEFAULT FALSE');
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
        
        await addColumnIfMissing('GIAODICH_NAPXU', 'MaPromo', 'INT DEFAULT NULL');
        await createTableIfMissing('TAILIEU_DAMUA', `
            CREATE TABLE TAILIEU_DAMUA (
                MaND INT NOT NULL,
                MaTL INT NOT NULL,
                NgayMua DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (MaND, MaTL),
                FOREIGN KEY (MaND) REFERENCES NGUOIDUNG(MaND),
                FOREIGN KEY (MaTL) REFERENCES TAILIEU(MaTL)
            )
        `);
        await createTableIfMissing('LICH_SU_XU', `
            CREATE TABLE LICH_SU_XU (
                MaGD INT AUTO_INCREMENT PRIMARY KEY,
                MaND INT NOT NULL,
                LoaiGiaoDich ENUM('NapXu', 'MuaTaiLieu', 'BanTaiLieu', 'TruXuAdmin', 'ThuongXu', 'HoanXu', 'PhatXu') NOT NULL,
                SoXuThayDoi INT NOT NULL,
                MoTa TEXT,
                NgayGiaoDich DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (MaND) REFERENCES NGUOIDUNG(MaND)
            )
        `);
        
        try {
            await pool.execute("ALTER TABLE LICH_SU_XU MODIFY COLUMN LoaiGiaoDich ENUM('NapXu', 'MuaTaiLieu', 'BanTaiLieu', 'TruXuAdmin', 'ThuongXu', 'HoanXu', 'PhatXu') NOT NULL");
            console.log("Updated ENUM for LICH_SU_XU.LoaiGiaoDich");
        } catch (e) {
            console.error("Error updating ENUM for LICH_SU_XU.LoaiGiaoDich", e.message);
        }

        await createTableIfMissing('YEU_CAU_GIAO_VIEN', `
            CREATE TABLE YEU_CAU_GIAO_VIEN (
                MaYeuCau INT AUTO_INCREMENT PRIMARY KEY,
                MaND INT NOT NULL,
                MinhChungURL VARCHAR(255) NOT NULL,
                TrangThai ENUM('ChoDuyet', 'DaDuyet', 'TuChoi') DEFAULT 'ChoDuyet',
                LyDoTuChoi TEXT DEFAULT NULL,
                NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP,
                NgayCapNhat DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (MaND) REFERENCES NGUOIDUNG(MaND)
            )
        `);
        
        await addColumnIfMissing('BINHLUAN', 'DaGhim', 'BOOLEAN DEFAULT FALSE');
        
        await addColumnIfMissing('NHOM', 'AnhBia', 'VARCHAR(255) DEFAULT NULL');
        
        await addColumnIfMissing('NHOM', 'IsPrivate', 'BOOLEAN DEFAULT FALSE');
        
        await createTableIfMissing('BAIVIET_NHOM', `
            CREATE TABLE BAIVIET_NHOM (
                MaBaiViet INT AUTO_INCREMENT PRIMARY KEY,
                MaND INT NOT NULL,
                MaNhom INT NOT NULL,
                NoiDung TEXT NOT NULL,
                NgayDang DATETIME DEFAULT CURRENT_TIMESTAMP,
                DaGhim BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (MaND) REFERENCES NGUOIDUNG(MaND) ON DELETE CASCADE,
                FOREIGN KEY (MaNhom) REFERENCES NHOM(MaNhom) ON DELETE CASCADE
            )
        `);
        
        await addColumnIfMissing('BAIVIET_NHOM', 'DaGhim', 'BOOLEAN DEFAULT FALSE');

        await createTableIfMissing('BINHLUAN_BAIVIET', `
            CREATE TABLE BINHLUAN_BAIVIET (
                MaBL INT AUTO_INCREMENT PRIMARY KEY,
                MaBaiViet INT NOT NULL,
                MaND INT NOT NULL,
                NoiDung TEXT NOT NULL,
                MaBL_Cha INT DEFAULT NULL,
                NgayBinhLuan DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (MaBaiViet) REFERENCES BAIVIET_NHOM(MaBaiViet) ON DELETE CASCADE,
                FOREIGN KEY (MaND) REFERENCES NGUOIDUNG(MaND) ON DELETE CASCADE,
                FOREIGN KEY (MaBL_Cha) REFERENCES BINHLUAN_BAIVIET(MaBL) ON DELETE CASCADE
            )
        `);
        
        await addColumnIfMissing('TAILIEU', 'TextSEO', 'TEXT');
    } finally {
        await pool.end();
    }
}

run().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
