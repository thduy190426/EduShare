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

        await addColumnIfMissing('YEU_CAU_GIAO_VIEN', 'LyDoTuChoi', 'TEXT DEFAULT NULL');

        await addColumnIfMissing('BINHLUAN', 'DaGhim', 'BOOLEAN DEFAULT FALSE');
        await addColumnIfMissing('BINHLUAN', 'DaChinhSua', 'BOOLEAN DEFAULT FALSE');

        await addColumnIfMissing('NHOM', 'AnhBia', 'VARCHAR(255) DEFAULT NULL');

        await addColumnIfMissing('NHOM', 'IsPrivate', 'BOOLEAN DEFAULT FALSE');

        await addColumnIfMissing('TINNHAN', 'LoaiTinNhan', "ENUM('text', 'image', 'file') DEFAULT 'text'");
        await addColumnIfMissing('TINNHAN', 'DaThuHoi', 'BOOLEAN DEFAULT FALSE');
        await addColumnIfMissing('TINNHAN', 'DaChinhSua', 'BOOLEAN DEFAULT FALSE');

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

        await createTableIfMissing('AUDIT_LOG', `
            CREATE TABLE AUDIT_LOG (
                MaLog INT AUTO_INCREMENT PRIMARY KEY,
                MaND_ThucHien INT NOT NULL,
                MaND_BiTacDong INT DEFAULT NULL,
                HanhDong VARCHAR(100) NOT NULL,
                ChiTiet TEXT NOT NULL,
                IPAddress VARCHAR(45) DEFAULT NULL,
                NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (MaND_ThucHien) REFERENCES NGUOIDUNG(MaND),
                FOREIGN KEY (MaND_BiTacDong) REFERENCES NGUOIDUNG(MaND)
            )
        `);

        await createTableIfMissing('NHIEMVU', `
            CREATE TABLE NHIEMVU (
                MaNV INT AUTO_INCREMENT PRIMARY KEY,
                TenNV VARCHAR(255) NOT NULL,
                MoTa TEXT,
                LoaiNV VARCHAR(100) NOT NULL,
                MucTieu INT NOT NULL DEFAULT 1,
                ThuongXu INT NOT NULL DEFAULT 0,
                TanSuat ENUM('HangNgay', 'HangTuan', 'MotLan') DEFAULT 'HangNgay',
                TrangThai ENUM('HoatDong', 'TamAn') DEFAULT 'HoatDong',
                NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const [quests] = await pool.execute('SELECT COUNT(*) as count FROM NHIEMVU');
        if (quests[0].count === 0) {
            await pool.execute(`
                INSERT INTO NHIEMVU (TenNV, MoTa, LoaiNV, MucTieu, ThuongXu, TanSuat) VALUES 
                ('Đăng nhập hằng ngày', 'Đăng nhập vào hệ thống mỗi ngày', 'DangNhap', 1, 5, 'HangNgay'),
                ('Đánh giá tài liệu', 'Đánh giá 1 tài liệu bất kỳ để giúp cộng đồng', 'DanhGia', 1, 10, 'HangNgay'),
                ('Tham gia thảo luận', 'Bình luận hoặc trả lời 5 bài viết trong tuần', 'BinhLuanNhom', 5, 50, 'HangTuan'),
                ('Cập nhật hồ sơ', 'Hoàn thiện thông tin cá nhân của bạn', 'CapNhatHoSo', 1, 20, 'MotLan'),
                ('Mua tài liệu Premium', 'Mở khóa 1 tài liệu Premium bằng EduCoin', 'MuaTaiLieu', 1, 30, 'HangNgay'),
                ('Đăng tải tài liệu', 'Chia sẻ 2 tài liệu hữu ích lên cộng đồng', 'UpTaiLieu', 2, 150, 'HangTuan')
            `);
            console.log('Inserted default quests');
        }

        await createTableIfMissing('TIENDO_NHIEMVU', `
            CREATE TABLE TIENDO_NHIEMVU (
                MaND INT NOT NULL,
                MaNV INT NOT NULL,
                TienDo INT DEFAULT 0,
                TrangThai ENUM('DangLam', 'ChoNhan', 'DaNhan') DEFAULT 'DangLam',
                NgayCapNhat DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (MaND, MaNV),
                FOREIGN KEY (MaND) REFERENCES NGUOIDUNG(MaND) ON DELETE CASCADE,
                FOREIGN KEY (MaNV) REFERENCES NHIEMVU(MaNV) ON DELETE CASCADE
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
