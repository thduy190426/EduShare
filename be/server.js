require('dotenv').config();
const express = require('express');
const mysql   = require('mysql2/promise');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const cors    = require('cors');

const RESET   = '\x1b[0m';
const BOLD    = '\x1b[1m';
const DIM     = '\x1b[2m';
const WHITE   = '\x1b[97m';
const GRAY    = '\x1b[90m';
const CYAN    = '\x1b[36m';
const GREEN   = '\x1b[32m';
const YELLOW  = '\x1b[33m';
const RED     = '\x1b[31m';
const MAGENTA = '\x1b[35m';
const BG_CYAN    = '\x1b[46m';
const BG_GREEN   = '\x1b[42m';
const BG_YELLOW  = '\x1b[43m';
const BG_RED     = '\x1b[41m';
const BG_MAGENTA = '\x1b[45m';
const BG_BLUE    = '\x1b[44m';
const BG_GRAY    = '\x1b[100m';

const ts = () => {
    const n = new Date();
    const p = v => String(v).padStart(2, '0');
    return `${GRAY}${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}.${String(n.getMilliseconds()).padStart(3, '0')}${RESET}`;
};

const methodBadge = method => {
    const map = { GET: BG_CYAN, POST: BG_GREEN, PUT: BG_YELLOW, PATCH: BG_MAGENTA, DELETE: BG_RED };
    return `${map[method] || BG_GRAY}${BOLD}${WHITE} ${method.padEnd(7)} ${RESET}`;
};

const statusStyle = code =>
    code >= 500 ? [RED,    '✖'] :
    code >= 400 ? [YELLOW, '⚠'] :
    code >= 300 ? [CYAN,   '↪'] :
                  [GREEN,  '✔'];

const durationStr = ms => {
    const c = ms > 2000 ? RED : ms > 800 ? YELLOW : ms > 200 ? CYAN : GREEN;
    return ms >= 1000 ? `${c}${(ms / 1000).toFixed(2)}s${RESET}` : `${c}${ms}ms${RESET}`;
};

const truncate = (s, max = 80) => {
    const str = String(s ?? '');
    return str.length > max ? str.slice(0, max) + `${DIM}…${RESET}` : str;
};

const SENSITIVE = ['matkhau', 'password', 'token', 'secret', 'authorization'];
const formatBody = body => {
    if (!body || typeof body !== 'object' || !Object.keys(body).length) return null;
    return Object.entries(body)
        .map(([k, v]) => {
            const val = SENSITIVE.some(s => k.toLowerCase().includes(s))
                ? `${GRAY}[REDACTED]${RESET}`
                : truncate(JSON.stringify(v), 60);
            return `${DIM}    ${GRAY}${k}${RESET}: ${val}`;
        })
        .join('\n');
};

const logger = {
    info:    (msg, ...a) => console.log(`${ts()}  ${BG_BLUE}${BOLD}${WHITE}  INFO  ${RESET}  ${WHITE}${msg}${RESET}\n`, ...a),
    success: (msg, ...a) => console.log(`${ts()}  ${BG_GREEN}${BOLD}${WHITE}  OK    ${RESET}  ${GREEN}${msg}${RESET}\n`, ...a),
    warn:    (msg, ...a) => console.warn(`${ts()}  ${BG_YELLOW}${BOLD}${WHITE}  WARN  ${RESET}  ${YELLOW}${msg}${RESET}\n`, ...a),
    db:      (msg, ...a) => console.log(`${ts()}  ${BG_MAGENTA}${BOLD}${WHITE}  DB    ${RESET}  ${MAGENTA}${msg}${RESET}\n`, ...a),
    error: (msg, err) => {
        console.error(`${ts()}  ${BG_RED}${BOLD}${WHITE}  ERROR ${RESET}  ${RED}${msg}${RESET}\n`);
        if (err?.stack) console.error(`${DIM}${err.stack}${RESET}\n`);
    },
    divider: (label = '') => {
        const dash = '─'.repeat(label ? 44 - label.length : 50);
        console.log(label
            ? `${GRAY}──  ${CYAN}${label}  ${GRAY}${dash}${RESET}\n`
            : `${GRAY}${'─'.repeat(50)}${RESET}\n`);
    },
};

