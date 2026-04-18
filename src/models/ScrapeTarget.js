const mongoose = require('mongoose');

const scrapeTargetSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Tên nguồn là bắt buộc'],
            trim: true,
        },
        target_url: {
            type: String,
            trim: true,
            default: null,
        },
        target_id: {
            type: String,
            trim: true,
            default: null,
        },
        type: {
            type: String,
            enum: ['group', 'page', 'keyword_search', 'news_feed'],
            required: true,
        },
        account_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: [true, 'Phải chỉ định tài khoản dùng để cào'],
        },
        frequency_hours: {
            type: Number,
            default: 12, // Mặc định tự cào mỗi 12 tiếng
        },
        active: {
            type: Boolean,
            default: true,
        },
        last_scraped_at: {
            type: Date,
            default: null,
        },
        posts_found: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('ScrapeTarget', scrapeTargetSchema);
