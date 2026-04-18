const facebookAutomationService = require('./facebook-automation.service');
const ScrapedPost = require('../models/ScrapedPost');

// ============================================================
// Facebook Post Scraper Service
// ============================================================
// Dùng Playwright cào bài viết từ Facebook Group
// Tái sử dụng _initBrowser() và _verifyLogin() từ automation service
// ============================================================

class ScraperService {
    /**
     * Cào bài viết từ 1 Facebook Group
     *
     * @param {Array} cookies - Mảng cookies Playwright format
     * @param {string} groupId - ID của group cần cào
     * @param {object|null} proxy - Proxy { server, username, password }
     * @param {number} limit - Số bài tối đa cần cào (mặc định 10)
     * @param {string} category - Lĩnh vực / tag (mặc định "Chung")
     * @returns {{ success, data: ScrapedPost[], count, error }}
     */
    async scrapeGroupPosts(cookies, groupId, proxy = null, limit = 10, category = 'Chung') {
        let browser;

        try {
            console.log(`\n🔍 [Scraper] Bắt đầu cào bài từ Group: ${groupId} (tối đa ${limit} bài)`);

            // ── Bước 1: Mở browser ──
            const { browser: br, page } = await facebookAutomationService._initBrowser(
                cookies,
                proxy,
                true // headless: true cho scraping
            );
            browser = br;

            // ── Bước 2: Verify login ──
            const isLoggedIn = await facebookAutomationService._verifyLogin(page);
            if (!isLoggedIn) {
                return {
                    success: false,
                    error: 'Cookies hết hạn hoặc tài khoản bị checkpoint. Cần cập nhật cookies mới.',
                };
            }

            // ── Bước 3: Truy cập group ──
            console.log(`🔗 [Scraper] Đang truy cập group: ${groupId}`);
            await page.goto(`https://www.facebook.com/groups/${groupId}`, {
                waitUntil: 'domcontentloaded',
                timeout: 30000,
            });
            await this._randomDelay(2000, 4000);

            // Lấy tên group
            let groupName = '';
            try {
                const nameEl = await page.$('h1');
                if (nameEl) {
                    groupName = await nameEl.innerText();
                }
            } catch {
                groupName = `Group ${groupId}`;
            }

            // ── Bước 4: Scroll để load bài viết ──
            console.log('📜 [Scraper] Đang scroll để load bài viết...');
            const posts = [];
            let scrollAttempts = 0;
            const maxScrollAttempts = Math.min(limit * 2, 20); // Giới hạn scroll

            while (posts.length < limit && scrollAttempts < maxScrollAttempts) {
                // Scroll xuống
                await page.evaluate(() => window.scrollBy(0, 800));
                await this._randomDelay(1500, 3000);

                // Extract bài viết từ DOM
                const newPosts = await page.evaluate(() => {
                    const results = [];
                    // Facebook render posts trong các div[role="article"]
                    const articles = document.querySelectorAll('div[role="article"]');

                    articles.forEach((article) => {
                        try {
                            // Lấy nội dung text
                            const contentEl = article.querySelector(
                                'div[data-ad-preview="message"], div[data-ad-comet-preview="message"]'
                            );

                            // Fallback: tìm div chứa text dài
                            let content = '';
                            if (contentEl) {
                                content = contentEl.innerText?.trim() || '';
                            } else {
                                // Tìm div có nhiều text nhất trong article
                                const allDivs = article.querySelectorAll('div[dir="auto"]');
                                let longestText = '';
                                allDivs.forEach((div) => {
                                    const text = div.innerText?.trim() || '';
                                    if (text.length > longestText.length && text.length > 20) {
                                        longestText = text;
                                    }
                                });
                                content = longestText;
                            }

                            if (!content || content.length < 10) return;

                            // Lấy tên tác giả
                            const authorEl = article.querySelector(
                                'strong a, h3 a, a[role="link"] span'
                            );
                            const authorName = authorEl?.innerText?.trim() || 'Không rõ';

                            // Lấy ảnh
                            const imgEls = article.querySelectorAll('img[src*="scontent"]');
                            const mediaUrls = [];
                            imgEls.forEach((img) => {
                                const src = img.src;
                                if (src && !src.includes('emoji') && !src.includes('profile')) {
                                    mediaUrls.push(src);
                                }
                            });

                            // Lấy link bài viết
                            const linkEl = article.querySelector('a[href*="/groups/"][href*="/posts/"]');
                            const originalUrl = linkEl?.href || null;

                            results.push({
                                content,
                                authorName,
                                mediaUrls,
                                originalUrl,
                            });
                        } catch {
                            // Bỏ qua bài lỗi
                        }
                    });

                    return results;
                });

                // Thêm bài mới (tránh trùng lặp)
                for (const post of newPosts) {
                    const isDuplicate = posts.some(
                        (p) => p.content === post.content
                    );
                    if (!isDuplicate && posts.length < limit) {
                        posts.push(post);
                    }
                }

                scrollAttempts++;
                console.log(`  📄 Đã tìm thấy ${posts.length}/${limit} bài (scroll ${scrollAttempts}/${maxScrollAttempts})`);
            }

            // ── Bước 5: Lưu vào DB ──
            console.log(`💾 [Scraper] Đang lưu ${posts.length} bài vào database...`);
            const savedPosts = [];

            for (const post of posts) {
                try {
                    const scraped = await ScrapedPost.create({
                        group_id: groupId,
                        group_name: groupName,
                        author_name: post.authorName,
                        content: post.content,
                        media_urls: post.mediaUrls,
                        original_url: post.originalUrl,
                        category,
                    });
                    savedPosts.push(scraped);
                } catch (err) {
                    console.error(`  ⚠️ Bỏ qua bài lỗi: ${err.message}`);
                }
            }

            console.log(`✅ [Scraper] Hoàn tất! Đã lưu ${savedPosts.length} bài từ group "${groupName}"`);

            return {
                success: true,
                data: savedPosts,
                count: savedPosts.length,
                groupName,
            };
        } catch (error) {
            console.error('❌ [Scraper] Lỗi:', error.message);
            return {
                success: false,
                error: error.message,
            };
        } finally {
            if (browser) {
                await browser.close();
                console.log('🔒 [Scraper] Đã đóng browser');
            }
        }
    }

