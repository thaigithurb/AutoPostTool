const cron = require('node-cron');
const Post = require('../models/Post');
const postQueue = require('../queues/post.queue');

// ============================================================
// Scheduler — Quét database mỗi 1 phút
// ============================================================
// Tìm bài viết: status = 'pending' AND scheduled_at <= now
// Chuyển status → 'processing' và đẩy vào Queue
// ============================================================

let isScanning = false; // Tránh quét chồng chéo

const startScheduler = () => {
    console.log('⏰ Scheduler đã bắt đầu — quét bài viết mỗi 1 phút');

    // Cron expression: mỗi phút (* * * * *)
    cron.schedule('* * * * *', async () => {
        // Tránh quét chồng chéo nếu lần quét trước chưa xong
        if (isScanning) {
            console.log('⏳ [Scheduler] Lần quét trước chưa xong, bỏ qua...');
            return;
        }

        isScanning = true;

        try {
            const now = new Date();

            // Tìm bài viết pending & đến hạn đăng
            const pendingPosts = await Post.find({
                status: 'pending',
                scheduled_at: { $lte: now },
            }).sort({ scheduled_at: 1 });

            if (pendingPosts.length === 0) {
                // Không log liên tục để tránh spam console
                return;
            }

            console.log(
                `\n📋 [Scheduler] Tìm thấy ${pendingPosts.length} bài viết cần đăng`
            );

            // Chuyển status → processing & đẩy vào Queue
            for (const post of pendingPosts) {
                // Cập nhật status = processing
                await Post.findByIdAndUpdate(post._id, { status: 'processing' });

                // Đẩy job vào Queue
                await postQueue.add(
                    `post-${post._id}`, // Job name
                    { postId: post._id.toString() }, // Job data
                    {
                        priority: post.target_type === 'page' ? 1 : 2, // Page ưu tiên hơn (nhanh hơn vì dùng API)
                    }
                );

                console.log(
                    `  📤 Đã đẩy vào Queue: Post ${post._id} | Target: ${post.target_type} | Scheduled: ${post.scheduled_at}`
                );
            }
        } catch (error) {
            console.error('❌ [Scheduler] Lỗi khi quét database:', error.message);
        } finally {
            isScanning = false;
        }
    });
};

module.exports = { startScheduler };
