const { Worker } = require('bullmq');
const { redis } = require('../config');
const Post = require('../models/Post');
const Account = require('../models/Account');
const facebookApiService = require('../services/facebook-api.service');
const facebookAutomationService = require('../services/facebook-automation.service');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const telegramService = require('../services/telegram.service');

// ============================================================
// Helper: Tải ảnh từ URL (Cloudinary) về thư mục tạm
// Playwright cần file local, không nhận URL
// ============================================================
const downloadFile = (url, destPath) => {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(destPath);
        protocol.get(url, (response) => {
            // Theo dõi redirect
            if (response.statusCode === 301 || response.statusCode === 302) {
                downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(destPath);
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => { }); // Xóa file lỗi
            reject(err);
        });
    });
};

const downloadImagesToTemp = async (imageUrls) => {
    if (!imageUrls || imageUrls.length === 0) return [];

    const tmpDir = path.join(require('os').tmpdir(), 'auto-post-images');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }

    const localPaths = [];
    for (const url of imageUrls) {
        try {
            // Tạo tên file unique
            const ext = path.extname(new URL(url).pathname) || '.jpg';
            const filename = `img_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
            const destPath = path.join(tmpDir, filename);

            await downloadFile(url, destPath);
            localPaths.push(destPath);
            console.log(`  📥 Đã tải ảnh: ${filename}`);
        } catch (err) {
            console.error(`  ⚠️ Lỗi tải ảnh ${url}: ${err.message}`);
        }
    }

    return localPaths;
};

const cleanupTempImages = (localPaths) => {
    for (const p of localPaths) {
        try {
            if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch { }
    }
};

// ============================================================
// Worker xử lý Queue đăng bài
// ============================================================
// Mỗi job chứa: { postId }
// Worker sẽ:
//   1. Đọc Post từ DB
//   2. Đọc Account liên quan
//   3. Kiểm tra target_type → gọi service tương ứng
//   4. Cập nhật status: success / failed
// ============================================================

const postWorker = new Worker(
    'post-queue',
    async (job) => {
        const { postId } = job.data;
        console.log(`\n🔄 [Worker] Đang xử lý job #${job.id} | Post: ${postId} | Lần thử: ${job.attemptsMade + 1}/3`);

        // ── Đọc Post từ DB ──
        const post = await Post.findById(postId);
        if (!post) {
            throw new Error(`Không tìm thấy bài viết: ${postId}`);
        }

        // ── Đọc Account ──
        const account = await Account.findById(post.account);
        if (!account) {
            // Đánh dấu failed luôn vì không có account thì không retry được
            await Post.findByIdAndUpdate(postId, {
                status: 'failed',
                error_message: 'Không tìm thấy tài khoản liên kết',
            });
            throw new Error('Không tìm thấy tài khoản liên kết');
        }

        if (!account.is_active) {
            await Post.findByIdAndUpdate(postId, {
                status: 'failed',
                error_message: 'Tài khoản đã bị vô hiệu hóa',
            });
            throw new Error('Tài khoản đã bị vô hiệu hóa');
        }

        let result;

        try {
            switch (post.target_type) {
                // ════════════════════════════════════════════
                // PAGE — Dùng Facebook Graph API
                // ════════════════════════════════════════════
                case 'page': {
                    console.log('📄 [Worker] Target: Page → Gọi Facebook API Service');

                    const pageToken = account.getDecryptedToken();
                    if (!pageToken) {
                        throw new Error('Không có access_token cho Page');
                    }

                    result = await facebookApiService.postToPage(
                        pageToken,
                        post.content,
                        post.media_urls || []
                    );
                    break;
                }

                // ════════════════════════════════════════════
                // GROUP — Dùng Playwright Automation
                // ════════════════════════════════════════════
                case 'group': {
                    console.log('👥 [Worker] Target: Group → Gọi Facebook Automation Service');

                    const cookies = account.getPlaywrightCookies();
                    if (!cookies || cookies.length === 0) {
                        throw new Error('Không có cookies cho tài khoản');
                    }

                    const proxy = account.getParsedProxy();

                    // Tải ảnh từ Cloudinary về local trước khi đưa cho Playwright
                    let localImages = [];
                    try {
                        localImages = await downloadImagesToTemp(post.media_urls);
                        result = await facebookAutomationService.postToGroup(
                            cookies,
                            post.target_id,
                            post.content,
                            localImages,
                            proxy
                        );
                    } finally {
                        cleanupTempImages(localImages);
                    }
                    break;
                }

                // ════════════════════════════════════════════
                // PROFILE — Dùng Playwright Automation
                // ════════════════════════════════════════════
                case 'profile': {
                    console.log('👤 [Worker] Target: Profile → Gọi Facebook Automation Service');

                    const cookies = account.getPlaywrightCookies();
                    if (!cookies || cookies.length === 0) {
                        throw new Error('Không có cookies cho tài khoản');
                    }

                    const proxy = account.getParsedProxy();

                    // Tải ảnh từ Cloudinary về local trước khi đưa cho Playwright
                    let localImages = [];
                    try {
                        localImages = await downloadImagesToTemp(post.media_urls);
                        result = await facebookAutomationService.postToProfile(
                            cookies,
                            post.content,
                            localImages,
                            proxy
                        );
                    } finally {
                        cleanupTempImages(localImages);
                    }
                    break;
                }

                default:
                    throw new Error(`target_type không hợp lệ: ${post.target_type}`);
            }

            // ── Kiểm tra kết quả ──
            if (result.success) {
                await Post.findByIdAndUpdate(postId, {
                    status: 'success',
                    error_message: null,
                });
                console.log(`✅ [Worker] Đăng bài thành công! Post: ${postId}`);
                return { success: true, postId };
            } else {
                // Throw để BullMQ retry
                throw new Error(result.error?.message || result.error || 'Đăng bài thất bại');
            }
        } catch (error) {
            // Cập nhật error_message vào DB
            await Post.findByIdAndUpdate(postId, {
                error_message: error.message,
                // Chỉ đánh dấu failed ở lần thử cuối cùng
                ...(job.attemptsMade >= 2 ? { status: 'failed' } : {}),
            });

            console.error(
                `❌ [Worker] Lỗi đăng bài Post: ${postId} | Lần ${job.attemptsMade + 1}/3 | ${error.message}`
            );

            // Throw để BullMQ tự retry (nếu chưa hết attempts)
            throw error;
        }
    },
    {
        connection: {
            host: redis.host,
            port: redis.port,
            password: redis.password,
            maxRetriesPerRequest: null,
        },
        concurrency: 1, // Xử lý từng job một (tránh bị checkpoint do đăng quá nhanh)
    }
);

