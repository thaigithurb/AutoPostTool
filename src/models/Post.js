const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
    {
        content: {
            type: String,
            required: [true, 'Nội dung bài viết là bắt buộc'],
        },
        media_urls: {
            type: [String],
            default: [],
        },
        scheduled_at: {
            type: Date,
            default: null,
        },
        status: {
            type: String,
            enum: {
                values: ['pending', 'processing', 'success', 'failed'],
                message: 'status phải là "pending", "processing", "success" hoặc "failed"',
            },
            default: 'pending',
        },
        target_type: {
            type: String,
            enum: {
                values: ['page', 'group', 'profile'],
                message: 'target_type phải là "page", "group" hoặc "profile"',
            },
            required: [true, 'Loại mục tiêu là bắt buộc'],
        },
        target_id: {
            type: String,
            default: null,
        },
        target_name: {
            type: String,
            default: null,
        },
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            default: null,
        },
        error_message: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Index để query bài scheduled nhanh hơn
postSchema.index({ status: 1, scheduled_at: 1 });

module.exports = mongoose.model('Post', postSchema);
