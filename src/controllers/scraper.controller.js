const scraperService = require('../services/scraper.service');
const Account = require('../models/Account');
const ScrapeTarget = require('../models/ScrapeTarget');
exports.scrape = async (req, res, next) => {
    try {
        const { accountId, groupId, limit = 10, category = 'Chung' } = req.body;

        if (!accountId) {
            return res.status(400).json({ success: false, message: 'accountId là bắt buộc' });
        }
        if (!groupId) {
            return res.status(400).json({ success: false, message: 'groupId là bắt buộc' });
        }

        // Lấy account từ DB
        const account = await Account.findById(accountId);
        if (!account) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
        }
        if (!account.is_active) {
            return res.status(400).json({ success: false, message: 'Tài khoản đã bị vô hiệu hóa' });
        }

        // Lấy cookies + proxy
        const cookies = account.getPlaywrightCookies();
        if (!cookies) {
            return res.status(400).json({ success: false, message: 'Tài khoản chưa có cookies' });
        }
        const proxy = account.getParsedProxy();

        // Cào bài
        const result = await scraperService.scrapeGroupPosts(
            cookies,
            groupId,
            proxy,
            parseInt(limit),
            category
        );

        if (!result.success) {
            return res.status(400).json({ success: false, message: result.error });
        }

        res.json({
            success: true,
            message: `Đã cào ${result.count} bài từ group "${result.groupName}"`,
            data: result.data,
            count: result.count,
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/scraper/posts — Lấy danh sách bài đã cào
exports.getPosts = async (req, res, next) => {
    try {
        const { category, is_bookmarked, group_id, search, page = 1, limit = 20 } = req.query;

        const filter = {};
        if (category) filter.category = category;
        if (is_bookmarked !== undefined) filter.is_bookmarked = is_bookmarked === 'true';
        if (group_id) filter.group_id = group_id;
        if (search) filter.search = search;

        const result = await scraperService.getScrapedPosts(
            filter,
            parseInt(page),
            parseInt(limit)
        );

        res.json({
            success: true,
            ...result,
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/scraper/categories — Lấy danh sách lĩnh vực
exports.getCategories = async (req, res, next) => {
    try {
        const categories = await scraperService.getCategories();
        res.json({ success: true, data: categories });
    } catch (error) {
        next(error);
    }
};

// PUT /api/scraper/posts/:id/bookmark — Toggle bookmark
exports.toggleBookmark = async (req, res, next) => {
    try {
        const post = await scraperService.toggleBookmark(req.params.id);
        res.json({
            success: true,
            message: post.is_bookmarked ? 'Đã bookmark' : 'Đã bỏ bookmark',
            data: post,
        });
    } catch (error) {
        next(error);
    }
};

// DELETE /api/scraper/posts/:id — Xóa bài đã cào
exports.deletePost = async (req, res, next) => {
    try {
        await scraperService.deleteScrapedPost(req.params.id);
        res.json({ success: true, message: 'Đã xóa bài viết' });
    } catch (error) {
        next(error);
    }
};

// ============================================================
// Scrape Target API (Cấu hình Cào Ngầm)
// ============================================================

exports.getTargets = async (req, res, next) => {
    try {
        const targets = await ScrapeTarget.find()
            .populate('account_id', 'name account_type')
            .sort({ createdAt: -1 });
        res.json({ success: true, count: targets.length, data: targets });
    } catch (error) {
        next(error);
    }
};

exports.createTarget = async (req, res, next) => {
    try {
        const { target_url, ...rest } = req.body;
        // Parse ID from URL using scraperService
        const target_id = scraperService.extractIdFbFromUrl(target_url);

        const target = await ScrapeTarget.create({
            ...rest,
            target_url,
            target_id,
        });

        res.status(201).json({ success: true, data: target });
    } catch (error) {
        next(error);
    }
};

exports.updateTarget = async (req, res, next) => {
    try {
        const { target_url, ...rest } = req.body;
        const updateData = { ...rest };

        if (target_url !== undefined) {
            updateData.target_url = target_url;
            updateData.target_id = scraperService.extractIdFbFromUrl(target_url);
        }

        const target = await ScrapeTarget.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!target) return res.status(404).json({ success: false, message: 'Không tìm thấy cấu hình' });

        res.json({ success: true, data: target });
    } catch (error) {
        next(error);
    }
};

exports.deleteTarget = async (req, res, next) => {
    try {
        const target = await ScrapeTarget.findByIdAndDelete(req.params.id);
        if (!target) return res.status(404).json({ success: false, message: 'Không tìm thấy cấu hình' });

        res.json({ success: true, message: 'Xóa cấu hình thành công' });
    } catch (error) {
        next(error);
    }
};
