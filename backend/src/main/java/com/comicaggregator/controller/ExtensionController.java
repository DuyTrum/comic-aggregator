package com.comicaggregator.controller;

import com.comicaggregator.model.Extension;
import com.comicaggregator.repository.ExtensionRepository;
import com.comicaggregator.service.ScraperService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/extensions")
public class ExtensionController {

    private final ExtensionRepository extensionRepository;
    private final ScraperService scraperService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${app.extensions.dir}")
    private String extensionsDir;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public ExtensionController(ExtensionRepository extensionRepository, ScraperService scraperService) {
        this.extensionRepository = extensionRepository;
        this.scraperService = scraperService;
    }

    @GetMapping
    public ResponseEntity<List<Extension>> getAllExtensions() {
        return ResponseEntity.ok(extensionRepository.findAll());
    }

    @PostMapping("/load")
    public ResponseEntity<?> loadExtension(@RequestBody Map<String, String> body) {
        String url = body.get("url");
        if (url == null || url.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "URL is required"));
        }

        try {
            // 1. Fetch JS code from URL
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(15))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                return ResponseEntity.badRequest().body(Map.of("error", "Failed to download script. Status code: " + response.statusCode()));
            }

            String jsCode = response.body();

            // Create extension directory if not exists
            Path dirPath = Paths.get(extensionsDir);
            if (!Files.exists(dirPath)) {
                Files.createDirectories(dirPath);
            }

            // 2. Write to a temporary file to validate
            String tempFilename = "temp_" + UUID.randomUUID() + ".js";
            Path tempFilePath = dirPath.resolve(tempFilename);
            Files.writeString(tempFilePath, jsCode, StandardCharsets.UTF_8);

            // 3. Run runner.js with getMetadata to validate and read metadata
            String metadataJson;
            try {
                metadataJson = scraperService.runMethod(tempFilePath.toString(), "getMetadata", "{}");
            } catch (Exception e) {
                Files.deleteIfExists(tempFilePath);
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid extension script: " + e.getMessage()));
            } finally {
                Files.deleteIfExists(tempFilePath);
            }

            // Parse metadata
            Map<String, String> metadata = objectMapper.readValue(metadataJson, Map.class);
            String name = metadata.get("name");
            String version = metadata.get("version");

            if (name == null || name.trim().isEmpty() || name.equalsIgnoreCase("Unknown")) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid metadata: 'name' is required in exports"));
            }

            // Clean extension name (alphanumeric only)
            String cleanName = name.replaceAll("[^a-zA-Z0-9_-]", "");
            String filename = cleanName.toLowerCase() + ".js";
            Path finalPath = dirPath.resolve(filename);

            // 4. Save code to final disk path
            Files.writeString(finalPath, jsCode, StandardCharsets.UTF_8);

            // 5. Create or Update in Database
            Optional<Extension> existingOpt = extensionRepository.findBySourceUrl(url);
            Extension extension;
            if (existingOpt.isPresent()) {
                extension = existingOpt.get();
                extension.setName(cleanName);
                extension.setJsCode(jsCode);
                extension.setVersion(version);
                extension.setUpdatedAt(LocalDateTime.now());
            } else {
                // If loaded by name, also delete any existing by same name to avoid duplicates
                List<Extension> all = extensionRepository.findAll();
                for (Extension ext : all) {
                    if (ext.getName().equalsIgnoreCase(cleanName)) {
                        extensionRepository.delete(ext);
                    }
                }

                extension = Extension.builder()
                        .name(cleanName)
                        .sourceUrl(url)
                        .jsCode(jsCode)
                        .version(version)
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build();
            }

            extensionRepository.save(extension);
            return ResponseEntity.ok(extension);

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Error loading extension: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateExtensionCode(@PathVariable String id, @RequestBody Map<String, String> body) {
        String jsCode = body.get("jsCode");
        if (jsCode == null || jsCode.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "JavaScript code is required"));
        }

        Optional<Extension> extensionOpt = extensionRepository.findById(id);
        if (extensionOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Extension extension = extensionOpt.get();
        try {
            Path dirPath = Paths.get(extensionsDir);
            
            // 1. Write to temporary file to validate
            String tempFilename = "temp_val_" + UUID.randomUUID() + ".js";
            Path tempFilePath = dirPath.resolve(tempFilename);
            Files.writeString(tempFilePath, jsCode, StandardCharsets.UTF_8);

            // 2. Validate by running getMetadata
            try {
                scraperService.runMethod(tempFilePath.toString(), "getMetadata", "{}");
            } catch (Exception e) {
                Files.deleteIfExists(tempFilePath);
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid script code: " + e.getMessage()));
            } finally {
                Files.deleteIfExists(tempFilePath);
            }

            // 3. Save to disk file
            String filename = extension.getName().toLowerCase() + ".js";
            Path filePath = dirPath.resolve(filename);
            Files.writeString(filePath, jsCode, StandardCharsets.UTF_8);

            // 4. Update in database
            extension.setJsCode(jsCode);
            extension.setUpdatedAt(LocalDateTime.now());
            extensionRepository.save(extension);

            return ResponseEntity.ok(extension);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to update extension code: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteExtension(@PathVariable String id) {
        Optional<Extension> extensionOpt = extensionRepository.findById(id);
        if (extensionOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Extension extension = extensionOpt.get();
        try {
            // Delete file from disk
            String filename = extension.getName().toLowerCase() + ".js";
            Path filePath = Paths.get(extensionsDir).resolve(filename);
            Files.deleteIfExists(filePath);

            // Delete from database
            extensionRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Extension deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to delete extension: " + e.getMessage()));
        }
    }
}
