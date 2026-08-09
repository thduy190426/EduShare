require('dotenv').config();
const express = require('express');
const http = require('http');
const { initSocket } = require('./services/socket');
const helmet = require('helmet');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { authMiddleware } = require('./middlewares/auth');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || '891380242693-mebda946u7bpcbbnjd8ro50lsaqp6unu.apps.googleusercontent.com');


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
});

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const WHITE = '\x1b[97m';
const GRAY = '\x1b[90m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';
const BG_CYAN = '\x1b[46m';
const BG_GREEN = '\x1b[42m';
const BG_YELLOW = '\x1b[43m';
const BG_RED = '\x1b[41m';
const BG_MAGENTA = '\x1b[45m';
const BG_BLUE = '\x1b[44m';
const BG_GRAY = '\x1b[100m';

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
    code >= 500 ? [RED, '✖'] :
        code >= 400 ? [YELLOW, '⚠'] :
            code >= 300 ? [CYAN, '↪'] :
                [GREEN, '✔'];

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
    info: (msg, ...a) => console.log(`${ts()}  ${BG_BLUE}${BOLD}${WHITE}  INFO  ${RESET}  ${WHITE}${msg}${RESET}\n`, ...a),
    success: (msg, ...a) => console.log(`${ts()}  ${BG_GREEN}${BOLD}${WHITE}  OK    ${RESET}  ${GREEN}${msg}${RESET}\n`, ...a),
    warn: (msg, ...a) => console.warn(`${ts()}  ${BG_YELLOW}${BOLD}${WHITE}  WARN  ${RESET}  ${YELLOW}${msg}${RESET}\n`, ...a),
    db: (msg, ...a) => console.log(`${ts()}  ${BG_MAGENTA}${BOLD}${WHITE}  DATABASE    ${RESET}  ${MAGENTA}${msg}${RESET}\n`, ...a),
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
    console.log(`${CYAN}${BOLD}│${RESET}  ${GREEN}${BOLD}          EduShare API Server${RESET}${' '.repeat(17)}${CYAN}${BOLD}│${RESET}`);
    console.log(`${CYAN}${BOLD}├${'─'.repeat(48)}┤${RESET}`);
    console.log(`${CYAN}${BOLD}│${RESET}  ${GRAY}Port   ${RESET}${BOLD}${WHITE}http://localhost:${port}${RESET}${' '.repeat(Math.max(0, 40 - 16 - String(port).length - 2))}${CYAN}${BOLD}│${RESET}`);
    console.log(`${CYAN}${BOLD}│${RESET}  ${GRAY}Env    ${RESET}${BOLD}${YELLOW}${(process.env.NODE_ENV || 'development')}${RESET}${' '.repeat(Math.max(0, 47 - (process.env.NODE_ENV || 'development').length - 8))}${CYAN}${BOLD}│${RESET}`);
    console.log(`${CYAN}${BOLD}│${RESET}  ${GRAY}Time   ${RESET}${BOLD}${WHITE}${new Date().toLocaleString('vi-VN')}${RESET}${' '.repeat(Math.max(0, 45 - new Date().toLocaleString('vi-VN').length - 6))}${CYAN}${BOLD}│${RESET}`);
    console.log(`${CYAN}${BOLD}└${line}┘${RESET}\n`);
};

const requestLogger = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const ms = Date.now() - start;
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

const app = express();
const server = http.createServer(app);
const io = initSocket(server, app);
app.set('io', io);

const PORT = process.env.PORT || 3000;

app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
    frameguard: false
}));
app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use('/uploads', express.static('public/uploads'));

const { loginLimiter, registerLimiter, contactLimiter } = require('./middlewares/rateLimit');

