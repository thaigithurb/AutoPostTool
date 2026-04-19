const express = require('express');
const cors = require('cors');

// Routes
const accountRoutes = require('./routes/account.routes');
const groupRoutes = require('./routes/group.routes');
const postRoutes = require('./routes/post.routes');
const uploadRoutes = require('./routes/upload.routes');
const groupSearchRoutes = require('./routes/group-search.routes');

// Middleware
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// ============================================================
// Global Middleware
// ============================================================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================
// API Routes
// ============================================================
app.use('/api/accounts', accountRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/group-search', groupSearchRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running 🚀',
        timestamp: new Date().toISOString(),
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} không tồn tại`,
    });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
