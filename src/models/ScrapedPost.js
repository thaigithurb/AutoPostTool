const mongoose = require('mongoose');

const scrapedPostSchema = new mongoose.Schema(
    {
        group_id: {
            type: String,
            required: [true, 'Group ID là bắt buộc'],
        },
        group_name: {
            type: String,
            default: '',
        },
        author_name: {
            type: String,
            default: 'Không rõ',
        },
        content: {
            type: String,
            required: [true, 'Nội dung bài viết là bắt buộc'],
        },
        media_urls: {
            type: [String],
            default: [],
        },
        original_url: {
            type: String,
            default: null,
        },
        scraped_at: {
            type: Date,
            default: Date.now,
        },
        category: {
            type: String,
            default: 'Chung',
            trim: true,
        },
        is_bookmarked: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// Index để query nhanh theo category và bookmark
scrapedPostSchema.index({ category: 1, is_bookmarked: -1, scraped_at: -1 });

module.exports = mongoose.model('ScrapedPost', scrapedPostSchema);
