const facebookAutomationService = require('./facebook-automation.service');

// ============================================================
// Facebook Group Search Service
// ============================================================
// Uses Facebook's built-in group search instead of scrolling feed.
// Much lighter, more accurate, and less likely to trigger anti-bot.
// ============================================================

class GroupSearchService {
    /**
     * Search posts in one or more Facebook groups by keyword.
     */
    async searchGroups(cookies, groupIds, keyword, proxy = null, maxResults = 20, isRecent = true) {
        let browser;

        try {
            console.log(`\n🔍 [Group Search] Bắt đầu tìm kiếm "${keyword}" trong ${groupIds.length} group(s) (isRecent: ${isRecent})`);

            // ── Step 1: Launch browser ──
            const { browser: br, context, page: defaultPage } = await facebookAutomationService._initBrowser(
                cookies,
                proxy,
                false 
            );
            browser = br;

            // ── Step 2: Verify login ──
            const isLoggedIn = await facebookAutomationService._verifyLogin(defaultPage);
            if (!isLoggedIn) {
                return {
                    success: false,
                    error: 'Cookies hết hạn hoặc tài khoản bị checkpoint. Cần cập nhật cookies mới.',
                };
            }
            
            await defaultPage.close();

            // ── Step 3: Search each group (Tuần tự từng nhóm một) ──
            const allResults = [];

            for (let i = 0; i < groupIds.length; i++) {
                const groupId = groupIds[i];
                console.log(`  🚀 [${i + 1}/${groupIds.length}] Đang quét group ${groupId}...`);
                
                const newPage = await context.newPage();
                try {
                    await newPage.route('**/*', (route) => {
                        const type = route.request().resourceType();
                        if (['image', 'media', 'font'].includes(type) || route.request().url().includes('video')) {
                            route.abort();
                        } else {
                            route.continue();
                        }
                    });

                    const results = await this._searchInGroup(newPage, groupId, keyword, maxResults, isRecent);
                    console.log(`  ✅ Xong group ${groupId} (Tìm được ${results.length} bài)`);
                    allResults.push(...results);
                } catch (err) {
                    console.error(`  ❌ Lỗi group ${groupId}: ${err.message}`);
                } finally {
                    await newPage.close().catch(() => {});
                }
            }

            // Filter only posts from last 7 days (Hậu lọc để chính xác 100%)
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const filteredResults = allResults.filter(post => {
                const postTime = this._parseRelativeTime(post.timestamp);
                return postTime === 0 || postTime >= sevenDaysAgo;
            });

            // Sort by newest first
            filteredResults.sort((a, b) => {
                const timeA = this._parseRelativeTime(a.timestamp);
                const timeB = this._parseRelativeTime(b.timestamp);
                return timeB - timeA;
            });

            console.log(`\n✅ [Group Search] Hoàn tất! Tìm được ${allResults.length} bài, sau khi lọc còn ${filteredResults.length} bài phù hợp.`);

            return {
                success: true,
                data: filteredResults,
                count: filteredResults.length,
            };
        } catch (error) {
            console.error('❌ [Group Search] Lỗi:', error.message);
            return { success: false, error: error.message };
        } finally {
            if (browser) {
                await browser.close();
                console.log('🔒 [Group Search] Đã đóng browser');
            }
        }
    }

