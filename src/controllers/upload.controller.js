const cloudinary = require('../config/cloudinary');

// POST /api/upload — Upload nhiều file
exports.uploadMedia = async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Không có file nào được upload',
            });
        }

        const results = req.files.map((file) => ({
            url: file.path, // Cloudinary URL
            public_id: file.filename, // Cloudinary public_id (dùng để xóa sau này)
            original_name: file.originalname,
            size: file.size,
        }));

        res.status(201).json({
            success: true,
            message: `Upload thành công ${results.length} file`,
            data: results,
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/upload/single — Upload 1 file
exports.uploadSingleMedia = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Không có file nào được upload',
            });
        }

        res.status(201).json({
            success: true,
            message: 'Upload thành công',
            data: {
                url: req.file.path,
                public_id: req.file.filename,
                original_name: req.file.originalname,
                size: req.file.size,
            },
        });
    } catch (error) {
        next(error);
    }
};

// DELETE /api/upload/:publicId — Xóa file trên Cloudinary
exports.deleteMedia = async (req, res, next) => {
    try {
        const { publicId } = req.params;

        const result = await cloudinary.uploader.destroy(
            `tool-auto-post/${publicId}`
        );

        if (result.result !== 'ok') {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy file hoặc đã bị xóa trước đó',
            });
        }

        res.json({
            success: true,
            message: 'Xóa file thành công',
        });
    } catch (error) {
        next(error);
    }
};
