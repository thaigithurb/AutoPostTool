const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');
const User = require('../models/User');

/**
 * Middleware xác thực người dùng qua JWT
 */
exports.protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Vui lòng đăng nhập để truy cập',
        });
    }

    try {
        // Decode token
        const decoded = jwt.verify(token, jwtSecret);

        // Lấy user từ DB
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user || !user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'Tài khoản không tồn tại hoặc đã bị khóa',
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Phiên làm việc hết hạn, vui lòng đăng nhập lại',
        });
    }
};

/**
 * Middleware giới hạn quyền Admin
 */
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền thực hiện hành động này',
            });
        }
        next();
    };
};
