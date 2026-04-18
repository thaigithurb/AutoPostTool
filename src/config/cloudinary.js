const { v2: cloudinary } = require('cloudinary');
const { cloudinary: cloudConfig } = require('./index');

// ============================================================
// Cấu hình Cloudinary
// ============================================================
cloudinary.config({
    cloud_name: cloudConfig.cloudName,
    api_key: cloudConfig.apiKey,
    api_secret: cloudConfig.apiSecret,
});

module.exports = cloudinary;
