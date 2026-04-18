const Post = require('../models/Post');

class PostService {
    /**
     * Tạo bài viết mới
     */
    async create(data) {
        const post = new Post(data);
        return await post.save();
    }

    /**
     * Lấy tất cả bài viết
     */
    async getAll(filter = {}) {
        return await Post.find(filter)
            .populate('account', 'name platform account_type')
            .sort({ createdAt: -1 });
    }

    /**
     * Lấy bài viết theo ID
     */
    async getById(id) {
        const post = await Post.findById(id).populate(
            'account',
            'name platform account_type'
        );
        if (!post) {
            throw new Error('Không tìm thấy bài viết');
        }
        return post;
    }

    /**
     * Cập nhật bài viết
     */
    async update(id, data) {
        const post = await Post.findByIdAndUpdate(id, data, {
            new: true,
            runValidators: true,
        });
        if (!post) {
            throw new Error('Không tìm thấy bài viết');
        }
        return post;
    }

    /**
     * Xóa bài viết
     */
    async delete(id) {
        const post = await Post.findByIdAndDelete(id);
        if (!post) {
            throw new Error('Không tìm thấy bài viết');
        }
        return post;
    }

    /**
     * Lấy danh sách bài viết đã lên lịch (pending & đến hạn đăng)
     */
    async getScheduledPosts() {
        return await Post.find({
            status: 'pending',
            scheduled_at: { $lte: new Date() },
        })
            .populate('account', 'name platform account_type')
            .sort({ scheduled_at: 1 });
    }
}

module.exports = new PostService();
