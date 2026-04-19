const postService = require('../services/post.service');

// POST /api/posts
exports.create = async (req, res, next) => {
    try {
        const post = await postService.create(req.body);
        res.status(201).json({
            success: true,
            message: 'Tạo bài viết thành công',
            data: post,
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/posts
exports.getAll = async (req, res, next) => {
    try {
        const filter = {};
        // Cho phép filter theo status và target_type qua query params
        if (req.query.status) filter.status = req.query.status;
        if (req.query.target_type) filter.target_type = req.query.target_type;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const [posts, totalPosts] = await Promise.all([
            postService.getAll(filter, { page, limit }),
            postService.count(filter)
        ]);

        res.json({
            success: true,
            pagination: {
                totalPosts,
                totalPages: Math.ceil(totalPosts / limit),
                currentPage: page,
                limit
            },
            data: posts,
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/posts/scheduled
exports.getScheduled = async (req, res, next) => {
    try {
        const posts = await postService.getScheduledPosts();
        res.json({
            success: true,
            count: posts.length,
            data: posts,
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/posts/:id
exports.getById = async (req, res, next) => {
    try {
        const post = await postService.getById(req.params.id);
        res.json({
            success: true,
            data: post,
        });
    } catch (error) {
        next(error);
    }
};

// PUT /api/posts/:id
exports.update = async (req, res, next) => {
    try {
        const post = await postService.update(req.params.id, req.body);
        res.json({
            success: true,
            message: 'Cập nhật bài viết thành công',
            data: post,
        });
    } catch (error) {
        next(error);
    }
};

// DELETE /api/posts/:id
exports.delete = async (req, res, next) => {
    try {
        await postService.delete(req.params.id);
        res.json({
            success: true,
            message: 'Xóa bài viết thành công',
        });
    } catch (error) {
        next(error);
    }
};
