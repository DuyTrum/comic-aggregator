package com.comicaggregator.controller;

import com.comicaggregator.model.DownloadedChapter;
import com.comicaggregator.repository.DownloadedChapterRepository;
import com.comicaggregator.service.ScraperService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController
@RequestMapping("/api/download")
public class DownloadController {

    private final DownloadedChapterRepository repository;
    private final ScraperService scraperService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ExecutorService executorService = Executors.newFixedThreadPool(3);

    @Value("${app.download.dir}")
    private String downloadDir;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public DownloadController(DownloadedChapterRepository repository, ScraperService scraperService) {
        this.repository = repository;
        this.scraperService = scraperService;
    }

    @GetMapping("/list")
    public ResponseEntity<List<DownloadedChapter>> getDownloadedList() {
        return ResponseEntity.ok(repository.findAll());
    }

    @GetMapping("/status/{chapterId}")
    public ResponseEntity<?> getDownloadStatus(@PathVariable String chapterId) {
        Optional<DownloadedChapter> chapter = repository.findByChapterId(chapterId);
        if (chapter.isEmpty()) {
            return ResponseEntity.ok(Map.of("status", "NOT_DOWNLOADED"));
        }
        return ResponseEntity.ok(chapter.get());
    }

    @GetMapping("/comic/{comicId}")
    public ResponseEntity<List<DownloadedChapter>> getDownloadedChaptersByComic(@PathVariable String comicId) {
        return ResponseEntity.ok(repository.findByComicId(comicId));
    }

    @PostMapping("/chapter")
    public ResponseEntity<?> downloadChapter(@RequestBody Map<String, String> payload) {
        String comicId = payload.get("comicId");
        String comicTitle = payload.get("comicTitle");
        String comicCover = payload.get("comicCover");
        String source = payload.get("source");
        String chapterId = payload.get("chapterId");
        String chapterTitle = payload.get("chapterTitle");

        if (comicId == null || chapterId == null || source == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing required fields"));
        }

        Optional<DownloadedChapter> existing = repository.findByComicIdAndChapterId(comicId, chapterId);
        if (existing.isPresent() && (existing.get().getStatus().equals("COMPLETED") || existing.get().getStatus().equals("DOWNLOADING"))) {
            return ResponseEntity.ok(existing.get());
        }

        DownloadedChapter chapter;
        if (existing.isPresent()) {
            chapter = existing.get();
            chapter.setStatus("PENDING");
            chapter.setDownloadedPages(0);
            chapter.setDownloadedAt(LocalDateTime.now());
        } else {
            chapter = DownloadedChapter.builder()
                    .comicId(comicId)
                    .comicTitle(comicTitle)
                    .comicCover(comicCover)
                    .source(source)
                    .chapterId(chapterId)
                    .chapterTitle(chapterTitle)
                    .status("PENDING")
                    .downloadedPages(0)
                    .totalPages(0)
                    .downloadedAt(LocalDateTime.now())
                    .build();
        }
        repository.save(chapter);

        // Run background thread for downloading
        executorService.submit(() -> startDownloadProcess(chapter));

        return ResponseEntity.ok(chapter);
    }