    async _searchInGroup(page, groupId, keyword, maxResults, isRecent) {
        let searchUrl = `https://www.facebook.com/groups/${groupId}/search/?q=${encodeURIComponent(keyword)}`;
        if (isRecent) {
            searchUrl += `&filters=eyJyZWNlbnRfcG9zdHM6MCI6IntcIm5hbWVcIjpcInJlY2VudF9wb3N0c1wiLFwiYXJnc1wiOlwiXCJ9In0%3D`;
        }
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.evaluate(() => window.scrollTo(0, 0));
        await this._randomDelay(1000, 1500);
        await this._dismissPopups(page);

        if (page.url().includes('/login/') || page.url().includes('/checkpoint/')) return [];

        const groupName = await page.evaluate(() => document.querySelector('h1')?.innerText?.trim() || '');
        const allResultsMap = new Map(); 
        
        try {
            await page.waitForSelector('div[role="article"], div[data-visualcompletion*="dynamic"]', { timeout: 30000 });
            
            await page.evaluate(() => {
                const nodes = Array.from(document.querySelectorAll('span, div[role="button"], div[role="radio"]'));
                for (const node of nodes) {
                    const text = node.innerText?.trim();
                    if (['Bài viết mới nhất', 'Mới nhất', 'Most recent', 'Recent posts'].includes(text)) {
                        node.click();
                        return true;
                    }
                }
                return false;
            });
            await this._randomDelay(3000, 5000);
        } catch (e) {}

        let noNewCount = 0;
        const MAX_SCROLLS = 15;

        for (let i = 0; i < MAX_SCROLLS; i++) {
            const currentBatch = await page.evaluate((options) => {
                const { groupId, groupName } = options;
                const posts = [];
                const containers = document.querySelectorAll('div[role="article"], div[data-visualcompletion="ignore-dynamic"], div[aria-posinset]');
                
                for (const container of containers) {
                    try {
                        const innerText = container.innerText || '';
                        
                        // 1. Skip Profile Cards & UI Headers immediately
                        if (innerText.includes('Kết quả tìm kiếm') || 
                            innerText.includes('người theo dõi') || 
                            innerText.includes('Nhân viên kinh doanh') ||
                            innerText.includes('đang sống tại')) {
                            continue;
                        }

                        // ── Author Extraction ──
                        let author = '';
                        const strongTags = container.querySelectorAll('strong, h2, h3, h4, span[role="link"] strong');
                        for (const tag of strongTags) {
                            const t = tag.innerText?.trim();
                            if (t && t.length > 2 && t.length < 50) {
                                author = t;
                                break;
                            }
                        }
                        if (!author) {
                            if (innerText.includes('Người tham gia ẩn danh') || innerText.includes('Anonymous member')) {
                                author = 'Người tham gia ẩn danh';
                            }
                        }

                        // ── Content Extraction ──
                        let content = '';
                        const msgBlock = container.querySelector('div[data-ad-preview="message"], div[dir="auto"][style*="text-align"]');
                        if (msgBlock) {
                            content = msgBlock.innerText?.trim();
                        } else {
                            const textNodes = Array.from(container.querySelectorAll('div[dir="auto"], span[dir="auto"]'))
                                .map(el => el.innerText?.trim())
                                .filter(t => t && t.length > 20);
                            content = textNodes.sort((a, b) => b.length - a.length)[0] || '';
                        }

                        // ── Timestamp Extraction ──
                        let timestamp = '';
                        const timeElements = container.querySelectorAll('span, a, div[dir="auto"]');
                        for (const el of timeElements) {
                            const t = el.innerText?.trim();
                            if (t && t.length < 35 && (
                                /^(vừa xong|just now)$/i.test(t) ||
                                /^\d+\s*(phút|giờ|ngày|tuần|tháng|năm|m|h|d|w|y)/i.test(t) ||
                                /^(hôm qua|yesterday)$/i.test(t) ||
                                /^\d+\s+tháng\s+\d+/i.test(t)
                            )) {
                                timestamp = t;
                                break;
                            }
                        }

                        // 2. Strict Noise Check: Must have author OR timestamp OR significant content
                        if (!author && !timestamp && content.length < 50) continue;
                        if (!content || content.length < 10) continue;

                        // 3. More banned keywords for profile junk
                        const banned = ['tư vấn và setup', 'kiotviet', 'phần mềm', 'sale', 'kinh doanh'];
                        const lowerContent = content.toLowerCase();
                        if (innerText.includes('Kết quả tìm kiếm') || (author && author.includes('...'))) continue;

                        // ── Link ──
                        let postUrl = '';
                        const links = container.querySelectorAll('a[href]');
                        for (const link of links) {
                            const href = link.getAttribute('href') || '';
                            if (href.includes('/posts/') || href.includes('/permalink/')) {
                                postUrl = href.startsWith('http') ? href : 'https://www.facebook.com' + href;
                                if (postUrl.includes('?')) postUrl = postUrl.split('?')[0];
                                break;
                            }
                        }
                        if (!postUrl) postUrl = `https://www.facebook.com/groups/${groupId}`;

                        posts.push({ content, author: author || 'Không rõ', timestamp: timestamp || 'Vừa xong', postUrl, groupId, groupName });
                    } catch (e) {}
                }
                return posts;
            }, { groupId, groupName });

            let newlyAdded = 0;
            for (const post of currentBatch) {
                const key = post.postUrl + post.content.substring(0, 30);
                if (!allResultsMap.has(key)) {
                    allResultsMap.set(key, post);
                    newlyAdded++;
                }
            }

            if (newlyAdded > 0) {
                noNewCount = 0;
            } else {
                noNewCount++;
            }

            if (noNewCount >= 4 && i > 5) break;

            await page.mouse.wheel(0, 1200);
            await this._randomDelay(2000, 3500);
        }

        return Array.from(allResultsMap.values());
    }

    _parseRelativeTime(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return 0;
        const now = Date.now();
        const t = timeStr.toLowerCase().trim();
        if (t.includes('vừa xong') || t.includes('just now')) return now;
        
        let match = t.match(/(\d+)\s*(phút|m|min)/i);
        if (match) return now - parseInt(match[1]) * 60 * 1000;
        match = t.match(/(\d+)\s*(giờ|h|hour)/i);
        if (match) return now - parseInt(match[1]) * 60 * 60 * 1000;
        match = t.match(/(\d+)\s*(ngày|d|day)/i);
        if (match) return now - parseInt(match[1]) * 24 * 60 * 60 * 1000;
        match = t.match(/(\d+)\s*(tuần|w|week)/i);
        if (match) return now - parseInt(match[1]) * 7 * 24 * 60 * 60 * 1000;

        if (t.includes('hôm qua') || t.includes('yesterday')) {
            return now - 24 * 60 * 60 * 1000;
        }

        if (t.includes('tháng')) {
            const parts = t.match(/(\d+)\s+tháng\s+(\d+)(?:,\s+(\d+))?/i);
            if (parts) {
                const day = parseInt(parts[1]);
                const month = parseInt(parts[2]) - 1;
                const year = parts[3] ? parseInt(parts[3]) : new Date().getFullYear();
                return new Date(year, month, day).getTime();
            }
        }
        return Date.parse(timeStr) || 0;
    }

    async _dismissPopups(page) {
        try {
            await page.keyboard.press('Escape');
        } catch {}
    }

    _randomDelay(min, max) {
        return new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min));
    }
}

module.exports = new GroupSearchService();