// ============================================================
// Event listeners
// ============================================================
postWorker.on('completed', async (job) => {
    console.log(`🎉 [Worker] Job #${job.id} hoàn thành thành công`);

    // Gửi thông báo Telegram
    try {
        const post = await Post.findById(job.data.postId);
        if (post) {
            await telegramService.notifyPostSuccess(post);
        }
    } catch (err) {
        console.error('⚠️ [Worker] Lỗi gửi Telegram (success):', err.message);
    }
});

postWorker.on('failed', async (job, err) => {
    if (job.attemptsMade < 3) {
        console.log(
            `🔁 [Worker] Job #${job.id} thất bại lần ${job.attemptsMade}/3 — Sẽ thử lại sau 15 phút. Lý do: ${err.message}`
        );
    } else {
        console.error(
            `💀 [Worker] Job #${job.id} thất bại vĩnh viễn sau 3 lần thử. Lý do: ${err.message}`
        );

        // Gửi thông báo Telegram khi thất bại vĩnh viễn
        try {
            const post = await Post.findById(job.data.postId);
            if (post) {
                await telegramService.notifyPostFailed(post, err.message, job.attemptsMade);
            }
        } catch (teleErr) {
            console.error('⚠️ [Worker] Lỗi gửi Telegram (failed):', teleErr.message);
        }
    }
});

postWorker.on('error', (err) => {
    console.error('❌ [Worker] Lỗi Worker:', err.message);
});

console.log('⚙️ Post Worker đã sẵn sàng xử lý jobs');

module.exports = postWorker;
