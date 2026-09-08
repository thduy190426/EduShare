const { sendNotificationToUser } = require('./socket');
const nodemailer = require('nodemailer');

let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
}

const getUserNotificationPrefs = async (pool, maND) => {
    try {
        const [rows] = await pool.execute('SELECT NotificationPrefs FROM NGUOIDUNG WHERE MaND = ?', [maND]);
        let prefs = {};
        if (rows.length > 0 && rows[0].NotificationPrefs) {
            prefs = typeof rows[0].NotificationPrefs === 'string' 
                ? JSON.parse(rows[0].NotificationPrefs) 
                : rows[0].NotificationPrefs;
        }
        const defaultPrefs = {
            push_comment: true,
            push_mention: true,
            push_purchase: true,
            push_follow: true,
            email_purchase: false
        };

        return { ...defaultPrefs, ...prefs };
    } catch (err) {
        console.error('Lỗi khi lấy NotificationPrefs:', err);
        return {
            push_comment: true,
            push_mention: true,
            push_purchase: true,
            push_follow: true,
            email_purchase: false
        };
    }
};

/**
 * Lấy email của người dùng
 */
const getUserEmail = async (pool, maND) => {
    try {
        const [rows] = await pool.execute('SELECT Email, HoTen FROM NGUOIDUNG WHERE MaND = ?', [maND]);
        if (rows.length > 0) {
            return rows[0];
        }
        return null;
    } catch (err) {
        console.error('Lỗi khi lấy Email:', err);
        return null;
    }
};

/**
 * Gửi email thông báo
 */
const sendEmailNotification = async (toEmail, subject, text, html) => {
    if (!transporter) {
        console.log(`[Email] Chưa cấu hình email. Giả lập gửi tới: ${toEmail} | Subject: ${subject}`);
        return;
    }
    
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: toEmail,
            subject: subject,
            text: text,
            html: html || text
        });
        console.log(`[Email] Đã gửi thông báo tới ${toEmail}`);
    } catch (err) {
        console.error('[Email] Lỗi khi gửi mail:', err);
    }
};

/**
 * Hàm wrapper để tạo và gửi thông báo, có kiểm tra cài đặt của user
 * @param {Object} pool Connection pool
 * @param {Number} maND ID người dùng nhận thông báo
 * @param {String} loaiTB Loại thông báo (new_notification, document_bought, v.v)
 * @param {String} noiDung Nội dung thông báo
 * @param {String} linkDich Link chuyển hướng
 * @param {String} eventType Phân loại sự kiện để kiểm tra prefs (comment, mention, purchase, follow, system)
 */
const createAndSendNotification = async (pool, maND, loaiTB, noiDung, linkDich, eventType) => {
    try {
        const userPrefs = await getUserNotificationPrefs(pool, maND);
        
        let shouldPush = true;
        let shouldEmail = false;

        if (eventType === 'comment' && userPrefs.push_comment === false) shouldPush = false;
        if (eventType === 'mention' && userPrefs.push_mention === false) shouldPush = false;
        if (eventType === 'purchase' && userPrefs.push_purchase === false) shouldPush = false;
        if (eventType === 'follow' && userPrefs.push_follow === false) shouldPush = false;
        if (eventType === 'purchase' && userPrefs.email_purchase === true) shouldEmail = true;

        if (shouldPush) {
            await pool.execute(
                'INSERT INTO THONGBAO (MaND, LoaiTB, NoiDung, LinkDich) VALUES (?, ?, ?, ?)',
                [maND, loaiTB || 'HeThong', noiDung, linkDich || null]
            );
            sendNotificationToUser(maND, loaiTB || 'new_notification', { message: noiDung, link: linkDich });
        }

        if (shouldEmail) {
            const userInfo = await getUserEmail(pool, maND);
            if (userInfo && userInfo.Email) {
                const subject = 'EduShare - Thông báo mới';
                const html = `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                        <h2>Xin chào ${userInfo.HoTen},</h2>
                        <p>${noiDung}</p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 12px; color: #777;">Bạn nhận được email này vì bạn đã bật tuỳ chọn nhận thông báo qua email trong phần Cài đặt.</p>
                    </div>
                `;
                await sendEmailNotification(userInfo.Email, subject, noiDung, html);
            }
        }
    } catch (err) {
        console.error('Lỗi trong createAndSendNotification:', err);
    }
};

module.exports = {
    getUserNotificationPrefs,
    createAndSendNotification
};
