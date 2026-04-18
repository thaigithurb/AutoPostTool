/**
 * Global Error Handler Middleware
 */
const errorHandler = (err, req, res, _next) => {
    console.error('❌ Error:', err.message);

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map((e) => e.message);
        return res.status(400).json({
            success: false,
            message: 'Dữ liệu không hợp lệ',
            errors: messages,
        });
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue).join(', ');
        return res.status(409).json({
            success: false,
            message: `Giá trị đã tồn tại cho trường: ${field}`,
        });
    }

    // Mongoose CastError (invalid ObjectId)
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: 'ID không hợp lệ',
        });
    }

    // Default error
    res.status(500).json({
        success: false,
        message: err.message || 'Lỗi máy chủ nội bộ',
    });
};

module.exports = errorHandler;
