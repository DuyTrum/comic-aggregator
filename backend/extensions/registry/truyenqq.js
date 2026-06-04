const axios = require('axios');
const cheerio = require('cheerio');

// TruyenQQ scraper extension v1.0.0
// Scrapes Vietnamese manga from truyenqqko.com
const BASE_URL = 'https://truyenqqko.com';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': BASE_URL + '/'
};

function extractComicSlug(href) {
    // Extract slug from URL like /truyen-tranh/one-piece-1-128 or full URL
    if (!href) return '';
    const match = href.match(/truyen-tranh\/([^\/\?#]+)/);
    return match ? match[1] : '';
}

module.exports = {
    name: "TruyenQQ",
    version: "1.0.0",

    async getLatest() {
        try {
            const url = BASE_URL + '/truyen-moi-cap-nhat/trang-1.html';
            const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
            const $ = cheerio.load(response.data);

            const comics = [];
            $('ul.list_grid li').each((i, el) => {
                const $el = $(el);
                const titleEl = $el.find('.book_name a').first();
                const title = titleEl.text().trim();
                const href = titleEl.attr('href') || $el.find('.book_avatar a').attr('href') || '';
                const slug = extractComicSlug(href);
                const coverImg = $el.find('.book_avatar img').first();
                const coverUrl = coverImg.attr('src') || coverImg.attr('data-original') || '';

                if (title && slug) {
                    comics.push({
                        id: slug,
                        title: title,
                        source: "TruyenQQ",
                        coverUrl: coverUrl,
                        description: '',
                        author: 'TruyenQQ',
                        status: 'Đang cập nhật',
                        tags: []
                    });
                }
            });

            return comics;
        } catch (error) {
            throw new Error("Failed to fetch latest from TruyenQQ: " + error.message);
        }
    },

    async search(params) {
        const query = (params.query || '').trim().toLowerCase();
        if (!query) {
            return this.getLatest();
        }

        try {
            // TruyenQQ search is JS-rendered, so we fetch multiple latest pages and filter client-side
            // Fetch first 3 pages of latest updates for broader coverage
            const allComics = [];
            for (let page = 1; page <= 3; page++) {
                const url = BASE_URL + `/truyen-moi-cap-nhat/trang-${page}.html`;
                const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
                const $ = cheerio.load(response.data);

                $('ul.list_grid li').each((i, el) => {
                    const $el = $(el);
                    const titleEl = $el.find('.book_name a').first();
                    const title = titleEl.text().trim();
                    const href = titleEl.attr('href') || $el.find('.book_avatar a').attr('href') || '';
                    const slug = extractComicSlug(href);
                    const coverImg = $el.find('.book_avatar img').first();
                    const coverUrl = coverImg.attr('src') || coverImg.attr('data-original') || '';

                    if (title && slug) {
                        allComics.push({
                            id: slug,
                            title: title,
                            source: "TruyenQQ",
                            coverUrl: coverUrl,
                            description: '',
                            author: 'TruyenQQ',
                            status: 'Đang cập nhật',
                            tags: []
                        });
                    }
                });
            }

            // Client-side filter by keyword
            const filtered = allComics.filter(c =>
                c.title.toLowerCase().includes(query) ||
                c.id.toLowerCase().includes(query.replace(/\s+/g, '-'))
            );

            return filtered.length > 0 ? filtered : allComics.slice(0, 30);
        } catch (error) {
            throw new Error("Failed to search TruyenQQ: " + error.message);
        }
    },

    async getDetail(params) {
        const comicId = params.comicId;
        if (!comicId) {
            throw new Error("comicId is required");
        }

        try {
            const url = BASE_URL + '/truyen-tranh/' + comicId;
            const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
            const $ = cheerio.load(response.data);

            // Title
            const title = $('h1').first().text().trim() || comicId;

            // Cover image
            const coverImg = $('.book_avatar img').first();
            const coverUrl = coverImg.attr('src') || coverImg.attr('data-original') || '';

            // Description from .story-detail-info
            let description = '';
            const storyDetail = $('.story-detail-info');
            if (storyDetail.length > 0) {
                description = storyDetail.find('p').first().text().trim();
                if (!description) {
                    description = storyDetail.text().trim();
                }
            }
            if (!description) {
                const detailContent = $('.detail-content');
                if (detailContent.length > 0) {
                    description = detailContent.find('p').first().text().trim();
                }
            }
            if (description.length > 500) {
                description = description.substring(0, 500) + '...';
            }

            // Author from .list01 li (li[1] contains author info)
            let author = 'Đang cập nhật';
            $('.list01 li').each((i, el) => {
                const label = $(el).find('p.name').text().trim();
                if (label.includes('Tác giả')) {
                    const authorText = $(el).find('p.col-xs-9, a.org').text().trim();
                    if (authorText) author = authorText;
                }
            });

            // Status from .list01 li (li with 'Tình trạng' label)
            let status = 'Đang cập nhật';
            $('.list01 li').each((i, el) => {
                const label = $(el).find('p.name').text().trim();
                if (label.includes('Tình trạng')) {
                    const statusText = $(el).find('p.col-xs-9').text().trim();
                    if (statusText) {
                        status = statusText.includes('Hoàn thành') ? 'Đã hoàn thành' : 'Đang cập nhật';
                    }
                }
            });

            // Tags from .list01 links with /the-loai/ in href
            const tags = [];
            const seenTags = new Set();
            $('.list01 a').each((i, el) => {
                const href = $(el).attr('href') || '';
                const tagText = $(el).text().trim();
                if (href.includes('the-loai') && tagText && !seenTags.has(tagText)) {
                    seenTags.add(tagText);
                    tags.push(tagText);
                }
            });

            // Chapters from .works-chapter-item
            const chapters = [];
            $('.works-chapter-item').each((i, el) => {
                const chapterLink = $(el).find('.name-chap a').first();
                const chapterTitle = chapterLink.text().trim();
                const chapterHref = chapterLink.attr('href') || '';
                const chapterSlug = extractComicSlug(chapterHref);

                if (chapterTitle && chapterHref) {
                    // Use the full chapter path as the chapterId
                    // e.g. "cau-be-cua-than-chet-9441-chap-330"
                    chapters.push({
                        id: chapterSlug || chapterHref,
                        title: chapterTitle,
                        comicId: comicId,
                        source: "TruyenQQ"
                    });
                }
            });

            return {
                id: comicId,
                title: title,
                source: "TruyenQQ",
                coverUrl: coverUrl,
                description: description,
                author: author,
                status: status,
                tags: tags.slice(0, 6),
                chapters: chapters
            };
        } catch (error) {
            throw new Error("Failed to load TruyenQQ details for: " + comicId + ". Error: " + error.message);
        }
    },

    async getPages(params) {
        const chapterId = params.chapterId;
        if (!chapterId) {
            throw new Error("chapterId is required");
        }

        try {
            // chapterId is the slug like "cau-be-cua-than-chet-9441-chap-1"
            const url = BASE_URL + '/truyen-tranh/' + chapterId;
            const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
            const $ = cheerio.load(response.data);

            const pages = [];
            $('.page-chapter img, .chapter_content img').each((i, el) => {
                const src = $(el).attr('src') || $(el).attr('data-original') || '';
                if (src && !pages.includes(src)) {
                    pages.push(src);
                }
            });

            return pages;
        } catch (error) {
            throw new Error("Failed to fetch pages for chapter: " + chapterId + ". Error: " + error.message);
        }
    }
};
