const { Queue } = require('bullmq');
const { redis } = require('../config');

const connection = {
    host: redis.host,
    port: redis.port,
    password: redis.password,
    maxRetriesPerRequest: null,
};

const scraperQueue = new Queue('scraper-queue', { connection });

module.exports = scraperQueue;
