package com.comicaggregator.controller;

import com.comicaggregator.service.ScraperService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/proxy")
public class ProxyController {

    @Value("${app.cache.dir}")
    private String cacheDir;

    @Value("${app.cache.ttl-days}")
    private int cacheTtlDays;

    private final ScraperService scraperService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public ProxyController(ScraperService scraperService) {
        this.scraperService = scraperService;
    }

    @GetMapping("/image")
    public ResponseEntity<byte[]> proxyImage(@RequestParam String url) {
        try {
            Path cachePath = Paths.get(cacheDir);
            if (!Files.exists(cachePath)) {
                Files.createDirectories(cachePath);
            }

            String fileName = getCacheFileName(url);
            Path filePath = cachePath.resolve(fileName);

            boolean useCache = false;
            if (Files.exists(filePath)) {
                Instant fileTime = Files.getLastModifiedTime(filePath).toInstant();
                Instant expirationTime = fileTime.plus(Duration.ofDays(cacheTtlDays));
                if (Instant.now().isBefore(expirationTime)) {
                    useCache = true;
                }
            }

            byte[] imageBytes;
            String contentType = "image/jpeg"; // Default fallback

            if (useCache) {
                imageBytes = Files.readAllBytes(filePath);
                // Simple contentType detection based on file signature
                if (imageBytes.length > 4) {
                    if (imageBytes[0] == (byte) 0x89 && imageBytes[1] == (byte) 0x50 && imageBytes[2] == (byte) 0x4E && imageBytes[3] == (byte) 0x47) {
                        contentType = "image/png";
                    } else if (imageBytes[0] == (byte) 0x47 && imageBytes[1] == (byte) 0x49 && imageBytes[2] == (byte) 0x46) {
                        contentType = "image/gif";
                    } else if (imageBytes[0] == (byte) 0x52 && imageBytes[1] == (byte) 0x49 && imageBytes[2] == (byte) 0x46 && imageBytes[3] == (byte) 0x46) {
                        contentType = "image/webp";
                    }
                }
            } else {
                // Fetch from source
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
                    imageBytes = response.body();
                    contentType = response.headers().firstValue("Content-Type").orElse("image/jpeg");
                    // Save to local disk cache
                    Files.write(filePath, imageBytes);
                } else {
                    return ResponseEntity.status(response.statusCode()).build();
                }
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(contentType));
            headers.setCacheControl("public, max-age=" + (cacheTtlDays * 24 * 60 * 60));

            return new ResponseEntity<>(imageBytes, headers, HttpStatus.OK);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    private String getCacheFileName(String url) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(url.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            return String.valueOf(url.hashCode());
        }
    }

    // Real API endpoints calling scraper extension via Node.js Runner
    @PostMapping("/browse")
    public ResponseEntity<?> proxyBrowse(@RequestBody Map<String, Object> body) {
        String source = (String) body.get("source");
        String query = (String) body.get("query");
        if (source == null || source.trim().isEmpty()) {
            source = "MangaDex";
        }

        try {
            System.out.println("[DEBUG] Browse request - source: " + source + ", query: " + query);
            String resultJson;
            
            // Build parameters map to pass into extension
            java.util.Map<String, Object> params = new java.util.HashMap<>();
            if (query != null) params.put("query", query);
            if (body.get("status") != null) params.put("status", body.get("status"));
            if (body.get("genres") != null) params.put("genres", body.get("genres"));
            if (body.get("sortBy") != null) params.put("sortBy", body.get("sortBy"));

            // If we have filters but no search query, we should still call "search" to execute advanced filtering!
            boolean hasFilters = body.get("status") != null || body.get("genres") != null || body.get("sortBy") != null;

            if ((query != null && !query.trim().isEmpty()) || hasFilters) {
                resultJson = scraperService.runExtension(source, "search", params);
            } else {
                resultJson = scraperService.runExtension(source, "getLatest", Map.of());
            }
            System.out.println("[DEBUG] Browse result: " + (resultJson != null ? resultJson.substring(0, Math.min(100, resultJson.length())) + "..." : "null"));
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .body(resultJson);
        } catch (Exception e) {
            System.err.println("[ERROR] Failed to browse: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to browse: " + e.getMessage()));
        }
    }

    @PostMapping("/detail")
    public ResponseEntity<?> proxyDetail(@RequestBody Map<String, Object> body) {
        String source = (String) body.get("source");
        String comicId = (String) body.get("comicId");
        if (source == null || source.trim().isEmpty()) {
            source = "MangaDex";
        }

        try {
            String resultJson = scraperService.runExtension(source, "getDetail", Map.of("comicId", comicId));
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .body(resultJson);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to load detail: " + e.getMessage()));
        }
    }

    @PostMapping("/chapters")
    public ResponseEntity<?> proxyChapters(@RequestBody Map<String, Object> body) {
        String source = (String) body.get("source");
        String comicId = (String) body.get("comicId");
        if (source == null || source.trim().isEmpty()) {
            source = "MangaDex";
        }

        try {
            String resultJson = scraperService.runExtension(source, "getDetail", Map.of("comicId", comicId));
            Map<String, Object> data = objectMapper.readValue(resultJson, Map.class);
            Object chapters = data.get("chapters");
            return ResponseEntity.ok(chapters);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to load chapters: " + e.getMessage()));
        }
    }

    @PostMapping("/pages")
    public ResponseEntity<?> proxyPages(@RequestBody Map<String, Object> body) {
        String source = (String) body.get("source");
        String comicId = (String) body.get("comicId");
        String chapterId = (String) body.get("chapterId");
        if (source == null || source.trim().isEmpty()) {
            source = "MangaDex";
        }

        try {
            String resultJson = scraperService.runExtension(source, "getPages", Map.of("comicId", comicId, "chapterId", chapterId));
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .body(resultJson);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to load pages: " + e.getMessage()));
        }
    }

    @Value("${app.extensions.dir}")
    private String extensionsDir;

    @GetMapping(value = "/registry/{filename}", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getRegistryFile(@PathVariable String filename) {
        try {
            Path path = Paths.get(extensionsDir).resolve("registry").resolve(filename);
            if (!Files.exists(path)) {
                return ResponseEntity.notFound().build();
            }
            String content = Files.readString(path, StandardCharsets.UTF_8);
            return ResponseEntity.ok(content);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