    @DeleteMapping("/{chapterId}")
    public ResponseEntity<?> deleteDownload(@PathVariable String chapterId) {
        Optional<DownloadedChapter> chapterOpt = repository.findByChapterId(chapterId);
        if (chapterOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        DownloadedChapter chapter = chapterOpt.get();

        Path dirPath = Paths.get(downloadDir)
                .resolve(sanitizePath(chapter.getSource()))
                .resolve(sanitizePath(chapter.getComicId()))
                .resolve(sanitizePath(chapter.getChapterId()));
        deleteDir(dirPath.toFile());

        repository.delete(chapter);
        return ResponseEntity.ok(Map.of("message", "Chapter deleted successfully"));
    }

    @GetMapping("/image/{chapterId}/{pageIndex}")
    public ResponseEntity<byte[]> getOfflineImage(@PathVariable String chapterId, @PathVariable int pageIndex) {
        try {
            Optional<DownloadedChapter> chapterOpt = repository.findByChapterId(chapterId);
            if (chapterOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            DownloadedChapter chapter = chapterOpt.get();

            Path filePath = Paths.get(downloadDir)
                    .resolve(sanitizePath(chapter.getSource()))
                    .resolve(sanitizePath(chapter.getComicId()))
                    .resolve(sanitizePath(chapter.getChapterId()))
                    .resolve("page_" + pageIndex);

            if (!Files.exists(filePath)) {
                return ResponseEntity.notFound().build();
            }

            byte[] imageBytes = Files.readAllBytes(filePath);
            String contentType = "image/jpeg"; // default

            if (imageBytes.length > 4) {
                if (imageBytes[0] == (byte) 0x89 && imageBytes[1] == (byte) 0x50 && imageBytes[2] == (byte) 0x4E && imageBytes[3] == (byte) 0x47) {
                    contentType = "image/png";
                } else if (imageBytes[0] == (byte) 0x47 && imageBytes[1] == (byte) 0x49 && imageBytes[2] == (byte) 0x46) {
                    contentType = "image/gif";
                } else if (imageBytes[0] == (byte) 0x52 && imageBytes[1] == (byte) 0x49 && imageBytes[2] == (byte) 0x46 && imageBytes[3] == (byte) 0x46) {
                    contentType = "image/webp";
                }
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(contentType));
            headers.setCacheControl("public, max-age=604800"); // cache locally for 7 days

            return new ResponseEntity<>(imageBytes, headers, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    private void startDownloadProcess(DownloadedChapter chapter) {
        try {
            chapter.setStatus("DOWNLOADING");
            repository.save(chapter);

            String[] parts = chapter.getComicId().split("::");
            String realComicId = parts.length > 1 ? parts[1] : chapter.getComicId();

            // Run scraper to get pages list
            String resultJson = scraperService.runExtension(chapter.getSource(), "getPages",
                    Map.of("comicId", realComicId, "chapterId", chapter.getChapterId()));
            List<?> pageUrls = objectMapper.readValue(resultJson, List.class);

            if (pageUrls == null || pageUrls.isEmpty()) {
                throw new RuntimeException("No pages found for chapter");
            }

            chapter.setTotalPages(pageUrls.size());
            repository.save(chapter);

            Path downloadPath = Paths.get(downloadDir)
                    .resolve(sanitizePath(chapter.getSource()))
                    .resolve(sanitizePath(chapter.getComicId()))
                    .resolve(sanitizePath(chapter.getChapterId()));
            
            if (!Files.exists(downloadPath)) {
                Files.createDirectories(downloadPath);
            }

            int downloadedCount = 0;
            for (int i = 0; i < pageUrls.size(); i++) {
                String url = (String) pageUrls.get(i);
                byte[] bytes = downloadImageWithRetry(url, 3);
                
                if (bytes == null) {
                    throw new RuntimeException("Failed to download page " + i);
                }

                Path pageFile = downloadPath.resolve("page_" + i);
                Files.write(pageFile, bytes);

                downloadedCount++;
                chapter.setDownloadedPages(downloadedCount);
                repository.save(chapter);
            }

            chapter.setStatus("COMPLETED");
            chapter.setDownloadedAt(LocalDateTime.now());
            repository.save(chapter);

        } catch (Exception e) {
            System.err.println("[ERROR] Failed to download chapter " + chapter.getChapterId() + ": " + e.getMessage());
            chapter.setStatus("FAILED");
            repository.save(chapter);
        }
    }

    private byte[] downloadImageWithRetry(String url, int retries) {
        URI uri = URI.create(url);
        String host = uri.getHost();
        String referer = "";
        if (host != null) {
            if (host.contains("truyenvua.com") || host.contains("hinhhinh.com") || host.contains("tintruyen.net")) {
                referer = "https://truyenqqko.com/";
            } else {
                referer = "https://" + host + "/";
            }
        }

        for (int attempt = 1; attempt <= retries; attempt++) {
            try {
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(uri)
                        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                        .header("Referer", referer)
                        .header("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8")
                        .timeout(Duration.ofSeconds(15))
                        .GET()
                        .build();

                HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
                if (response.statusCode() == 200) {
                    return response.body();
                }
            } catch (Exception e) {
                System.err.println("[WARN] Retry " + attempt + " failed for image: " + url + " - " + e.getMessage());
            }
        }
        return null;
    }

    private String sanitizePath(String path) {
        if (path == null) return "";
        return path.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    private void deleteDir(File file) {
        File[] contents = file.listFiles();
        if (contents != null) {
            for (File f : contents) {
                deleteDir(f);
            }
        }
        file.delete();
    }
}