    /**
     * Lấy danh sách bài đã cào (có filter)
     */
    async getScrapedPosts(filter = {}, page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const query = {};
        if (filter.category) query.category = filter.category;
        if (filter.is_bookmarked !== undefined) query.is_bookmarked = filter.is_bookmarked;
        if (filter.group_id) query.group_id = filter.group_id;
        if (filter.search) {
            query.content = { $regex: filter.search, $options: 'i' };
        }

        const [posts, total] = await Promise.all([
            ScrapedPost.find(query)
                .sort({ is_bookmarked: -1, scraped_at: -1 })
                .skip(skip)
                .limit(limit),
            ScrapedPost.countDocuments(query),
        ]);

        return { posts, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    /**
     * Toggle bookmark
     */
    async toggleBookmark(id) {
        const post = await ScrapedPost.findById(id);
        if (!post) throw new Error('Không tìm thấy bài viết');

        post.is_bookmarked = !post.is_bookmarked;
        await post.save();
        return post;
    }

    /**
     * Xóa bài đã cào
     */
    async deleteScrapedPost(id) {
        const post = await ScrapedPost.findByIdAndDelete(id);
        if (!post) throw new Error('Không tìm thấy bài viết');
        return post;
    }

    /**
     * Lấy danh sách categories (distinct)
     */
    async getCategories() {
        return ScrapedPost.distinct('category');
    }

    /**
     * Random delay helper
     */
    async _randomDelay(min, max) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        return new Promise((resolve) => setTimeout(resolve, delay));
    }

    /**
     * Parse Link lấy Group ID / Page ID
     */
    extractIdFbFromUrl(url) {
        if (!url) return null;
        try {
            if (/^\d+$/.test(url)) return url; // Already an ID
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/').filter(Boolean);

            if (pathSegments.includes('groups')) {
                return pathSegments[pathSegments.indexOf('groups') + 1];
            }
            // Add other rules like pages/profile later if needed
            return pathSegments[0];
        } catch (e) {
            // Not a valid URL, return raw string (could be vanity name)
            return url;
        }
    }

    /**
     * Cào Bảng Tin (News Feed) lấy những bài hot
     */
    async scrapeNewsFeed(cookies, proxy = null, limit = 15) {
        let browser;
        try {
            console.log(`\n🔍 [Scraper] Bắt đầu cào bài từ News Feed (tối đa ${limit} bài)`);

            const { browser: br, page } = await facebookAutomationService._initBrowser(cookies, proxy, true);
            browser = br;

            const isLoggedIn = await facebookAutomationService._verifyLogin(page);
            if (!isLoggedIn) {
                return { success: false, error: 'Cookies hết hạn hoặc tài khoản bị checkpoint.' };
            }

            console.log(`🔗 [Scraper] Đang lướt News Feed...`);
            await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
            await this._randomDelay(2000, 4000);

            let groupName = 'Facebook News Feed';
            const posts = [];
            let scrollAttempts = 0;
            const maxScrollAttempts = Math.min(limit * 3, 30);

            while (posts.length < limit && scrollAttempts < maxScrollAttempts) {
                await page.evaluate(() => window.scrollBy(0, 1000));
                await this._randomDelay(1500, 3000);

                const newPosts = await page.evaluate(() => {
                    const results = [];
                    const articles = document.querySelectorAll('div[role="article"]');

                    articles.forEach((article) => {
                        try {
                            const contentEl = article.querySelector('div[data-ad-preview="message"], div[data-ad-comet-preview="message"]');
                            let content = contentEl ? contentEl.innerText?.trim() : '';

                            if (!content) {
                                const allDivs = article.querySelectorAll('div[dir="auto"]');
                                let longestText = '';
                                allDivs.forEach((div) => {
                                    const text = div.innerText?.trim() || '';
                                    if (text.length > longestText.length && text.length > 20) longestText = text;
                                });
                                content = longestText;
                            }

                            if (!content || content.length < 15) return;

                            // Filter out "Suggested for you", "Sponsored"
                            const isAd = Array.from(article.querySelectorAll('span, a')).some(el => el.innerText?.includes('Sponsored') || el.innerText?.includes('Được tài trợ'));
                            if (isAd) return;

                            const authorEl = article.querySelector('strong a, h3 a, a[role="link"] h4');
                            const authorName = authorEl?.innerText?.trim() || 'Newsfeed Post';

                            const imgEls = article.querySelectorAll('img[src*="scontent"]');
                            const mediaUrls = [];
                            imgEls.forEach((img) => {
                                const src = img.src;
                                if (src && !src.includes('emoji') && !src.includes('profile')) mediaUrls.push(src);
                            });

                            const linkEl = article.querySelector('a[href*="/groups/"][href*="/posts/"], a[role="link"][tabindex="0"]');
                            let originalUrl = null;
                            if (linkEl) {
                                const href = linkEl.getAttribute('href');
                                if (href && href !== '#' && href.includes('facebook.com')) originalUrl = href;
                            }

                            results.push({ content, authorName, mediaUrls, originalUrl });
                        } catch (e) { }
                    });
                    return results;
                });

                for (const post of newPosts) {
                    if (!posts.some(p => p.content === post.content) && posts.length < limit) {
                        posts.push(post);
                    }
                }

                scrollAttempts++;
                console.log(`  📄 Scroll ${scrollAttempts}/${maxScrollAttempts} - gom nhặt được ${posts.length}/${limit}`);
            }

            console.log(`💾 [Scraper] Đang lưu ${posts.length} bài từ Newsfeed vào database...`);
            const savedPosts = [];
            for (const post of posts) {
                try {
                    const scraped = await ScrapedPost.create({
                        group_id: 'newsfeed',
                        group_name: groupName,
                        author_name: post.authorName,
                        content: post.content,
                        media_urls: post.mediaUrls,
                        original_url: post.originalUrl,
                        category: 'Khám phá Newsfeed',
                    });
                    savedPosts.push(scraped);
                } catch (err) { }
            }

            console.log(`✅ [Scraper] Hoàn tất lướt Newsfeed!`);
            return { success: true, data: savedPosts, count: savedPosts.length, groupName };
        } catch (error) {
            console.error('❌ [Scraper] Lỗi lướt Newsfeed:', error.message);
            return { success: false, error: error.message };
        } finally {
            if (browser) await browser.close();
        }
    }
}

module.exports = new ScraperService();
