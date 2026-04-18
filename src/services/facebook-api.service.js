const axios = require('axios');

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

// ============================================================
// Error codes từ Facebook liên quan đến token & quyền truy cập
// ============================================================
const TOKEN_ERROR_CODES = [190, 102, 10, 200, 4];
const TOKEN_ERROR_SUBCODES = {
    458: 'App không được ủy quyền bởi người dùng',
    459: 'Session của người dùng đã bị thay đổi (đổi mật khẩu)',
    460: 'Session hết hạn (password changed)',
    463: 'Access token đã hết hạn',
    464: 'Session của người dùng không hợp lệ (logout)',
    467: 'Access token không hợp lệ (đã bị thu hồi)',
};

/**
 * Phân tích lỗi từ Facebook Graph API, trả về object rõ ràng
 * @param {Error} error - Axios error
 * @returns {object} - { code, subcode, message, type, isTokenError }
 */
const parseFacebookError = (error) => {
    const fbError = error.response?.data?.error;

    if (!fbError) {
        return {
            code: null,
            subcode: null,
            message: error.message || 'Lỗi không xác định khi gọi Facebook API',
            type: 'UNKNOWN',
            isTokenError: false,
        };
    }

    const isTokenError =
        TOKEN_ERROR_CODES.includes(fbError.code) ||
        Object.keys(TOKEN_ERROR_SUBCODES).includes(String(fbError.error_subcode));

    let detailMessage = fbError.message;

    // Bổ sung mô tả chi tiết nếu là lỗi token
    if (fbError.error_subcode && TOKEN_ERROR_SUBCODES[fbError.error_subcode]) {
        detailMessage += ` — ${TOKEN_ERROR_SUBCODES[fbError.error_subcode]}`;
    }

    return {
        code: fbError.code,
        subcode: fbError.error_subcode || null,
        message: detailMessage,
        type: fbError.type || 'OAuthException',
        isTokenError,
        fbTraceId: fbError.fbtrace_id || null,
    };
};

// ============================================================
// Facebook API Service
// ============================================================
class FacebookApiService {
    /**
     * Lấy thông tin Page (kiểm tra token còn hợp lệ không)
     * @param {string} pageToken - Access token của Page
     * @returns {object} - { id, name, ... }
     */
    async getPageInfo(pageToken) {
        try {
            const response = await axios.get(`${GRAPH_API_BASE}/me`, {
                params: {
                    access_token: pageToken,
                    fields: 'id,name,fan_count,link',
                },
            });
            return { success: true, data: response.data };
        } catch (error) {
            const parsed = parseFacebookError(error);
            return { success: false, error: parsed };
        }
    }

    /**
     * Upload 1 ảnh lên Facebook Page (unpublished) để lấy photo ID
     * - Ảnh sẽ KHÔNG được đăng công khai, chỉ để lấy fbid
     * - Sau đó dùng fbid này attach vào bài viết /feed
     *
     * @param {string} pageId - ID của Page
     * @param {string} pageToken - Access token
     * @param {string} imageUrl - URL ảnh cần upload
     * @returns {string} - photo ID (fbid)
     */
    async _uploadUnpublishedPhoto(pageId, pageToken, imageUrl) {
        const response = await axios.post(
            `${GRAPH_API_BASE}/${pageId}/photos`,
            null,
            {
                params: {
                    url: imageUrl,
                    published: false, // Upload ẩn, chỉ lấy ID
                    access_token: pageToken,
                },
            }
        );
        return response.data.id;
    }

    /**
     * Đăng bài lên Facebook Fanpage
     *
     * Logic:
     *   1. Nếu KHÔNG có ảnh → POST /feed với message
     *   2. Nếu có 1 ảnh → POST /photos với published=true (đăng thẳng)
     *   3. Nếu có nhiều ảnh → Upload từng ảnh unpublished → POST /feed kèm attached_media
     *
     * @param {string} pageToken - Access token của Page
     * @param {string} message - Nội dung bài viết
     * @param {string[]} images - Mảng URL ảnh (có thể rỗng)
     * @returns {object} - { success, postId, error }
     */
    async postToPage(pageToken, message, images = []) {
        try {
            // ── Bước 0: Lấy Page ID từ token ──
            const pageInfoRes = await axios.get(`${GRAPH_API_BASE}/me`, {
                params: { access_token: pageToken, fields: 'id' },
            });
            const pageId = pageInfoRes.data.id;

            // ── Case 1: Không có ảnh → Đăng text thuần ──
            if (!images || images.length === 0) {
                const response = await axios.post(
                    `${GRAPH_API_BASE}/${pageId}/feed`,
                    null,
                    {
                        params: {
                            message,
                            access_token: pageToken,
                        },
                    }
                );

                return {
                    success: true,
                    postId: response.data.id,
                    message: 'Đăng bài thành công (text)',
                };
            }

            // ── Case 2: 1 ảnh → Đăng trực tiếp qua /photos ──
            if (images.length === 1) {
                const response = await axios.post(
                    `${GRAPH_API_BASE}/${pageId}/photos`,
                    null,
                    {
                        params: {
                            url: images[0],
                            caption: message,
                            published: true,
                            access_token: pageToken,
                        },
                    }
                );

                return {
                    success: true,
                    postId: response.data.post_id || response.data.id,
                    message: 'Đăng bài thành công (1 ảnh)',
                };
            }

            // ── Case 3: Nhiều ảnh → Upload unpublished → kèm attached_media ──
            console.log(`📸 Đang upload ${images.length} ảnh (unpublished)...`);

            const photoIds = await Promise.all(
                images.map((imgUrl) =>
                    this._uploadUnpublishedPhoto(pageId, pageToken, imgUrl)
                )
            );

            // Tạo object attached_media[0], attached_media[1], ...
            const attachedMedia = {};
            photoIds.forEach((photoId, index) => {
                attachedMedia[`attached_media[${index}]`] = JSON.stringify({
                    media_fbid: photoId,
                });
            });

            const response = await axios.post(
                `${GRAPH_API_BASE}/${pageId}/feed`,
                null,
                {
                    params: {
                        message,
                        ...attachedMedia,
                        access_token: pageToken,
                    },
                }
            );

            return {
                success: true,
                postId: response.data.id,
                message: `Đăng bài thành công (${images.length} ảnh)`,
                uploadedPhotos: photoIds,
            };
        } catch (error) {
            const parsed = parseFacebookError(error);

            console.error('❌ Facebook API Error:', {
                code: parsed.code,
                subcode: parsed.subcode,
                message: parsed.message,
                isTokenError: parsed.isTokenError,
            });

            return {
                success: false,
                error: parsed,
            };
        }
    }
}

module.exports = new FacebookApiService();
