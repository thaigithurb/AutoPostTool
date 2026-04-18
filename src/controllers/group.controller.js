const groupService = require('../services/group.service');

// POST /api/groups
exports.create = async (req, res, next) => {
    try {
        const group = await groupService.create(req.body);
        res.status(201).json({
            success: true,
            message: 'Tạo nhóm thành công',
            data: group,
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/groups
exports.getAll = async (req, res, next) => {
    try {
        const groups = await groupService.getAll();
        res.json({
            success: true,
            count: groups.length,
            data: groups,
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/groups/:id
exports.getById = async (req, res, next) => {
    try {
        const group = await groupService.getById(req.params.id);
        res.json({
            success: true,
            data: group,
        });
    } catch (error) {
        next(error);
    }
};

// PUT /api/groups/:id
exports.update = async (req, res, next) => {
    try {
        const group = await groupService.update(req.params.id, req.body);
        res.json({
            success: true,
            message: 'Cập nhật nhóm thành công',
            data: group,
        });
    } catch (error) {
        next(error);
    }
};

// DELETE /api/groups/:id
exports.delete = async (req, res, next) => {
    try {
        await groupService.delete(req.params.id);
        res.json({
            success: true,
            message: 'Xóa nhóm thành công',
        });
    } catch (error) {
        next(error);
    }
};
