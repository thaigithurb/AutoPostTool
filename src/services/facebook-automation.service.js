const { chromium } = require('playwright');

// ============================================================
// Danh sách User-Agent thực tế — random mỗi lần mở trình duyệt
// ============================================================
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

// ============================================================
// Helper functions
// ============================================================

/**
 * Random delay giữa min-max ms (giống hành vi người thật)
 */
const randomDelay = (min = 500, max = 1500) => {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Chọn User-Agent ngẫu nhiên
 */
const getRandomUserAgent = () => {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
};

/**
 * Gõ text có delay từng ký tự — mô phỏng hành vi gõ thật
 * @param {import('playwright').Page} page
 * @param {string} selector - CSS selector
 * @param {string} text - Nội dung cần gõ
 */
const humanType = async (page, selector, text) => {
    const element = await page.waitForSelector(selector, { timeout: 15000 });
    await element.click();
    await randomDelay(300, 600);

    for (const char of text) {
        await page.keyboard.type(char, {
            delay: Math.floor(Math.random() * 100) + 30, // 30-130ms/ký tự
        });
    }
};

/**
 * Đóng các popup/dialog/notification che khuất nút bấm
 * @param {import('playwright').Page} page
 */
const dismissPopups = async (page) => {
    const popupSelectors = [
        // Nút "Không phải bây giờ" / "Not Now"
        '[aria-label="Close"]',
        '[aria-label="Đóng"]',
        'div[role="dialog"] div[aria-label="Close"]',
        'div[role="dialog"] div[aria-label="Đóng"]',
        // Popup notification
        'div[role="dialog"] button:has-text("Not Now")',
        'div[role="dialog"] button:has-text("Không phải bây giờ")',
        'div[role="dialog"] button:has-text("Decline optional cookies")',
        'div[role="dialog"] button:has-text("Từ chối cookie không bắt buộc")',
    ];

    for (const selector of popupSelectors) {
        try {
            const btn = await page.$(selector);
            if (btn && (await btn.isVisible())) {
                await btn.click();
                console.log(`  ✅ Đã đóng popup: ${selector}`);
                await randomDelay(500, 1000);
            }
        } catch {
            // Bỏ qua nếu không tìm thấy
        }
    }
};

// ============================================================
// Facebook Automation Service
// ============================================================
class FacebookAutomationService {
    /**
     * Khởi tạo browser + context với cookies và proxy
     * @param {Array} cookies - Mảng cookies Playwright format (từ account.getPlaywrightCookies())
     * @param {object|null} proxy - Proxy object { server, username, password }
     * @param {boolean} headless - Chạy headless hay không (mặc định false để debug)
     * @returns {{ browser, context, page }}
     */
    async _initBrowser(cookies, proxy = null, headless = false) {
        // ── Launch options ──
        const launchOptions = {
            headless,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--no-sandbox',
            ],
        };

        // Thêm proxy nếu có
        if (proxy) {
            launchOptions.proxy = {
                server: proxy.server,
                ...(proxy.username && { username: proxy.username }),
                ...(proxy.password && { password: proxy.password }),
            };
            console.log(`🌐 Sử dụng proxy: ${proxy.server}`);
        }

        const browser = await chromium.launch(launchOptions);

        // ── Context với User-Agent random ──
        const context = await browser.newContext({
            userAgent: getRandomUserAgent(),
            viewport: { width: 1366, height: 768 },
            locale: 'vi-VN',
            timezoneId: 'Asia/Ho_Chi_Minh',
        });

        // ── Inject cookies để bypass đăng nhập ──
        if (cookies && cookies.length > 0) {
            await context.addCookies(cookies);
            console.log(`🍪 Đã inject ${cookies.length} cookies`);
        }

        const page = await context.newPage();

        // Ẩn dấu hiệu automation
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
        });

        return { browser, context, page };
    }

    /**
     * Kiểm tra xem đã đăng nhập Facebook thành công chưa
     * @param {import('playwright').Page} page
     * @returns {boolean}
     */
    async _verifyLogin(page) {
        try {
            await page.goto('https://www.facebook.com/', {
                waitUntil: 'domcontentloaded',
                timeout: 30000,
            });
            await randomDelay(2000, 3000);
            await dismissPopups(page);

            // Kiểm tra có bị redirect về trang login không
            const url = page.url();
            if (url.includes('/login') || url.includes('/checkpoint')) {
                console.error('❌ Cookies hết hạn hoặc bị checkpoint');
                return false;
            }

            console.log('✅ Đăng nhập Facebook thành công');
            return true;
        } catch (error) {
            console.error('❌ Lỗi kiểm tra đăng nhập:', error.message);
            return false;
        }
    }

    /**
     * Đăng bài vào Facebook Group
     *
     * @param {Array} cookies - Mảng cookies Playwright format
     * @param {string} groupId - ID nhóm Facebook
     * @param {string} message - Nội dung bài viết
     * @param {string[]} imagePaths - Mảng đường dẫn ảnh local (tuyệt đối)
     * @param {object|null} proxy - Proxy { server, username, password }
     * @returns {{ success, message, error }}
     */
    async postToGroup(cookies, groupId, message, imagePaths = [], proxy = null) {
        let browser;

        try {
            console.log(`\n📝 Bắt đầu đăng bài vào Group: ${groupId}`);
            console.log(`   Nội dung: ${message.substring(0, 50)}...`);

            // ── Bước 1: Khởi tạo browser ──
            const { browser: br, page } = await this._initBrowser(
                cookies,
                proxy,
                false // headless: false để debug
            );
            browser = br;

            // ── Bước 2: Kiểm tra đăng nhập ──
            const isLoggedIn = await this._verifyLogin(page);
            if (!isLoggedIn) {
                return {
                    success: false,
                    error: 'Cookies hết hạn hoặc tài khoản bị checkpoint. Cần cập nhật cookies mới.',
                };
            }

            // ── Bước 3: Truy cập trang Group ──
            console.log(`🔗 Đang truy cập group: ${groupId}`);
            await page.goto(`https://www.facebook.com/groups/${groupId}`, {
                waitUntil: 'domcontentloaded',
                timeout: 30000,
            });
            await randomDelay(2000, 4000);
            await dismissPopups(page);

            // ── Bước 4: Click vào ô "Viết gì đó..." ──
            console.log('📌 Đang tìm ô viết bài...');
            const writeBoxSelectors = [
                'div[role="button"] span:has-text("Viết gì đó")',
                'div[role="button"] span:has-text("Write something")',
                'div[role="button"] span:has-text("Bạn viết gì đi")',
                'div[role="button"][tabindex="0"]:has-text("Viết gì đó")',
            ];

            let writeBoxClicked = false;
            for (const selector of writeBoxSelectors) {
                try {
                    const el = await page.waitForSelector(selector, { timeout: 5000 });
                    if (el) {
                        await el.click();
                        writeBoxClicked = true;
                        console.log('  ✅ Đã click ô viết bài');
                        break;
                    }
                } catch {
                    continue;
                }
            }

            if (!writeBoxClicked) {
                return {
                    success: false,
                    error: 'Không tìm thấy ô "Viết gì đó..." trong Group. Có thể bạn chưa tham gia nhóm.',
                };
            }

            await randomDelay(1500, 2500);
            await dismissPopups(page);

            // ── Bước 5: Gõ nội dung bài viết ──
            console.log('⌨️ Đang gõ nội dung...');
            const editorSelectors = [
                'div[role="dialog"] div[contenteditable="true"][role="textbox"]',
                'div[role="dialog"] div[contenteditable="true"]',
                'form div[contenteditable="true"]',
            ];

            let editorFound = false;
            for (const selector of editorSelectors) {
                try {
                    const editor = await page.waitForSelector(selector, { timeout: 5000 });
                    if (editor) {
                        await editor.click();
                        await randomDelay(300, 600);

                        // Gõ từng ký tự có delay
                        for (const char of message) {
                            await page.keyboard.type(char, {
                                delay: Math.floor(Math.random() * 80) + 20,
                            });
                        }

                        editorFound = true;
                        console.log('  ✅ Đã gõ nội dung xong');
                        break;
                    }
                } catch {
                    continue;
                }
            }

            if (!editorFound) {
                return {
                    success: false,
                    error: 'Không tìm thấy editor để gõ nội dung.',
                };
            }

            await randomDelay(1000, 2000);

            // ── Bước 6: Upload ảnh (nếu có) ──
            if (imagePaths && imagePaths.length > 0) {
                console.log(`📸 Đang upload ${imagePaths.length} ảnh...`);

                // Dùng setInputFiles trực tiếp vào input[ẩn] — không click nút để tránh mở file explorer
                const fileInput = await page.waitForSelector(
                    'div[role="dialog"] input[type="file"][accept*="image"]',
                    { state: 'attached', timeout: 10000 }
                );

                if (fileInput) {
                    await fileInput.setInputFiles(imagePaths);
                    console.log(`  ✅ Đã upload ${imagePaths.length} ảnh`);

                    // Chờ ảnh upload xong (mỗi ảnh ~3-5s)
                    await randomDelay(
                        imagePaths.length * 2000,
                        imagePaths.length * 4000
                    );
                }
            }

            // ── Bước 7: Nhấn nút Đăng ──
            console.log('🚀 Đang nhấn nút Đăng...');
            const postButtonSelectors = [
                'div[role="dialog"] div[aria-label="Đăng"][role="button"]',
                'div[role="dialog"] div[aria-label="Post"][role="button"]',
                'div[role="dialog"] div[aria-label="Đăng"]',
                'div[role="dialog"] div[aria-label="Post"]',
                'div[role="dialog"] span:has-text("Đăng")',
                'div[role="dialog"] span:has-text("Post")',
            ];

            let posted = false;
            for (const selector of postButtonSelectors) {
                try {
                    const btn = await page.waitForSelector(selector, { timeout: 5000 });
                    if (btn) {
                        await randomDelay(500, 1000);
                        await btn.click();
                        posted = true;
                        console.log('  ✅ Đã nhấn nút Đăng');
                        break;
                    }
                } catch {
                    continue;
                }
            }

            if (!posted) {
                return {
                    success: false,
                    error: 'Không tìm thấy nút "Đăng". Dialog có thể đã bị thay đổi bởi Facebook.',
                };
            }

            // ── Bước 8: Chờ bài đăng hoàn tất ──
            console.log('⏳ Đang chờ bài đăng được xử lý...');
            await randomDelay(5000, 8000);

            // Kiểm tra xem dialog đã đóng chưa (dialog đóng = đăng thành công)
            try {
                await page.waitForSelector('div[role="dialog"]', {
                    state: 'detached',
                    timeout: 30000,
                });
                console.log('✅ Đăng bài thành công vào Group!');
            } catch {
                console.log('⚠️ Dialog vẫn còn mở, bài có thể đang được xử lý...');
            }

            await randomDelay(2000, 3000);

            return {
                success: true,
                message: `Đăng bài thành công vào group ${groupId}`,
            };
        } catch (error) {
            console.error('❌ Lỗi khi đăng bài vào Group:', error.message);
            return {
                success: false,
                error: error.message,
            };
        } finally {
            if (browser) {
                await browser.close();
                console.log('🔒 Đã đóng trình duyệt');
            }
        }
    }

    /**
     * Đăng bài lên Trang cá nhân (Profile/Timeline)
     *
     * @param {Array} cookies - Mảng cookies Playwright format
     * @param {string} message - Nội dung bài viết
     * @param {string[]} imagePaths - Mảng đường dẫn ảnh local
     * @param {object|null} proxy - Proxy { server, username, password }
     * @returns {{ success, message, error }}
     */
    async postToProfile(cookies, message, imagePaths = [], proxy = null) {
        let browser;

        try {
            console.log(`\n📝 Bắt đầu đăng bài lên Trang cá nhân`);

            // ── Bước 1: Khởi tạo browser ──
            const { browser: br, page } = await this._initBrowser(
                cookies,
                proxy,
                false
            );
            browser = br;

            // ── Bước 2: Kiểm tra đăng nhập ──
            const isLoggedIn = await this._verifyLogin(page);
            if (!isLoggedIn) {
                return {
                    success: false,
                    error: 'Cookies hết hạn hoặc tài khoản bị checkpoint.',
                };
            }

            await randomDelay(1500, 2500);
            await dismissPopups(page);

            // ── Bước 3: Click vào ô "Bạn đang nghĩ gì?" trên Newsfeed ──
            console.log('📌 Đang tìm ô viết bài trên Trang cá nhân...');
            const createPostSelectors = [
                'div[role="button"] span:has-text("Bạn đang nghĩ gì")',
                'div[role="button"] span:has-text("What\'s on your mind")',
                'div[role="button"][tabindex="0"]:has-text("Bạn đang nghĩ gì")',
            ];

            let createPostClicked = false;
            for (const selector of createPostSelectors) {
                try {
                    const el = await page.waitForSelector(selector, { timeout: 8000 });
                    if (el) {
                        await el.click();
                        createPostClicked = true;
                        console.log('  ✅ Đã click ô viết bài');
                        break;
                    }
                } catch {
                    continue;
                }
            }

            if (!createPostClicked) {
                return {
                    success: false,
                    error: 'Không tìm thấy ô "Bạn đang nghĩ gì?" trên trang chủ.',
                };
            }

            await randomDelay(1500, 2500);
            await dismissPopups(page);

            // ── Bước 4: Gõ nội dung ──
            console.log('⌨️ Đang gõ nội dung...');
            const editorSelectors = [
                'div[role="dialog"] div[contenteditable="true"][role="textbox"]',
                'div[role="dialog"] div[contenteditable="true"]',
            ];

            let editorFound = false;
            for (const selector of editorSelectors) {
                try {
                    const editor = await page.waitForSelector(selector, { timeout: 5000 });
                    if (editor) {
                        await editor.click();
                        await randomDelay(300, 600);

                        for (const char of message) {
                            await page.keyboard.type(char, {
                                delay: Math.floor(Math.random() * 80) + 20,
                            });
                        }

                        editorFound = true;
                        console.log('  ✅ Đã gõ nội dung xong');
                        break;
                    }
                } catch {
                    continue;
                }
            }

            if (!editorFound) {
                return {
                    success: false,
                    error: 'Không tìm thấy editor để gõ nội dung.',
                };
            }

            await randomDelay(1000, 2000);

            // ── Bước 5: Upload ảnh (nếu có) ──
            if (imagePaths && imagePaths.length > 0) {
                console.log(`📸 Đang upload ${imagePaths.length} ảnh...`);

                // Dùng setInputFiles trực tiếp vào input[ẩn] — không click nút để tránh mở file explorer
                const fileInput = await page.waitForSelector(
                    'div[role="dialog"] input[type="file"][accept*="image"]',
                    { state: 'attached', timeout: 10000 }
                );

                if (fileInput) {
                    await fileInput.setInputFiles(imagePaths);
                    console.log(`  ✅ Đã upload ${imagePaths.length} ảnh`);
                    await randomDelay(
                        imagePaths.length * 2000,
                        imagePaths.length * 4000
                    );
                }
            }

            // ── Bước 6: Nhấn nút Đăng ──
            console.log('🚀 Đang nhấn nút Đăng...');
            const postButtonSelectors = [
                'div[role="dialog"] div[aria-label="Đăng"][role="button"]',
                'div[role="dialog"] div[aria-label="Post"][role="button"]',
                'div[role="dialog"] div[aria-label="Đăng"]',
                'div[role="dialog"] div[aria-label="Post"]',
            ];

            let posted = false;
            for (const selector of postButtonSelectors) {
                try {
                    const btn = await page.waitForSelector(selector, { timeout: 5000 });
                    if (btn) {
                        await randomDelay(500, 1000);
                        await btn.click();
                        posted = true;
                        console.log('  ✅ Đã nhấn nút Đăng');
                        break;
                    }
                } catch {
                    continue;
                }
            }

            if (!posted) {
                return {
                    success: false,
                    error: 'Không tìm thấy nút "Đăng".',
                };
            }

            // ── Bước 7: Chờ hoàn tất ──
            console.log('⏳ Đang chờ bài đăng được xử lý...');
            await randomDelay(5000, 8000);

            try {
                await page.waitForSelector('div[role="dialog"]', {
                    state: 'detached',
                    timeout: 30000,
                });
                console.log('✅ Đăng bài lên Trang cá nhân thành công!');
            } catch {
                console.log('⚠️ Dialog vẫn còn mở, bài có thể đang được xử lý...');
            }

            await randomDelay(2000, 3000);

            return {
                success: true,
                message: 'Đăng bài lên Trang cá nhân thành công',
            };
        } catch (error) {
            console.error('❌ Lỗi khi đăng bài lên Profile:', error.message);
            return {
                success: false,
                error: error.message,
            };
        } finally {
            if (browser) {
                await browser.close();
                console.log('🔒 Đã đóng trình duyệt');
            }
        }
    }

    /**
     * Kiểm tra cookies có còn hoạt động không (Health Check)
     * Mở browser headless → inject cookies → verify → trả kết quả → đóng browser
     *
     * @param {Array} cookies - Mảng cookies Playwright format
     * @param {object|null} proxy - Proxy { server, username, password }
     * @returns {{ healthy: boolean, status: string, reason: string }}
     */
    async checkLogin(cookies, proxy = null) {
        let browser;

        try {
            console.log('\n🩺 [Health Check] Đang kiểm tra tài khoản...');

            const { browser: br, page } = await this._initBrowser(
                cookies,
                proxy,
                true // headless: true cho health check
            );
            browser = br;

            // Navigate tới Facebook
            await page.goto('https://www.facebook.com/', {
                waitUntil: 'domcontentloaded',
                timeout: 30000,
            });
            await randomDelay(2000, 3000);
            await dismissPopups(page);

            // Kiểm tra URL
            const url = page.url();

            if (url.includes('/checkpoint')) {
                console.log('🟠 [Health Check] Tài khoản bị checkpoint');
                return {
                    healthy: false,
                    status: 'checkpoint',
                    reason: 'Tài khoản bị checkpoint. Cần xác minh danh tính trên Facebook.',
                };
            }

            if (url.includes('/login')) {
                console.log('🔴 [Health Check] Cookies đã hết hạn');
                return {
                    healthy: false,
                    status: 'expired',
                    reason: 'Cookies đã hết hạn. Cần export cookies mới từ trình duyệt.',
                };
            }

            console.log('🟢 [Health Check] Tài khoản hoạt động bình thường');
            return {
                healthy: true,
                status: 'healthy',
                reason: 'Cookies hoạt động bình thường.',
            };
        } catch (error) {
            console.error('❌ [Health Check] Lỗi:', error.message);
            return {
                healthy: false,
                status: 'expired',
                reason: `Lỗi kiểm tra: ${error.message}`,
            };
        } finally {
            if (browser) {
                await browser.close();
                console.log('🔒 [Health Check] Đã đóng browser');
            }
        }
    }

    /**
     * Đồng bộ danh sách Groups đã tham gia
     * @param {Array} cookies - Mảng cookies Playwright format
     * @param {object|null} proxy - Proxy { server, username, password }
     * @returns {{ success: boolean, groups: Array, error: string }}
     */
    async fetchAccountGroups(cookies, proxy = null) {
        let browser;
        try {
            console.log('\n🔄 [Sync] Đang lấy danh sách Group...');
            const { browser: br, page } = await this._initBrowser(cookies, proxy, true);
            browser = br;

            const isLoggedIn = await this._verifyLogin(page);
            if (!isLoggedIn) {
                return { success: false, error: 'Cookies hết hạn hoặc bị checkpoint.' };
            }

            await page.goto('https://www.facebook.com/groups/joins', { waitUntil: 'domcontentloaded', timeout: 30000 });
            await randomDelay(2000, 3000);
            await dismissPopups(page);

            // Scroll a bit to load more groups
            for (let i = 0; i < 5; i++) {
                await page.mouse.wheel(0, 2000);
                await randomDelay(1000, 2000);
            }

            const groups = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a[href*="/groups/"]'));
                const result = {};
                links.forEach(a => {
                    const url = a.getAttribute('href');
                    const name = a.innerText.trim();
                    const match = url.match(/\/groups\/([^\/\?]+)/);

                    const lowerName = name.toLowerCase();
                    if (
                        match && name && name.length > 2 &&
                        !lowerName.includes('tham gia') &&
                        !lowerName.includes('join') &&
                        !lowerName.includes('xem nhóm') &&
                        !lowerName.includes('view group')
                    ) {
                        const id = match[1];
                        if (id !== 'joins' && id !== 'discover' && id !== 'create' && id !== 'feed') {
                            // Chỉ lấy dòng đầu tiên nếu có nhiều dòng rớt vào
                            result[id] = name.split('\n')[0];
                        }
                    }
                });
                return Object.keys(result).map(id => ({ id, name: result[id] }));
            });

            console.log(`✅ [Sync] Đã tìm thấy ${groups.length} groups.`);
            return { success: true, groups };
        } catch (error) {
            console.error('❌ [Sync] Lỗi:', error.message);
            return { success: false, error: error.message };
        } finally {
            if (browser) await browser.close();
        }
    }

    /**
     * Đồng bộ danh sách Pages quản lý
     * @param {Array} cookies - Mảng cookies Playwright format
     * @param {object|null} proxy - Proxy
     */
    async fetchAccountPages(cookies, proxy = null) {
        let browser;
        try {
            console.log('\n🔄 [Sync] Đang lấy danh sách Page...');
            const { browser: br, page } = await this._initBrowser(cookies, proxy, true);
            browser = br;

            const isLoggedIn = await this._verifyLogin(page);
            if (!isLoggedIn) {
                return { success: false, error: 'Cookies hết hạn hoặc bị checkpoint.' };
            }

            await page.goto('https://www.facebook.com/pages', { waitUntil: 'domcontentloaded', timeout: 30000 });
            await randomDelay(2000, 3000);
            await dismissPopups(page);

            for (let i = 0; i < 3; i++) {
                await page.mouse.wheel(0, 1000);
                await randomDelay(1000, 1500);
            }

            const pages = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a[href*="facebook.com/"]'));
                const result = {};
                links.forEach(a => {
                    const url = a.getAttribute('href');
                    const name = a.innerText.trim();
                    // Just a heuristic for now, /pages usually lists them nicely but FB DOM is obscure
                    if (url && name && name.length > 2 && !url.includes('/groups/') && !url.includes('/events/') && !url.includes('/friends/')) {
                        // Extract vanity or id
                        const match = url.match(/facebook\.com\/([^\/\?]+)/);
                        if (match) {
                            const id = match[1];
                            const ignored = ['pages', 'watch', 'marketplace', 'gaming', 'groups', 'friends', 'bookmarks', 'events', 'jobs', 'memories'];
                            if (!ignored.includes(id)) {
                                result[id] = name.split('\n')[0];
                            }
                        }
                    }
                });
                return Object.keys(result).map(id => ({ id, name: result[id] }));
            });

            console.log(`✅ [Sync] Đã tìm thấy ${pages.length} pages (có thể lẫn profile).`);
            return { success: true, pages };
        } catch (error) {
            console.error('❌ [Sync] Lỗi:', error.message);
            return { success: false, error: error.message };
        } finally {
            if (browser) await browser.close();
        }
    }
}

module.exports = new FacebookAutomationService();
