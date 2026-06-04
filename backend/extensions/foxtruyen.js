const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://foxtruyen2.com';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': BASE_URL + '/'
};

function extractComicSlug(href) {
    if (!href) return '';
    const match = href.match(/truyen-tranh\/([^\/\?#]+)/);
    if (match) {
        return match[1].replace('.html', '');
    }
    return '';
}

module.exports = {
    name: "FoxTruyen",
    version: "1.0.0",

    async getLatest() {
        try {
            const url = BASE_URL + '/truyen-moi-cap-nhat/trang-1.html';
            const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
            const $ = cheerio.load(response.data);

            const comics = [];
            $('.list_item_home .item_home').each((i, el) => {
                const $el = $(el);
                const titleEl = $el.find('a.book_name').first();
                const title = titleEl.text().trim();
                const href = titleEl.attr('href') || '';
                const slug = extractComicSlug(href);
                const coverImg = $el.find('.image-cover img').first();
                const coverUrl = coverImg.attr('data-src') || coverImg.attr('src') || '';

                if (title && slug) {
                    comics.push({
                        id: slug,
                        title: title,
                        source: "FoxTruyen",
                        coverUrl: coverUrl,
                        description: '',
                        author: 'FoxTruyen',
                        status: 'Đang cập nhật',
                        tags: []
                    });
                }
            });

            return comics;
        } catch (error) {
            throw new Error("Failed to fetch latest from FoxTruyen: " + error.message);
        }
    },

    async search(params) {
        const query = (params.query || '').trim();
        if (!query) {
            return this.getLatest();
        }

        try {
            const url = BASE_URL + '/tim-kiem.html?q=' + encodeURIComponent(query);
            const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
            const $ = cheerio.load(response.data);

            const comics = [];
            $('.list_item_home .item_home').each((i, el) => {
                const $el = $(el);
                const titleEl = $el.find('a.book_name').first();
                const title = titleEl.text().trim();
                const href = titleEl.attr('href') || '';
                const slug = extractComicSlug(href);
                const coverImg = $el.find('.image-cover img').first();
                const coverUrl = coverImg.attr('data-src') || coverImg.attr('src') || '';

                if (title && slug) {
                    comics.push({
                        id: slug,
                        title: title,
                        source: "FoxTruyen",
                        coverUrl: coverUrl,
                        description: '',
                        author: 'FoxTruyen',
                        status: 'Đang cập nhật',
                        tags: []
                    });
                }
            });

            return comics;
        } catch (error) {
            throw new Error("Failed to search FoxTruyen: " + error.message);
        }
    },

    async getDetail(params) {
        const comicId = params.comicId;
        if (!comicId) {
            throw new Error("comicId is required");
        }

        try {
            const slug = comicId.endsWith('.html') ? comicId : comicId + '.html';
            const url = BASE_URL + '/truyen-tranh/' + slug;
            const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
            const $ = cheerio.load(response.data);

            const title = $('.fx-info__title').first().text().trim() || comicId;
            const coverImg = $('.fx-cover img.fx-cover__img').first();
            const coverUrl = coverImg.attr('src') || coverImg.attr('data-src') || '';

            let author = 'Đang cập nhật';
            $('.fx-meta__row').each((i, el) => {
                const label = $(el).find('.fx-meta__label').text().trim();
                if (label.includes('Tác giả')) {
                    const authorText = $(el).find('.fx-meta__val a.org').text().trim();
                    if (authorText) author = authorText;
                }
            });

            let status = 'Đang cập nhật';
            const statusText = $('.fx-status').text().trim();
            if (statusText) {
                status = statusText.includes('Hoàn thành') || statusText.includes('Full') ? 'Đã hoàn thành' : 'Đang cập nhật';
            }

            let description = $('meta[name="description"]').attr('content') || '';
            if (description.length > 500) {
                description = description.substring(0, 500) + '...';
            }

            const tags = [];
            $('.fx-genres a.fx-genre').each((i, el) => {
                const tagText = $(el).text().trim();
                if (tagText) tags.push(tagText);
            });

            const chapters = [];
            $('.fx-chap-list li.fx-chap-item').each((i, el) => {
                const chapterLink = $(el).find('a.fx-chap-item__name').first();
                const chapterTitle = chapterLink.text().trim();
                const chapterHref = chapterLink.attr('href') || '';
                const chapterSlug = extractComicSlug(chapterHref);

                if (chapterTitle && chapterHref) {
                    chapters.push({
                        id: chapterSlug || chapterHref,
                        title: chapterTitle,
                        comicId: comicId,
                        source: "FoxTruyen"
                    });
                }
            });

            return {
                id: comicId,
                title: title,
                source: "FoxTruyen",
                coverUrl: coverUrl,
                description: description,
                author: author,
                status: status,
                tags: tags.slice(0, 6),
                chapters: chapters
            };
        } catch (error) {
            throw new Error("Failed to load FoxTruyen details for: " + comicId + ". Error: " + error.message);
        }
    },

    async getPages(params) {
        const chapterId = params.chapterId;
        if (!chapterId) {
            throw new Error("chapterId is required");
        }

        try {
            const slug = chapterId.endsWith('.html') ? chapterId : chapterId + '.html';
            const url = BASE_URL + '/truyen-tranh/' + slug;
            const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
            const $ = cheerio.load(response.data);

            const pages = [];
            $('.content_detail img.lazy, .content_detail_manga img.lazy').each((i, el) => {
                const src = $(el).attr('data-src') || $(el).attr('src') || '';
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
