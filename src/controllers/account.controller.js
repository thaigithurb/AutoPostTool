const accountService = require('../services/account.service');

// POST /api/accounts
exports.create = async (req, res, next) => {
    try {
        const account = await accountService.create(req.body);
        res.status(201).json({
            success: true,
            message: 'Tạo tài khoản thành công',
            data: account.toSafeJSON(),
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/accounts
exports.getAll = async (req, res, next) => {
    try {
        const accounts = await accountService.getAll();
        res.json({
            success: true,
            count: accounts.length,
            data: accounts,
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/accounts/:id
exports.getById = async (req, res, next) => {
    try {
        const account = await accountService.getById(req.params.id);
        res.json({
            success: true,
            data: account.toSafeJSON(),
        });
    } catch (error) {
        next(error);
    }
};

// PUT /api/accounts/:id
exports.update = async (req, res, next) => {
    try {
        const account = await accountService.update(req.params.id, req.body);
        res.json({
            success: true,
            message: 'Cập nhật tài khoản thành công',
            data: account.toSafeJSON(),
        });
    } catch (error) {
        next(error);
    }
};

// DELETE /api/accounts/:id
exports.delete = async (req, res, next) => {
    try {
        await accountService.delete(req.params.id);
        res.json({
            success: true,
            message: 'Xóa tài khoản thành công',
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/accounts/:id/check-health
exports.checkHealth = async (req, res, next) => {
    try {
        const result = await accountService.checkHealth(req.params.id);
        res.json({
            success: true,
            message: result.healthy
                ? 'Tài khoản hoạt động bình thường'
                : `Tài khoản có vấn đề: ${result.reason}`,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/accounts/:id/sync-targets
exports.syncTargets = async (req, res, next) => {
    try {
        const result = await accountService.syncTargets(req.params.id);
        res.json({
            success: true,
            message: 'Đồng bộ Groups/Pages thành công',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};