async function verifyRecaptcha(token) {
    if (process.env.NODE_ENV === 'test') return true;
    if (!token) return false;
    try {
        const response = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`
        });
        const data = await response.json();
        return data.success;
    } catch (err) {
        console.error('Lỗi xác thực reCAPTCHA:', err);
        return false;
    }
}

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'duy1tran!?',
    database: process.env.DB_NAME || 'edushare_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

pool.getConnection()
    .then(conn => { logger.db(`Connected to MySQL — database: ${process.env.DB_NAME || 'edushare_db'}`); conn.release(); })
    .catch(err => logger.error('MySQL connection failed', err));

app.locals.pool = pool;

const { initCronJobs } = require('./services/cronJobs');
if (process.env.NODE_ENV !== 'test') {
    initCronJobs(pool);
}

logger.divider('Routes');
const routes = [
    ['/api/documents', require('./upload')],
    ['/api/admin', require('./admin')],
    ['/api/users', require('./users')],
    ['/api/notifications', require('./notifications')],
    ['/api/groups', require('./groups')],
    ['/api/subjects', require('./subjects')],
    ['/api/payment', require('./payment')],
    ['/api/settings', require('./settings')],
    ['/api/chat', require('./chat')],
];
routes.forEach(([path, handler]) => {
    app.use(path, handler);
    logger.info(`Mounted  ${path}`);
});
logger.divider();

app.get('/api/config', (req, res) => {
    res.json({
        googleClientId: process.env.GOOGLE_CLIENT_ID,
        facebookAppId: process.env.FACEBOOK_APP_ID,
        recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY
    });
});

app.get('/api/truonghoc', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM TRUONGHOC');
        res.status(200).json({ truongHoc: rows });
    } catch (err) {
        logger.error('Fetch truonghoc failed', err);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

app.get('/api/khoanganh', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM KHOANGANH');
        res.status(200).json({ khoaNganh: rows });
    } catch (err) {
        logger.error('Fetch khoanganh failed', err);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

app.post('/api/register/send-otp', registerLimiter, async (req, res) => {
    const { email, hoTen, recaptchaToken } = req.body;

    const isHuman = await verifyRecaptcha(recaptchaToken);
    if (!isHuman) return res.status(400).json({ message: 'Xác thực Captcha thất bại.' });

    if (!email || !hoTen) return res.status(400).json({ message: 'Vui lòng cung cấp email và họ tên.' });

    try {
        const [rows] = await pool.execute('SELECT Email FROM NGUOIDUNG WHERE Email = ?', [email]);
        if (rows.length > 0) {
            return res.status(409).json({ message: 'Email đã được sử dụng.' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await pool.execute(
            'INSERT INTO REGISTER_OTP (Email, OTP, ExpiresAt) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE OTP = ?, ExpiresAt = ?',
            [email, otp, expiresAt, otp, expiresAt]
        );

        const mailOptions = {
            from: `"EduShare Support" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Mã OTP Đăng Ký Tài Khoản',
            html: generateOTPRegisterEmail(hoTen, otp)
        };

        await transporter.sendMail(mailOptions);
        logger.success(`Register OTP sent to ${email}`);
        res.status(200).json({ message: 'Mã OTP đã được gửi đến email của bạn.' });
    } catch (err) {
        logger.error('Send register OTP failed', err);
        res.status(500).json({ message: 'Lỗi khi gửi email. Vui lòng thử lại sau.' });
    }
});

