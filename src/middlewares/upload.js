const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// ============================================================
// Cloudinary Storage — Multer sẽ upload thẳng lên Cloudinary
// ============================================================
const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'tool-auto-post', // Thư mục trên Cloudinary
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov'],
        // Tự động tạo public_id unique
        public_id: (req, file) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const nameWithoutExt = file.originalname.replace(/\.[^/.]+$/, '');
            return `${nameWithoutExt}-${uniqueSuffix}`;
        },
    },
});

/**
 * Upload middleware — nhiều file (tối đa 10)
 * Sử dụng: router.post('/upload', uploadMultiple, controller)
 */
const uploadMultiple = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // Max 10MB / file
        files: 10, // Max 10 files / request
    },
    fileFilter: (req, file, cb) => {
        // Chỉ cho phép ảnh và video
        if (
            file.mimetype.startsWith('image/') ||
            file.mimetype.startsWith('video/')
        ) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ hỗ trợ file ảnh (jpg, png, gif, webp) và video (mp4, mov)'), false);
        }
    },
}).array('media', 10); // field name = "media"

/**
 * Upload middleware — 1 file duy nhất
 * Sử dụng: router.post('/upload', uploadSingle, controller)
 */
const uploadSingle = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (
            file.mimetype.startsWith('image/') ||
            file.mimetype.startsWith('video/')
        ) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ hỗ trợ file ảnh và video'), false);
        }
    },
}).single('media'); // field name = "media"

module.exports = { uploadMultiple, uploadSingle };
