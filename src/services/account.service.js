const Account = require('../models/Account');
const facebookAutomationService = require('./facebook-automation.service');
const facebookApiService = require('./facebook-api.service');
const telegramService = require('./telegram.service');

class AccountService {
    /**
     * Tạo tài khoản mới
     */
    async create(data) {
        // Nếu cookies là object, chuyển thành JSON string trước khi lưu
        if (data.cookies && typeof data.cookies === 'object') {
            data.cookies = JSON.stringify(data.cookies);
        }
        const account = new Account(data);
        return await account.save();
    }

    /**
     * Lấy tất cả tài khoản (đã ẩn dữ liệu nhạy cảm)
     */
    async getAll(filter = {}) {
        const accounts = await Account.find(filter).sort({ createdAt: -1 });
        return accounts.map((acc) => acc.toSafeJSON());
    }

    /**
     * Lấy tài khoản theo ID
     */
    async getById(id) {
        const account = await Account.findById(id);
        if (!account) {
            throw new Error('Không tìm thấy tài khoản');
        }
        return account;
    }

    /**
     * Cập nhật tài khoản
     */
    async update(id, data) {
        const account = await Account.findById(id);
        if (!account) {
            throw new Error('Không tìm thấy tài khoản');
        }

        // Nếu cookies là object, chuyển thành JSON string
        if (data.cookies && typeof data.cookies === 'object') {
            data.cookies = JSON.stringify(data.cookies);
        }

        // Cập nhật từng field (để trigger pre-save hook encrypt)
        Object.keys(data).forEach((key) => {
            account[key] = data[key];
        });

        return await account.save();
    }

    /**
     * Xóa tài khoản
     */
    async delete(id) {
        const account = await Account.findByIdAndDelete(id);
        if (!account) {
            throw new Error('Không tìm thấy tài khoản');
        }
        return account;
    }

    /**
     * Kiểm tra sức khỏe tài khoản (Health Check)
     * - Profile: Dùng Playwright mở browser kiểm tra cookies
     * - Page: Dùng Graph API kiểm tra access_token
     */
    async checkHealth(id) {
        const account = await Account.findById(id);
        if (!account) {
            throw new Error('Không tìm thấy tài khoản');
        }

        let healthResult;

        if (account.account_type === 'page') {
            // ── Page: Kiểm tra qua Graph API ──
            const token = account.getDecryptedToken();
            if (!token) {
                healthResult = {
                    healthy: false,
                    status: 'expired',
                    reason: 'Không có access_token.',
                };
            } else {
                const pageInfo = await facebookApiService.getPageInfo(token);
                if (pageInfo.success) {
                    healthResult = {
                        healthy: true,
                        status: 'healthy',
                        reason: `Token hoạt động bình thường. Page: ${pageInfo.data.name}`,
                    };
                } else {
                    healthResult = {
                        healthy: false,
                        status: pageInfo.error?.isTokenError ? 'expired' : 'expired',
                        reason: pageInfo.error?.message || 'Token không hợp lệ.',
                    };
                }
            }
        } else {
            // ── Profile: Kiểm tra qua Playwright ──
            const cookies = account.getPlaywrightCookies();
            if (!cookies) {
                healthResult = {
                    healthy: false,
                    status: 'expired',
                    reason: 'Không có cookies.',
                };
            } else {
                const proxy = account.getParsedProxy();
                healthResult = await facebookAutomationService.checkLogin(cookies, proxy);
            }
        }

        // ── Cập nhật DB ──
        account.health_status = healthResult.status;
        account.last_checked_at = new Date();
        await account.save();

        // ── Gửi thông báo Telegram nếu có vấn đề ──
        if (!healthResult.healthy) {
            await telegramService.notifyAccountIssue(account.name, healthResult.reason);
        }

        return {
            health_status: healthResult.status,
            healthy: healthResult.healthy,
            reason: healthResult.reason,
            last_checked_at: account.last_checked_at,
        };
    }

    /**
     * Đồng bộ danh sách Groups và Pages của tài khoản (chỉ dành cho Profile)
     */
    async syncTargets(id) {
        const account = await Account.findById(id);
        if (!account) {
            throw new Error('Không tìm thấy tài khoản');
        }

        if (account.account_type !== 'profile') {
            throw new Error('Chỉ có thể đồng bộ từ tài khoản Profile');
        }

        const cookies = account.getPlaywrightCookies();
        if (!cookies) {
            throw new Error('Không có cookies hợp lệ. Vui lòng cập nhật cookies trước.');
        }

        const proxy = account.getParsedProxy();

        // Lấy danh sách groups
        const groupsResult = await facebookAutomationService.fetchAccountGroups(cookies, proxy);
        if (groupsResult.success) {
            account.joined_groups = groupsResult.groups;
        } else {
            throw new Error('Lỗi đồng bộ Groups: ' + groupsResult.error);
        }

        // Lấy danh sách pages (có thể lỗi hoặc ko tìm thấy, ko quan trọng bằng groups nên ko throw error cứng)
        const pagesResult = await facebookAutomationService.fetchAccountPages(cookies, proxy);
        if (pagesResult.success) {
            account.managed_pages = pagesResult.pages;
        }

        await account.save();

        return {
            joined_groups: account.joined_groups,
            managed_pages: account.managed_pages
        };
    }
}

module.exports = new AccountService();
