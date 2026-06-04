const axios = require('axios');

// MangaDex scraper extension v1.0.0
module.exports = {
    name: "MangaDex",
    version: "1.0.0",

    async getLatest() {
        try {
            const url = 'https://api.mangadex.org/manga?limit=30&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive';
            const response = await axios.get(url, {
                headers: { 'User-Agent': 'ComicAggregator/1.0.0' }
            });

            const data = response.data.data;
            return data.map(manga => {
                const title = manga.attributes.title.en || manga.attributes.title.ja || Object.values(manga.attributes.title)[0] || 'Untitled';
                const description = manga.attributes.description.en || manga.attributes.description.ja || Object.values(manga.attributes.description)[0] || 'No description available.';
                
                const coverRel = manga.relationships.find(r => r.type === 'cover_art');
                const coverFileName = coverRel && coverRel.attributes ? coverRel.attributes.fileName : '';
                const coverUrl = coverFileName ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFileName}.256.jpg` : 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&q=80';

                return {
                    id: manga.id,
                    title: title,
                    source: "MangaDex",
                    coverUrl: coverUrl,
                    description: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
                    author: "MangaDex Creator",
                    status: manga.attributes.status === 'completed' ? 'Đã hoàn thành' : 'Đang tiến hành',
                    tags: manga.attributes.tags.slice(0, 4).map(t => t.attributes.name.en)
                };
            });
        } catch (error) {
            throw new Error("Failed to fetch latest from MangaDex: " + error.message);
        }
    },

    async search(params) {
        const query = (params.query || '').trim();
        if (!query) {
            return this.getLatest();
        }

        try {
            const url = `https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=30&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`;
            const response = await axios.get(url, {
                headers: { 'User-Agent': 'ComicAggregator/1.0.0' }
            });

            const data = response.data.data;
            return data.map(manga => {
                const title = manga.attributes.title.en || manga.attributes.title.ja || Object.values(manga.attributes.title)[0] || 'Untitled';
                const description = manga.attributes.description.en || manga.attributes.description.ja || Object.values(manga.attributes.description)[0] || 'No description available.';
                
                const coverRel = manga.relationships.find(r => r.type === 'cover_art');
                const coverFileName = coverRel && coverRel.attributes ? coverRel.attributes.fileName : '';
                const coverUrl = coverFileName ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFileName}.256.jpg` : 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&q=80';

                return {
                    id: manga.id,
                    title: title,
                    source: "MangaDex",
                    coverUrl: coverUrl,
                    description: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
                    author: "MangaDex Creator",
                    status: manga.attributes.status === 'completed' ? 'Đã hoàn thành' : 'Đang tiến hành',
                    tags: manga.attributes.tags.slice(0, 4).map(t => t.attributes.name.en)
                };
            });
        } catch (error) {
            throw new Error(`Failed to search MangaDex for '${query}': ` + error.message);
        }
    },

    async getDetail(params) {
        const comicId = params.comicId;
        if (!comicId) {
            throw new Error("comicId is required");
        }

        try {
            // Get manga details
            const detailUrl = `https://api.mangadex.org/manga/${comicId}?includes[]=cover_art`;
            const detailResponse = await axios.get(detailUrl, {
                headers: { 'User-Agent': 'ComicAggregator/1.0.0' }
            });
            const manga = detailResponse.data.data;
            const title = manga.attributes.title.en || manga.attributes.title.ja || Object.values(manga.attributes.title)[0] || 'Untitled';
            const description = manga.attributes.description.en || manga.attributes.description.ja || Object.values(manga.attributes.description)[0] || 'No description available.';
            
            const coverRel = manga.relationships.find(r => r.type === 'cover_art');
            const coverFileName = coverRel && coverRel.attributes ? coverRel.attributes.fileName : '';
            const coverUrl = coverFileName ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFileName}.256.jpg` : 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&q=80';

            // Get chapters in all available languages to ensure every manga has chapters
            const chaptersUrl = `https://api.mangadex.org/manga/${comicId}/feed?limit=100&order[chapter]=asc&contentRating[]=safe&contentRating[]=suggestive`;
            const feedResponse = await axios.get(chaptersUrl, {
                headers: { 'User-Agent': 'ComicAggregator/1.0.0' }
            });

            // Map and filter unique chapter numbers per language to avoid duplicates
            const chaptersData = feedResponse.data.data;
            const seenChapters = new Set();
            const chapters = [];

            for (const ch of chaptersData) {
                const chapNum = ch.attributes.chapter || '0';
                const lang = ch.attributes.translatedLanguage || 'en';
                const key = `${chapNum}-${lang}`;
                
                if (!seenChapters.has(key)) {
                    seenChapters.add(key);
                    chapters.push({
                        id: ch.id,
                        title: `Chapter ${chapNum} [${lang.toUpperCase()}]${ch.attributes.title ? ': ' + ch.attributes.title : ''}`,
                        comicId: comicId,
                        source: "MangaDex"
                    });
                }
            }

            return {
                id: manga.id,
                title: title,
                source: "MangaDex",
                coverUrl: coverUrl,
                description: description,
                author: "MangaDex Creator",
                status: manga.attributes.status === 'completed' ? 'Đã hoàn thành' : 'Đang tiến hành',
                tags: manga.attributes.tags.slice(0, 4).map(t => t.attributes.name.en),
                chapters: chapters
            };
        } catch (error) {
            throw new Error(`Failed to load MangaDex details for: ${comicId}. Error: ` + error.message);
        }
    },

    async getPages(params) {
        const chapterId = params.chapterId;
        if (!chapterId) {
            throw new Error("chapterId is required");
        }

        try {
            const url = `https://api.mangadex.org/at-home/server/${chapterId}`;
            const response = await axios.get(url, {
                headers: { 'User-Agent': 'ComicAggregator/1.0.0' }
            });

            const host = response.data.baseUrl;
            const hash = response.data.chapter.hash;
            const filenames = response.data.chapter.data;

            // Construct page urls
            return filenames.map(file => `${host}/data/${hash}/${file}`);
        } catch (error) {
            throw new Error(`Failed to fetch pages for chapter: ${chapterId}. Error: ` + error.message);
        }
    }
};
