const cron = require('node-cron');
const ScrapeTarget = require('../models/ScrapeTarget');
const scraperQueue = require('../queues/scraper.queue');

let isScanning = false;

const startScraperScheduler = () => {
    console.log('⏰ Scraper Scheduler đã bắt đầu — kiểm tra mục tiêu cào mỗi 5 phút');

    // Quét mỗi 5 phút
    cron.schedule('*/5 * * * *', async () => {
        if (isScanning) return;
        isScanning = true;

        try {
            const now = new Date();
            const targets = await ScrapeTarget.find({ active: true });

            for (const target of targets) {
                let shouldRun = false;

                // Nếu chưa cào bao giờ, chạy luôn
                if (!target.last_scraped_at) {
                    shouldRun = true;
                } else {
                    const hoursSinceLastScrape = (now - target.last_scraped_at) / (1000 * 60 * 60);
                    if (hoursSinceLastScrape >= target.frequency_hours) {
                        shouldRun = true;
                    }
                }

                if (shouldRun) {
                    // Update the timestamp early so we don't enqueue multiple times
                    target.last_scraped_at = now;
                    await target.save();

                    // Đẩy vào queue
                    await scraperQueue.add(`scrape-${target._id}-${now.getTime()}`, { targetId: target._id.toString() });
                    console.log(`  📤 Đã đẩy vào Queue Cào Dữ Liệu: Target ${target.name} (Tần suất: ${target.frequency_hours}h)`);
                }
            }
        } catch (error) {
            console.error('❌ [Scraper Scheduler] Lỗi khi quét database:', error.message);
        } finally {
            isScanning = false;
        }
    });
};

module.exports = { startScraperScheduler };