const logBanner = port => {
    const line = '─'.repeat(48);
    console.log(`\n${CYAN}${BOLD}┌${line}┐${RESET}`);
    console.log(`${CYAN}${BOLD}│${RESET}  ${GREEN}${BOLD}🚀          EduShare API Server${RESET}${' '.repeat(15)}${CYAN}${BOLD}│${RESET}`);
    console.log(`${CYAN}${BOLD}├${'─'.repeat(48)}┤${RESET}`);
    console.log(`${CYAN}${BOLD}│${RESET}  ${GRAY}Port   ${RESET}${BOLD}${WHITE}http://localhost:${port}${RESET}${' '.repeat(Math.max(0, 40 - 16 - String(port).length - 2))}${CYAN}${BOLD}│${RESET}`);
    console.log(`${CYAN}${BOLD}│${RESET}  ${GRAY}Env    ${RESET}${BOLD}${YELLOW}${(process.env.NODE_ENV || 'development')}${RESET}${' '.repeat(Math.max(0, 47 - (process.env.NODE_ENV || 'development').length - 8))}${CYAN}${BOLD}│${RESET}`);
    console.log(`${CYAN}${BOLD}│${RESET}  ${GRAY}Time   ${RESET}${BOLD}${WHITE}${new Date().toLocaleString('vi-VN')}${RESET}${' '.repeat(Math.max(0, 45 - new Date().toLocaleString('vi-VN').length - 6))}${CYAN}${BOLD}│${RESET}`);
    console.log(`${CYAN}${BOLD}└${line}┘${RESET}\n`);
};

const requestLogger = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const ms           = Date.now() - start;
        const [color, icon] = statusStyle(res.statusCode);
        console.log(
            `${ts()}  ${methodBadge(req.method)}  ${BOLD}${WHITE}${truncate(req.originalUrl, 60)}${RESET}  ${BOLD}${color}${icon} ${res.statusCode}${RESET}  ${durationStr(ms)}\n`
        );
        if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
            const b = formatBody(req.body);
            if (b) console.log(b + '\n');
        }
    });
    next();
};

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use('/uploads', express.static('public/uploads'));

const pool = mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASSWORD || 'duy1tran!?',
    database:           process.env.DB_NAME     || 'edushare_db',
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
});

pool.getConnection()
    .then(conn => { logger.db(`Connected to MySQL — database: ${process.env.DB_NAME || 'edushare_db'}`); conn.release(); })
    .catch(err  => logger.error('MySQL connection failed', err));

app.locals.pool = pool;

logger.divider('Routes');
const routes = [
    ['/api/documents',     require('./upload')],
    ['/api/admin',         require('./admin')],
    ['/api/users',         require('./users')],
    ['/api/notifications', require('./notifications')],
    ['/api/groups',        require('./groups')],
    ['/api/subjects',      require('./subjects')],
];
routes.forEach(([path, handler]) => {
    app.use(path, handler);
    logger.info(`Mounted  ${path}`);
});
logger.divider();

app.post('/api/register', async (req, res) => {
    const { hoTen, email, matKhau, vaiTro } = req.body;
    const allowedRoles   = ['SinhVien', 'GiaoVien'];
    const normalizedRole = allowedRoles.includes(vaiTro) ? vaiTro : 'SinhVien';

    if (!hoTen || !email || !matKhau)
        return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin.' });

    if (vaiTro && !allowedRoles.includes(vaiTro))
        return res.status(400).json({ message: 'Vai trò tài khoản không hợp lệ.' });

    try {
        const [rows] = await pool.execute('SELECT Email FROM NGUOIDUNG WHERE Email = ?', [email]);
        if (rows.length > 0)
            return res.status(409).json({ message: 'Email đã được sử dụng.' });

        const hashedPassword = await bcrypt.hash(matKhau, 10);
        const [result] = await pool.execute(
            'INSERT INTO NGUOIDUNG (HoTen, Email, MatKhau, VaiTro) VALUES (?, ?, ?, ?)',
            [hoTen, email, hashedPassword, normalizedRole]
        );

        logger.success(`New user registered — id: ${result.insertId}  role: ${normalizedRole}`);
        res.status(201).json({ message: 'Đăng ký thành công.', maND: result.insertId });

    } catch (err) {
        logger.error('Register failed', err);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, matKhau, rememberLogin } = req.body;

    if (!email || !matKhau)
        return res.status(400).json({ message: 'Vui lòng cung cấp email và mật khẩu.' });

    try {
        const [rows] = await pool.execute('SELECT * FROM NGUOIDUNG WHERE Email = ?', [email]);
        if (rows.length === 0)
            return res.status(404).json({ message: 'Email không tồn tại.' });

        const user = rows[0];

        if (user.TrangThai === 'BiKhoa') {
            logger.warn(`Blocked login attempt — email: ${email}`);
            return res.status(403).json({ message: 'Tài khoản của bạn đã bị khóa.' });
        }

        const isMatch = await bcrypt.compare(matKhau, user.MatKhau);
        if (!isMatch)
            return res.status(401).json({ message: 'Mật khẩu không chính xác.' });

        const token = jwt.sign(
            { MaND: user.MaND, VaiTro: user.VaiTro, HoTen: user.HoTen },
            process.env.JWT_SECRET,
            { expiresIn: rememberLogin ? '30d' : '24h' }
        );

        logger.success(`Login OK — id: ${user.MaND}  role: ${user.VaiTro}  remember: ${!!rememberLogin}`);
        res.status(200).json({ message: 'Đăng nhập thành công.', token, avatarURL: user.AvatarURL || null });

    } catch (err) {
        logger.error('Login failed', err);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => logBanner(PORT));
}

module.exports = app;
