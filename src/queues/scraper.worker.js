const { Worker } = require('bullmq');
const { redis } = require('../config');
const scraperService = require('../services/scraper.service');
const ScrapeTarget = require('../models/ScrapeTarget');
const Account = require('../models/Account');

const connection = {
    host: redis.host,
    port: redis.port,
    password: redis.password,
    maxRetriesPerRequest: null,
};

const worker = new Worker('scraper-queue', async (job) => {
    const { targetId } = job.data;
    console.log(`\n🤖 [Scraper Worker] Bắt đầu cào cho Target ID: ${targetId}`);

    const target = await ScrapeTarget.findById(targetId);
    if (!target || !target.active) {
        console.log(`[Scraper Worker] Target không tồn tại hoặc đã bị tắt.`);
        return;
    }

    const account = await Account.findById(target.account_id);
    if (!account) {
        throw new Error('Tài khoản cào không tồn tại');
    }

    const cookies = account.getPlaywrightCookies();
    const proxy = account.getParsedProxy();

    let result;
    if (target.type === 'group') {
        result = await scraperService.scrapeGroupPosts(cookies, target.target_id, proxy, 15, target.name);
    } else if (target.type === 'news_feed') {
        result = await scraperService.scrapeNewsFeed(cookies, proxy, 15);
    } else {
        throw new Error(`Loại target ${target.type} chưa được hỗ trợ cào tự động`);
    }

    if (result && result.success) {
        // Cập nhật thống kê
        target.posts_found = (target.posts_found || 0) + result.count;
        await target.save();
        console.log(`✅ [Scraper Worker] Cào thành công ${result.count} bài.`);
    } else {
        throw new Error(result?.error || 'Unknown error');
    }

}, { connection });

worker.on('failed', (job, err) => {
    console.error(`❌ [Scraper Worker] Job ${job.id} thất bại: ${err.message}`);
});

module.exports = worker;
