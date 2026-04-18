const app = require('./src/app');
const connectDB = require('./src/config/db');
const { port } = require('./src/config');
const { startScheduler } = require('./src/schedulers/post.scheduler');
const { startScraperScheduler } = require('./src/schedulers/scraper.scheduler');

// Import Worker để nó bắt đầu lắng nghe Queue
require('./src/queues/post.worker');
require('./src/queues/scraper.worker');

const startServer = async () => {
    // Kết nối MongoDB
    await connectDB();

    // Khởi chạy server
    app.listen(port, () => {
        console.log(`🚀 Server is running on http://localhost:${port}`);
        console.log(`📋 Health check: http://localhost:${port}/api/health`);

        // Khởi chạy Scheduler sau khi server đã sẵn sàng
        startScheduler();
        startScraperScheduler();
        console.log('📡 Hệ thống lập lịch đăng bài và tự động cào đã hoạt động');
    });
};

startServer();