app.post('/api/register', registerLimiter, async (req, res) => {
    const { hoTen, email, matKhau, truongHoc, khoaNganh, otp } = req.body;

    const normalizedRole = 'SinhVien';

    if (!hoTen || !email || !matKhau || !otp)
        return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin và mã OTP.' });

    try {
        const [otpRows] = await pool.execute('SELECT * FROM REGISTER_OTP WHERE Email = ? AND OTP = ?', [email, otp]);
        if (otpRows.length === 0) {
            return res.status(400).json({ message: 'Mã OTP không chính xác.' });
        }

        if (new Date() > new Date(otpRows[0].ExpiresAt)) {
            return res.status(400).json({ message: 'Mã OTP đã hết hạn.' });
        }

        const [rows] = await pool.execute('SELECT Email FROM NGUOIDUNG WHERE Email = ?', [email]);
        if (rows.length > 0)
            return res.status(409).json({ message: 'Email đã được sử dụng.' });

        const hashedPassword = await bcrypt.hash(matKhau, 10);
        const [result] = await pool.execute(
            'INSERT INTO NGUOIDUNG (HoTen, Email, MatKhau, VaiTro, TruongHoc, KhoaNganh) VALUES (?, ?, ?, ?, ?, ?)',
            [hoTen, email, hashedPassword, normalizedRole, truongHoc || null, khoaNganh || null]
        );

        await pool.execute('DELETE FROM REGISTER_OTP WHERE Email = ?', [email]);

        logger.success(`New user registered — id: ${result.insertId}  role: ${normalizedRole}`);
        res.status(201).json({ message: 'Đăng ký thành công.', maND: result.insertId });

    } catch (err) {
        logger.error('Register failed', err);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


app.post('/api/auth/google', loginLimiter, async (req, res) => {
    const { credential } = req.body;
    if (!credential) {
        return res.status(400).json({ message: 'Missing credential' });
    }

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const email = payload.email;
        const hoTen = payload.name;
        const avatar = payload.picture;

        const [users] = await pool.execute('SELECT * FROM NGUOIDUNG WHERE Email = ?', [email]);
        let user;
        if (users.length > 0) {
            user = users[0];
            if (user.TrangThai === 'BiKhoa') {
                return res.status(403).json({ message: 'Tài khoản của bạn đã bị khóa.' });
            }
            if (user.AuthType !== 'Google') {
                await pool.execute('UPDATE NGUOIDUNG SET AuthType = "Google" WHERE MaND = ?', [user.MaND]);
                user.AuthType = 'Google';
            }
        } else {
            const randomPassword = crypto.randomBytes(16).toString('hex');
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            const [result] = await pool.execute(
                'INSERT INTO NGUOIDUNG (HoTen, Email, MatKhau, VaiTro, AvatarURL, TrangThai, AuthType) VALUES (?, ?, ?, "SinhVien", ?, "HoatDong", "Google")',
                [hoTen, email, hashedPassword, avatar]
            );
            const [newUsers] = await pool.execute('SELECT * FROM NGUOIDUNG WHERE MaND = ?', [result.insertId]);
            user = newUsers[0];
            logger.success(`New user registered via Google - id: ${result.insertId}`);
        }

        const token = jwt.sign(
            { MaND: user.MaND, VaiTro: user.VaiTro, HoTen: user.HoTen, Email: user.Email, AvatarURL: user.AvatarURL },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        logger.success(`Google Login OK - id: ${user.MaND} role: ${user.VaiTro}`);

        res.json({
            message: 'Đăng nhập thành công',
            token,
            user: {
                MaND: user.MaND,
                HoTen: user.HoTen,
                VaiTro: user.VaiTro,
                AvatarURL: user.AvatarURL
            }
        });
    } catch (error) {
        logger.error('Google auth error', error);
        res.status(400).json({ message: 'Đăng nhập Google thất bại. Vui lòng thử lại.' });
    }
});

app.post('/api/auth/facebook', loginLimiter, async (req, res) => {
    const { accessToken } = req.body;
    if (!accessToken) {
        return res.status(400).json({ message: 'Missing Facebook access token' });
    }

    try {
        const response = await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`);
        const fbUser = await response.json();

        if (fbUser.error) {
            logger.error('Facebook Graph API error', fbUser.error);
            return res.status(400).json({ message: 'Đăng nhập Facebook thất bại.' });
        }

        const email = fbUser.email;
        const hoTen = fbUser.name;
        const avatar = fbUser.picture?.data?.url || null;

        if (!email) {
            return res.status(400).json({ message: 'Tài khoản Facebook của bạn không có email công khai. Vui lòng thêm email vào tài khoản Facebook hoặc sử dụng phương thức đăng nhập khác.' });
        }

        const [users] = await pool.execute('SELECT * FROM NGUOIDUNG WHERE Email = ?', [email]);
        let user;
        if (users.length > 0) {
            user = users[0];
            if (user.TrangThai === 'BiKhoa') {
                return res.status(403).json({ message: 'Tài khoản của bạn đã bị khóa.' });
            }
            if (user.AuthType !== 'Facebook') {
                await pool.execute('UPDATE NGUOIDUNG SET AuthType = "Facebook" WHERE MaND = ?', [user.MaND]);
                user.AuthType = 'Facebook';
            }
        } else {
            const randomPassword = crypto.randomBytes(16).toString('hex');
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            const [result] = await pool.execute(
                'INSERT INTO NGUOIDUNG (HoTen, Email, MatKhau, VaiTro, AvatarURL, TrangThai, AuthType) VALUES (?, ?, ?, "SinhVien", ?, "HoatDong", "Facebook")',
                [hoTen, email, hashedPassword, avatar]
            );
            const [newUsers] = await pool.execute('SELECT * FROM NGUOIDUNG WHERE MaND = ?', [result.insertId]);
            user = newUsers[0];
            logger.success(`New user registered via Facebook - id: ${result.insertId}`);
        }

        const token = jwt.sign(
            { MaND: user.MaND, VaiTro: user.VaiTro, HoTen: user.HoTen, Email: user.Email, AvatarURL: user.AvatarURL },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        logger.success(`Facebook Login OK - id: ${user.MaND} role: ${user.VaiTro}`);

        res.json({
            message: 'Đăng nhập thành công',
            token,
            user: {
                MaND: user.MaND,
                HoTen: user.HoTen,
                VaiTro: user.VaiTro,
                AvatarURL: user.AvatarURL
            }
        });
    } catch (error) {
        logger.error('Facebook auth error', error);
        res.status(400).json({ message: 'Đăng nhập Facebook thất bại. Vui lòng thử lại.' });
    }
});

app.post('/api/login', loginLimiter, async (req, res) => {
    const { email, matKhau, rememberLogin, recaptchaToken } = req.body;

    const isHuman = await verifyRecaptcha(recaptchaToken);
    if (!isHuman) return res.status(400).json({ message: 'Xác thực Captcha thất bại.' });

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

        if (user.IsTwoFactorEnabled) {
            const tempToken = jwt.sign(
                { MaND: user.MaND, rememberLogin: rememberLogin, temp: true },
                process.env.JWT_SECRET,
                { expiresIn: '5m' }
            );
            return res.status(200).json({
                message: 'Yêu cầu xác thực 2 bước.',
                require2FA: true,
                tempToken: tempToken
            });
        }

        const accessToken = jwt.sign(
            { MaND: user.MaND, VaiTro: user.VaiTro, HoTen: user.HoTen },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        const refreshToken = crypto.randomBytes(40).toString('hex');
        const expiresDays = rememberLogin ? 30 : 7;
        const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

        await pool.execute(
            'INSERT INTO REFRESH_TOKENS (MaND, Token, ExpiresAt) VALUES (?, ?, ?)',
            [user.MaND, refreshToken, expiresAt]
        );

        logger.success(`Login OK — id: ${user.MaND}  role: ${user.VaiTro}  remember: ${!!rememberLogin}`);
        res.status(200).json({
            message: 'Đăng nhập thành công.',
            token: accessToken,
            refreshToken: refreshToken,
            avatarURL: user.AvatarURL || null
        });

    } catch (err) {
        logger.error('Login failed', err);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

app.post('/api/auth/2fa/login', loginLimiter, async (req, res) => {
    const { tempToken, totpCode } = req.body;
    if (!tempToken || !totpCode) {
        return res.status(400).json({ message: 'Vui lòng cung cấp mã 2FA.' });
    }

    try {
        const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
        if (!decoded.temp) return res.status(400).json({ message: 'Token không hợp lệ.' });

        const [rows] = await pool.execute('SELECT * FROM NGUOIDUNG WHERE MaND = ?', [decoded.MaND]);
        if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });

        const user = rows[0];

        const verified = speakeasy.totp.verify({
            secret: user.TwoFactorSecret,
            encoding: 'base32',
            token: totpCode,
            window: 4
        });

        if (!verified) {
            return res.status(401).json({ message: 'Mã xác nhận 2FA không chính xác.' });
        }

        const accessToken = jwt.sign(
            { MaND: user.MaND, VaiTro: user.VaiTro, HoTen: user.HoTen },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        const refreshToken = crypto.randomBytes(40).toString('hex');
        const expiresDays = decoded.rememberLogin ? 30 : 7;
        const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

        await pool.execute(
            'INSERT INTO REFRESH_TOKENS (MaND, Token, ExpiresAt) VALUES (?, ?, ?)',
            [user.MaND, refreshToken, expiresAt]
        );

        logger.success(`2FA Login OK — id: ${user.MaND}`);
        res.status(200).json({
            message: 'Đăng nhập thành công.',
            token: accessToken,
            refreshToken: refreshToken,
            avatarURL: user.AvatarURL || null
        });

    } catch (err) {
        logger.error('2FA Login failed', err);
        return res.status(401).json({ message: 'Token hết hạn hoặc không hợp lệ.' });
    }
});

app.get('/api/auth/2fa/setup', authMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM NGUOIDUNG WHERE MaND = ?', [req.user.MaND]);
        if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy user' });

        const secret = speakeasy.generateSecret({ length: 20, name: `EduShare (${rows[0].Email})` });

        await pool.execute('UPDATE NGUOIDUNG SET TwoFactorSecret = ? WHERE MaND = ?', [secret.base32, req.user.MaND]);

        qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
            if (err) return res.status(500).json({ message: 'Lỗi tạo QR Code' });
            res.json({ qrCodeDataURL: data_url, secret: secret.base32 });
        });
    } catch (error) {
        logger.error('2FA Setup failed', error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
});

app.post('/api/auth/2fa/verify-setup', authMiddleware, async (req, res) => {
    const { token } = req.body;
    try {
        const [rows] = await pool.execute('SELECT TwoFactorSecret FROM NGUOIDUNG WHERE MaND = ?', [req.user.MaND]);
        if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy user' });

        const secret = rows[0].TwoFactorSecret;
        if (!secret) return res.status(400).json({ message: 'Chưa khởi tạo 2FA' });

        const verified = speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: 4
        });

        if (verified) {
            await pool.execute('UPDATE NGUOIDUNG SET IsTwoFactorEnabled = TRUE WHERE MaND = ?', [req.user.MaND]);
            res.json({ message: 'Xác thực 2 bước đã được bật thành công' });
        } else {
            res.status(400).json({ message: 'Mã xác thực không hợp lệ' });
        }
    } catch (error) {
        logger.error('2FA Verify Setup failed', error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
});

app.post('/api/auth/2fa/disable', authMiddleware, async (req, res) => {
    const { password } = req.body;
    try {
        const [rows] = await pool.execute('SELECT MatKhau, AuthType FROM NGUOIDUNG WHERE MaND = ?', [req.user.MaND]);
        if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy user' });
        const user = rows[0];

        if (user.AuthType === 'Local') {
            if (!password) return res.status(400).json({ message: 'Vui lòng nhập mật khẩu hiện tại.' });
            const isMatch = await bcrypt.compare(password, user.MatKhau);
            if (!isMatch) return res.status(401).json({ message: 'Mật khẩu không chính xác.' });
        }

        await pool.execute('UPDATE NGUOIDUNG SET IsTwoFactorEnabled = FALSE WHERE MaND = ?', [req.user.MaND]);
        res.json({ message: 'Xác thực 2 bước đã được tắt thành công' });
    } catch (error) {
        logger.error('2FA Disable failed', error);
        res.status(500).json({ message: 'Lỗi máy chủ' });
    }
});

app.post('/api/refresh-token', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: 'Thiếu Refresh Token.' });

    try {
        const [rows] = await pool.execute(
            'SELECT R.*, N.VaiTro, N.HoTen FROM REFRESH_TOKENS R JOIN NGUOIDUNG N ON R.MaND = N.MaND WHERE R.Token = ? AND R.Revoked = FALSE',
            [refreshToken]
        );

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Refresh Token không hợp lệ hoặc đã bị thu hồi.' });
        }

        const tokenData = rows[0];

        if (new Date() > new Date(tokenData.ExpiresAt)) {
            await pool.execute('UPDATE REFRESH_TOKENS SET Revoked = TRUE WHERE Id = ?', [tokenData.Id]);
            return res.status(401).json({ message: 'Refresh Token đã hết hạn. Vui lòng đăng nhập lại.' });
        }

        const newAccessToken = jwt.sign(
            { MaND: tokenData.MaND, VaiTro: tokenData.VaiTro, HoTen: tokenData.HoTen },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.status(200).json({ token: newAccessToken });

    } catch (err) {
        logger.error('Refresh token failed', err);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

app.post('/api/logout', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(200).json({ message: 'Đã đăng xuất.' });

    try {
        await pool.execute('UPDATE REFRESH_TOKENS SET Revoked = TRUE WHERE Token = ?', [refreshToken]);
        res.status(200).json({ message: 'Đăng xuất thành công.' });
    } catch (err) {
        logger.error('Logout failed', err);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

const generateOTPRegisterEmail = (hoTen, otp) => {
    return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Đăng ký tài khoản - EduShare</title>
  <style type="text/css">
    body {
      margin: 0; padding: 0; background: #F8FAFC; font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;
    }
    table, td { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    .container { width: 100%; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.04); overflow: hidden; }
    .header { padding: 40px 32px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; color: #4F46E5; }
    .content { padding: 0 32px 40px; color: #1E293B; }
    .content p { font-size: 15px; line-height: 1.6; margin-bottom: 20px; color: #334155; }
    .otp-box { background: #EEF2FF; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0; border: 1px dashed #4F46E5; }
    .otp-code { font-size: 32px; font-weight: 700; color: #4F46E5; letter-spacing: 4px; }
    .footer { padding: 24px 32px; background: #F8FAFC; text-align: center; border-top: 1px solid #E2E8F0; }
    .footer p { font-size: 13px; color: #64748B; line-height: 1.5; margin: 0; }
    @media only screen and (max-width: 600px) {
      .container { border-radius: 0; }
      .header { padding: 30px 20px 15px; }
      .content { padding: 0 20px 30px; }
    }
  </style>
</head>
<body>
  <table width="100%" cellspacing="0" cellpadding="0" border="0" align="center" bgcolor="#F8FAFC" style="padding: 40px 0;">
    <tbody>
      <tr>
        <td valign="top" align="center">
          <table class="container" cellspacing="0" cellpadding="0" border="0">
            <tbody>
              <tr>
                <td class="header">
                  <h1>EduShare</h1>
                </td>
              </tr>
              <tr>
                <td class="content">
                  <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px; color: #1E293B;">Xin chào, ${hoTen}!</h2>
                  <p>Cảm ơn bạn đã đăng ký tài khoản tại EduShare. Để hoàn tất quá trình đăng ký, vui lòng sử dụng mã xác thực OTP dưới đây:</p>
                  
                  <div class="otp-box">
                    <div class="otp-code">${otp}</div>
                  </div>
                  
                  <p>Mã xác thực này sẽ <strong>hết hạn sau 10 phút</strong>. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
                  
                  <p style="margin-top: 32px; margin-bottom: 0;">Trân trọng,<br><strong style="color: #4F46E5;">Đội ngũ EduShare</strong></p>
                </td>
              </tr>
              <tr>
                <td class="footer">
                  <p>© 2026 EduShare. Nền tảng chia sẻ tài liệu học tập lớn nhất Việt Nam.</p>
                  <p>Hỗ trợ: support@edushare.com</p>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;
};

const generateOTPResetEmail = (hoTen, otp) => {
    return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Khôi phục mật khẩu - EduShare</title>
  <style type="text/css">
    body {
      margin: 0; padding: 0; background: #F8FAFC; font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;
    }
    table, td { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    .container { width: 100%; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.04); overflow: hidden; }
    .header { padding: 40px 32px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; color: #4F46E5; }
    .content { padding: 0 32px 40px; color: #1E293B; }
    .content p { font-size: 15px; line-height: 1.6; margin-bottom: 20px; color: #334155; }
    .otp-box { background: #EEF2FF; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0; border: 1px dashed #4F46E5; }
    .otp-code { font-size: 32px; font-weight: 700; color: #4F46E5; letter-spacing: 4px; }
    .footer { padding: 24px 32px; background: #F8FAFC; text-align: center; border-top: 1px solid #E2E8F0; }
    .footer p { font-size: 13px; color: #64748B; line-height: 1.5; margin: 0; }
    @media only screen and (max-width: 600px) {
      .container { border-radius: 0; }
      .header { padding: 30px 20px 15px; }
      .content { padding: 0 20px 30px; }
    }
  </style>
</head>
<body>
  <table width="100%" cellspacing="0" cellpadding="0" border="0" align="center" bgcolor="#F8FAFC" style="padding: 40px 0;">
    <tbody>
      <tr>
        <td valign="top" align="center">
          <table class="container" cellspacing="0" cellpadding="0" border="0">
            <tbody>
              <tr>
                <td class="header">
                  <h1>EduShare</h1>
                </td>
              </tr>
              <tr>
                <td class="content">
                  <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px; color: #1E293B;">Xin chào, ${hoTen}!</h2>
                  <p>Chúng tôi nhận được yêu cầu khôi phục mật khẩu cho tài khoản EduShare của bạn. Dưới đây là mã xác thực OTP để hoàn tất quá trình thiết lập lại mật khẩu:</p>
                  
                  <div class="otp-box">
                    <div class="otp-code">${otp}</div>
                  </div>
                  
                  <p>Mã xác thực này sẽ <strong>hết hạn sau 10 phút</strong>. Vui lòng không chia sẻ mã này cho bất kỳ ai để đảm bảo an toàn cho tài khoản của bạn.</p>
                  
                  <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này. Tài khoản của bạn vẫn được an toàn.</p>
                  
                  <p style="margin-top: 32px; margin-bottom: 0;">Trân trọng,<br><strong style="color: #4F46E5;">Đội ngũ EduShare</strong></p>
                </td>
              </tr>
              <tr>
                <td class="footer">
                  <p>© 2026 EduShare. Nền tảng chia sẻ tài liệu học tập lớn nhất Việt Nam.</p>
                  <p>Hỗ trợ: support@edushare.com</p>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;
};

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Vui lòng cung cấp email.' });

    try {
        const [rows] = await pool.execute('SELECT * FROM NGUOIDUNG WHERE Email = ?', [email]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Email không tồn tại trong hệ thống.' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await pool.execute(
            'INSERT INTO RESET_PASSWORD_OTP (Email, OTP, ExpiresAt) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE OTP = ?, ExpiresAt = ?',
            [email, otp, expiresAt, otp, expiresAt]
        );

        const mailOptions = {
            from: `"EduShare Support" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Mã OTP Khôi Phục Mật Khẩu',
            html: generateOTPResetEmail(rows[0].HoTen, otp)
        };

        await transporter.sendMail(mailOptions);
        logger.success(`OTP sent to ${email}`);
        res.status(200).json({ message: 'Mã OTP đã được gửi đến email của bạn.' });

    } catch (err) {
        logger.error('Forgot password failed', err);
        res.status(500).json({ message: 'Lỗi khi gửi email. Vui lòng thử lại sau.' });
    }
});

app.post('/api/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Vui lòng cung cấp email và mã OTP.' });

    try {
        const [rows] = await pool.execute('SELECT * FROM RESET_PASSWORD_OTP WHERE Email = ? AND OTP = ?', [email, otp]);
        if (rows.length === 0) {
            return res.status(400).json({ message: 'Mã OTP không chính xác.' });
        }

        if (new Date() > new Date(rows[0].ExpiresAt)) {
            return res.status(400).json({ message: 'Mã OTP đã hết hạn.' });
        }

        res.status(200).json({ message: 'Mã OTP hợp lệ.' });
    } catch (err) {
        logger.error('Verify OTP failed', err);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

app.post('/api/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin.' });

    try {
        const [rows] = await pool.execute('SELECT * FROM RESET_PASSWORD_OTP WHERE Email = ? AND OTP = ?', [email, otp]);
        if (rows.length === 0) {
            return res.status(400).json({ message: 'Yêu cầu không hợp lệ. Vui lòng thử lại quá trình quên mật khẩu.' });
        }

        if (new Date() > new Date(rows[0].ExpiresAt)) {
            return res.status(400).json({ message: 'Mã OTP đã hết hạn.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.execute('UPDATE NGUOIDUNG SET MatKhau = ? WHERE Email = ?', [hashedPassword, email]);
        await pool.execute('DELETE FROM RESET_PASSWORD_OTP WHERE Email = ?', [email]);

        logger.success(`Password reset for ${email}`);
        res.status(200).json({ message: 'Mật khẩu đã được đặt lại thành công.' });
    } catch (err) {
        logger.error('Reset password failed', err);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

app.post('/api/contact', contactLimiter, async (req, res) => {
    const { name, email, subject, message, recaptchaToken } = req.body;

    const isHuman = await verifyRecaptcha(recaptchaToken);
    if (!isHuman) return res.status(400).json({ message: 'Xác thực Captcha thất bại.' });

    if (!name || !email || !subject || !message) {
        return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin.' });
    }

    try {
        const mailOptions = {
            from: `"${name}" <${email}>`,
            to: process.env.GMAIL_USER,
            subject: `[EduShare Liên Hệ] ${subject}`,
            html: `
        <div style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 16px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

                  <tr>
                    <td style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:32px 40px;text-align:center;">
                      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;"><i class="fa-solid fa-book"></i> EduShare</h1>
                      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Tin nhắn liên hệ mới từ website</p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:32px 40px;">

                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding-bottom:12px;">
                            <table width="100%" cellpadding="12" cellspacing="0" style="background:#f8f7ff;border-radius:8px;border-left:4px solid #4F46E5;">
                              <tr>
                                <td style="font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Họ và tên: </td>
                              </tr>
                              <tr>
                                <td style="font-size:15px;color:#111827;font-weight:600;padding-top:2px;">${name}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding-bottom:12px;">
                            <table width="100%" cellpadding="12" cellspacing="0" style="background:#f8f7ff;border-radius:8px;border-left:4px solid #4F46E5;">
                              <tr>
                                <td style="font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Email: </td>
                              </tr>
                              <tr>
                                <td style="font-size:15px;padding-top:2px;">
                                  <a href="mailto:${email}" style="color:#4F46E5;text-decoration:none;font-weight:600;">${email}</a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding-bottom:24px;">
                            <table width="100%" cellpadding="12" cellspacing="0" style="background:#f8f7ff;border-radius:8px;border-left:4px solid #4F46E5;">
                              <tr>
                                <td style="font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Chủ đề: </td>
                              </tr>
                              <tr>
                                <td style="font-size:15px;color:#111827;font-weight:600;padding-top:2px;">${subject}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <p style="margin:0 0 12px;font-size:13px;color:#6B7280;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Nội dung tin nhắn: </p>
                      <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:8px;padding:20px;font-size:15px;color:#374151;line-height:1.8;white-space:pre-wrap;">${message}</div>

                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                        <tr>
                          <td align="center">
                            <a href="mailto:${email}" style="display:inline-block;background:linear-gradient(135deg,#4F46E5,#7C3AED);color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;letter-spacing:0.3px;">
                              <i class="fa-solid fa-reply" style="margin-right: 5px;"></i>  Trả lời ngay
                            </a>
                          </td>
                        </tr>
                      </table>

                    </td>
                  </tr>

                  <tr>
                    <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
                      <p style="margin:0;font-size:12px;color:#9CA3AF;">Email này được gửi tự động từ hệ thống EduShare · Không trả lời trực tiếp email này</p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </div>
    `,
            replyTo: email
        };

        await transporter.sendMail(mailOptions);
        logger.success(`Contact email received from ${email}`);
        res.status(200).json({ message: 'Tin nhắn đã được gửi thành công!' });
    } catch (err) {
        logger.error('Failed to send contact email', err);
        res.status(500).json({ message: 'Không thể gửi tin nhắn lúc này. Vui lòng thử lại sau.' });
    }
});

if (process.env.NODE_ENV !== 'test') {
    server.listen(PORT, () => logBanner(PORT));
}

module.exports = { app, server };