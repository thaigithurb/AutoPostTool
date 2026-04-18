const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

// ============================================================
// Cookie Schema — Chuẩn EditThisCookie JSON array format
// ============================================================
// Ví dụ 1 cookie từ EditThisCookie:
// {
//   "domain": ".facebook.com",
//   "expirationDate": 1745000000,
//   "hostOnly": false,
//   "httpOnly": true,
//   "name": "c_user",
//   "path": "/",
//   "sameSite": "no_restriction",
//   "secure": true,
//   "session": false,
//   "storeId": "0",
//   "value": "10005xxxxxxx",
//   "id": 1
// }
// ============================================================
const cookieSchema = new mongoose.Schema(
    {
        domain: { type: String, required: true },
        expirationDate: { type: Number, default: null },
        hostOnly: { type: Boolean, default: false },
        httpOnly: { type: Boolean, default: false },
        name: { type: String, required: true },
        path: { type: String, default: '/' },
        sameSite: {
            type: String,
            enum: ['no_restriction', 'lax', 'strict', 'unspecified'],
            default: 'no_restriction',
        },
        secure: { type: Boolean, default: false },
        session: { type: Boolean, default: false },
        storeId: { type: String, default: '0' },
        value: { type: String, required: true },
        id: { type: Number, default: null },
    },
    { _id: false }
);

const accountSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Tên tài khoản là bắt buộc'],
            trim: true,
        },
        platform: {
            type: String,
            enum: ['facebook'],
            default: 'facebook',
        },
        account_type: {
            type: String,
            enum: {
                values: ['profile', 'page'],
                message: 'account_type phải là "profile" hoặc "page"',
            },
            required: [true, 'Loại tài khoản là bắt buộc'],
        },
        access_token: {
            type: String,
            default: null,
        },
        // Lưu dưới dạng encrypted JSON string của cookie array
        cookies: {
            type: String,
            default: null,
        },
        is_active: {
            type: Boolean,
            default: true,
        },
        // Proxy format: http://username:password@ip:port
        proxy: {
            type: String,
            default: null,
            trim: true,
        },
        // ── Health Check ──
        health_status: {
            type: String,
            enum: ['unknown', 'healthy', 'expired', 'checkpoint'],
            default: 'unknown',
        },
        last_checked_at: {
            type: Date,
            default: null,
        },
        // ── Smart Target Selection ──
        joined_groups: [
            {
                id: String,
                name: String,
            },
        ],
        managed_pages: [
            {
                id: String,
                name: String,
            },
        ],
    },
    {
        timestamps: true,
    }
);

// ============================================================
// Pre-save hook: Validate cookies array & encrypt dữ liệu nhạy cảm
// ============================================================
accountSchema.pre('save', function (next) {
    // Encrypt access_token
    if (this.isModified('access_token') && this.access_token) {
        this.access_token = encrypt(this.access_token);
    }

    // Validate & encrypt cookies
    if (this.isModified('cookies') && this.cookies) {
        try {
            // Nếu nhận vào là array/object → chuyển thành JSON string
            let cookieData = this.cookies;
            if (typeof cookieData !== 'string') {
                cookieData = JSON.stringify(cookieData);
            }

            // Validate cấu trúc: phải là JSON array
            const parsed = JSON.parse(cookieData);
            if (!Array.isArray(parsed)) {
                return next(new Error('cookies phải là JSON array (chuẩn EditThisCookie)'));
            }

            // Validate từng cookie qua cookieSchema
            for (const [index, cookie] of parsed.entries()) {
                if (!cookie.domain || !cookie.name || cookie.value === undefined) {
                    return next(
                        new Error(
                            `Cookie[${index}] thiếu field bắt buộc (domain, name, value)`
                        )
                    );
                }
            }

            // Encrypt JSON string
            this.cookies = encrypt(cookieData);
        } catch (error) {
            if (error.message.includes('cookies phải là') || error.message.includes('Cookie[')) {
                return next(error);
            }
            return next(new Error('cookies không phải JSON hợp lệ'));
        }
    }

    next();
});

// ============================================================
// Instance methods
// ============================================================

/**
 * Giải mã access_token
 * @returns {string|null}
 */
accountSchema.methods.getDecryptedToken = function () {
    if (!this.access_token) return null;
    try {
        return decrypt(this.access_token);
    } catch (error) {
        console.error('Lỗi giải mã access_token:', error.message);
        return null;
    }
};

/**
 * Giải mã cookies — trả về JSON array chuẩn EditThisCookie
 * @returns {Array|null}
 */
accountSchema.methods.getDecryptedCookies = function () {
    if (!this.cookies) return null;
    try {
        const decrypted = decrypt(this.cookies);
        return JSON.parse(decrypted);
    } catch (error) {
        console.error('Lỗi giải mã cookies:', error.message);
        return null;
    }
};

/**
 * Chuyển cookies sang định dạng Playwright — sẵn sàng inject vào
 * browserContext.addCookies()
 *
 * Mapping:
 *   EditThisCookie           →  Playwright
 *   ─────────────────────────────────────────
 *   domain                   →  domain
 *   name                     →  name
 *   value                    →  value
 *   path                     →  path
 *   expirationDate (epoch s) →  expires (epoch s)
 *   httpOnly                 →  httpOnly
 *   secure                   →  secure
 *   sameSite                 →  sameSite ("Strict"|"Lax"|"None")
 *
 * @returns {Array|null} — Mảng cookies tương thích Playwright
 */
accountSchema.methods.getPlaywrightCookies = function () {
    const cookies = this.getDecryptedCookies();
    if (!cookies) return null;

    const sameSiteMap = {
        no_restriction: 'None',
        lax: 'Lax',
        strict: 'Strict',
        unspecified: 'None',
    };

    return cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || '/',
        expires: c.expirationDate || -1,
        httpOnly: !!c.httpOnly,
        secure: !!c.secure,
        sameSite: sameSiteMap[c.sameSite] || 'None',
    }));
};

/**
 * Chuyển account thành JSON an toàn (ẩn dữ liệu nhạy cảm)
 */
accountSchema.methods.toSafeJSON = function () {
    const obj = this.toObject();
    obj.access_token = obj.access_token ? '******' : null;
    obj.cookies = obj.cookies ? '******' : null;
    obj.proxy = obj.proxy ? obj.proxy.replace(/\/\/.*@/, '//***:***@') : null;
    // Include health check fields
    obj.health_status = obj.health_status || 'unknown';
    obj.last_checked_at = obj.last_checked_at || null;
    obj.joined_groups = obj.joined_groups || [];
    obj.managed_pages = obj.managed_pages || [];
    return obj;
};

/**
 * Parse proxy string thành object tương thích Playwright
 * Input:  "http://username:password@ip:port"
 * Output: { server: "http://ip:port", username: "...", password: "..." }
 *
 * @returns {object|null}
 */
accountSchema.methods.getParsedProxy = function () {
    if (!this.proxy) return null;
    try {
        const url = new URL(this.proxy);
        return {
            server: `${url.protocol}//${url.hostname}:${url.port}`,
            username: url.username || undefined,
            password: url.password || undefined,
        };
    } catch (error) {
        console.error('Lỗi parse proxy:', error.message);
        return null;
    }
};

module.exports = mongoose.model('Account', accountSchema);
