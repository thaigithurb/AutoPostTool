const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const { port } = require('./src/config');
const { startScheduler } = require('./src/schedulers/post.scheduler');
const { startHealthScheduler } = require('./src/schedulers/health.scheduler');
const socketIO = require('./src/utils/socket');

// Import Worker để nó bắt đầu lắng nghe Queue
require('./src/queues/post.worker');

const server = http.createServer(app);

// Khởi tạo Socket.io
socketIO.init(server);

const startServer = async () => {
    // Kết nối MongoDB
    await connectDB();

    // Khởi chạy server
    server.listen(port, () => {
        console.log(`🚀 Server is running on http://localhost:${port}`);
        console.log(`📋 Health check: http://localhost:${port}/api/health`);

        // Khởi chạy Schedulers sau khi server đã sẵn sàng
        startScheduler();
        startHealthScheduler();
        console.log('📡 Hệ thống lập lịch đăng bài và kiểm tra sức khỏe đã hoạt động');
    });
};

startServer();

