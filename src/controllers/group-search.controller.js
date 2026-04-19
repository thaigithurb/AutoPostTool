const groupSearchService = require('../services/group-search.service');
const Account = require('../models/Account');

// ============================================================
// Group Search Controller
// ============================================================

/**
 * POST /api/group-search/search
 * Body: { accountId, groupIds, keyword, maxResults? }
 */
exports.search = async (req, res, next) => {
    try {
        const { accountId, groupIds, keyword, maxResults = 20, isRecent = true } = req.body;

        // Validate input
        if (!accountId) {
            return res.status(400).json({ success: false, message: 'Thiếu accountId' });
        }
        if (!keyword || keyword.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Thiếu keyword tìm kiếm' });
        }
        if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Thiếu danh sách group để tìm' });
        }

        // Get account & cookies
        const account = await Account.findById(accountId);
        if (!account || !account.is_active) {
            return res.status(404).json({ success: false, message: 'Tài khoản không tồn tại hoặc đã bị tắt' });
        }

        const cookies = account.getPlaywrightCookies();
        if (!cookies || cookies.length === 0) {
            return res.status(400).json({ success: false, message: 'Tài khoản này chưa có cookies' });
        }

        const proxy = account.getParsedProxy();

        // Execute search
        const result = await groupSearchService.searchGroups(
            cookies,
            groupIds,
            keyword.trim(),
            proxy,
            maxResults,
            isRecent
        );

        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error });
        }

        return res.json({
            success: true,
            data: result.data,
            count: result.count,
        });
    } catch (error) {
        next(error);
    }
};
