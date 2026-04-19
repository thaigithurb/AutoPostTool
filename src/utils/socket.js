let io;

module.exports = {
    init: (httpServer) => {
        io = require('socket.io')(httpServer, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        io.on('connection', (socket) => {
            console.log('🔌 New client connected:', socket.id);
            
            socket.on('disconnect', () => {
                console.log('🔌 Client disconnected:', socket.id);
            });
        });

        return io;
    },
    getIO: () => {
        if (!io) {
            throw new Error("Socket.io not initialized!");
        }
        return io;
    },
    // Shorthand to emit update
    emitAccountUpdate: (data) => {
        if (io) {
            io.emit('ACCOUNT_STATUS_UPDATED', data);
        }
    }
};
