const axios = require('axios');

// ============================================================
// Telegram Bot Service
// ============================================================
// Gửi thông báo trạng thái đăng bài qua Telegram Bot API
// Cần: TELEGRAM_BOT_TOKEN và TELEGRAM_CHAT_ID trong .env
// ============================================================

class TelegramService {
    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
        this.chatId = process.env.TELEGRAM_CHAT_ID || '';
        this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
    }

    /**
     * Kiểm tra Telegram đã cấu hình chưa
     */
    isConfigured() {
        return !!(this.botToken && this.chatId);
    }

    /**
     * Gửi tin nhắn Telegram (markdown format)
     * @param {string} text - Nội dung tin nhắn (Markdown)
     */
    async sendMessage(text) {
        if (!this.isConfigured()) {
            console.log('⚠️ [Telegram] Chưa cấu hình TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID');
            return;
        }

        try {
            await axios.post(`${this.baseUrl}/sendMessage`, {
                chat_id: this.chatId,
                text,
                parse_mode: 'Markdown',
                disable_web_page_preview: true,
            });
        } catch (error) {
            console.error('❌ [Telegram] Gửi tin nhắn thất bại:', error.message);
        }
    }

    /**
     * Thông báo đăng bài thành công
     */
    async notifyPostSuccess(post, targetInfo = '') {
        const content = post.content?.substring(0, 100) || '(không có nội dung)';
        const target = targetInfo || `${post.target_type} ${post.target_id || ''}`.trim();

        const message = [
            '✅ *Đăng bài thành công!*',
            '',
            `📍 *Đích:* ${target}`,
            `📝 *Nội dung:* ${this._escapeMarkdown(content)}${post.content?.length > 100 ? '...' : ''}`,
            `🖼 *Ảnh:* ${post.media_urls?.length || 0} ảnh`,
            `⏰ *Thời gian:* ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
        ].join('\n');

        await this.sendMessage(message);
    }

    /**
     * Thông báo đăng bài thất bại
     */
    async notifyPostFailed(post, error, attemptsMade = 0) {
        const content = post.content?.substring(0, 80) || '(không có nội dung)';
        const target = `${post.target_type} ${post.target_id || ''}`.trim();

        const message = [
            '❌ *Đăng bài thất bại!*',
            '',
            `📍 *Đích:* ${target}`,
            `📝 *Nội dung:* ${this._escapeMarkdown(content)}...`,
            `🔴 *Lỗi:* ${this._escapeMarkdown(error)}`,
            `🔄 *Số lần thử:* ${attemptsMade}/3`,
            `⏰ *Thời gian:* ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
        ].join('\n');

        await this.sendMessage(message);
    }

    /**
     * Thông báo tài khoản có vấn đề
     */
    async notifyAccountIssue(accountName, issue) {
        const message = [
            '⚠️ *Cảnh báo tài khoản!*',
            '',
            `👤 *Tài khoản:* ${this._escapeMarkdown(accountName)}`,
            `🔴 *Vấn đề:* ${this._escapeMarkdown(issue)}`,
            `⏰ *Thời gian:* ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
            '',
            '💡 Vui lòng cập nhật cookies mới.',
        ].join('\n');

        await this.sendMessage(message);
    }

    /**
     * Escape markdown special characters
     */
    _escapeMarkdown(text) {
        if (!text) return '';
        return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
    }
}

module.exports = new TelegramService();
