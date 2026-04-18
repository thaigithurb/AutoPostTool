const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema(
    {
        group_id: {
            type: String,
            required: [true, 'Group ID là bắt buộc'],
            unique: true,
            trim: true,
        },
        name: {
            type: String,
            required: [true, 'Tên nhóm là bắt buộc'],
            trim: true,
        },
        joined_status: {
            type: String,
            enum: {
                values: ['joined', 'pending', 'not_joined'],
                message: 'joined_status phải là "joined", "pending" hoặc "not_joined"',
            },
            default: 'not_joined',
        },
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Group', groupSchema);
