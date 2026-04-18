const { Queue } = require('bullmq');
const { redis } = require('../config');

// ============================================================
// Queue đăng bài — tất cả post jobs đều đi qua đây
// ============================================================
const postQueue = new Queue('post-queue', {
    connection: {
        host: redis.host,
        port: redis.port,
        password: redis.password,
        maxRetriesPerRequest: null,
    },
    defaultJobOptions: {
        // ── Retry: tối đa 3 lần, mỗi lần cách 15 phút ──
        attempts: 3,
        backoff: {
            type: 'fixed',
            delay: 15 * 60 * 1000, // 15 phút = 900,000ms
        },
        // Xóa job đã hoàn thành sau 24h, giữ job lỗi 7 ngày
        removeOnComplete: {
            age: 24 * 60 * 60,
        },
        removeOnFail: {
            age: 7 * 24 * 60 * 60,
        },
    },
});

console.log('📮 Post Queue đã được khởi tạo');

module.exports = postQueue;
