const Group = require('../models/Group');

class GroupService {
    /**
     * Tạo nhóm mới
     */
    async create(data) {
        const group = new Group(data);
        return await group.save();
    }

    /**
     * Lấy tất cả nhóm
     */
    async getAll(filter = {}) {
        return await Group.find(filter)
            .populate('account', 'name platform account_type')
            .sort({ createdAt: -1 });
    }

    /**
     * Lấy nhóm theo ID
     */
    async getById(id) {
        const group = await Group.findById(id).populate(
            'account',
            'name platform account_type'
        );
        if (!group) {
            throw new Error('Không tìm thấy nhóm');
        }
        return group;
    }

    /**
     * Cập nhật nhóm
     */
    async update(id, data) {
        const group = await Group.findByIdAndUpdate(id, data, {
            new: true,
            runValidators: true,
        });
        if (!group) {
            throw new Error('Không tìm thấy nhóm');
        }
        return group;
    }

    /**
     * Xóa nhóm
     */
    async delete(id) {
        const group = await Group.findByIdAndDelete(id);
        if (!group) {
            throw new Error('Không tìm thấy nhóm');
        }
        return group;
    }
}

module.exports = new GroupService();
