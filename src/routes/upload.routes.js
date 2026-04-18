const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadMultiple, uploadSingle } = require('../middlewares/upload');
const uploadController = require('../controllers/upload.controller');

/**
 * Wrapper để bắt lỗi Multer (file quá lớn, định dạng sai, v.v.)
 */
const handleMulterError = (uploadMiddleware) => {
    return (req, res, next) => {
        uploadMiddleware(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                // Lỗi từ Multer (file quá lớn, quá nhiều file, v.v.)
                const messages = {
                    LIMIT_FILE_SIZE: 'File quá lớn (tối đa 10MB)',
                    LIMIT_FILE_COUNT: 'Quá nhiều file (tối đa 10)',
                    LIMIT_UNEXPECTED_FILE: 'Field name phải là "media"',
                };
                return res.status(400).json({
                    success: false,
                    message: messages[err.code] || `Lỗi upload: ${err.message}`,
                });
            }
            if (err) {
                // Lỗi khác (Cloudinary, định dạng file, v.v.)
                return res.status(400).json({
                    success: false,
                    message: err.message || 'Lỗi khi upload file',
                });
            }
            next();
        });
    };
};

// Upload nhiều file (max 10)
// Content-Type: multipart/form-data, field name: "media"
router.post('/', handleMulterError(uploadMultiple), uploadController.uploadMedia);

// Upload 1 file
// Content-Type: multipart/form-data, field name: "media"
router.post('/single', handleMulterError(uploadSingle), uploadController.uploadSingleMedia);

// Xóa file trên Cloudinary
router.delete('/:publicId', uploadController.deleteMedia);

module.exports = router;
