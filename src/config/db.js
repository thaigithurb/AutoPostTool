const mongoose = require('mongoose');
const { mongodbUri } = require('./index');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(mongodbUri, {
            serverSelectionTimeoutMS: 60000, // Tăng lên 60s để tránh timeout sớm
            socketTimeoutMS: 45000,
            heartbeatFrequencyMS: 10000,
            autoIndex: true,
        });
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
