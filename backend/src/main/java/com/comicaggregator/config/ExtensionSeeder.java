package com.comicaggregator.config;

import com.comicaggregator.model.Extension;
import com.comicaggregator.repository.ExtensionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;

@Component
public class ExtensionSeeder implements CommandLineRunner {

    private final ExtensionRepository extensionRepository;

    @Value("${app.extensions.dir}")
    private String extensionsDir;

    public ExtensionSeeder(ExtensionRepository extensionRepository) {
        this.extensionRepository = extensionRepository;
    }

    @Override
    public void run(String... args) {
        try {
            Path dirPath = Paths.get(extensionsDir);
            if (!Files.exists(dirPath)) {
                Files.createDirectories(dirPath);
            }

            // 1. Clean up stale extensions whose .js files no longer exist on disk
            for (Extension ext : extensionRepository.findAll()) {
                String filename = ext.getName().toLowerCase() + ".js";
                Path filePath = dirPath.resolve(filename);
                if (!Files.exists(filePath)) {
                    extensionRepository.delete(ext);
                    System.out.println("[ExtensionSeeder] Removed stale extension from DB: " + ext.getName());
                }
            }

            // 2. Seed built-in extensions
            seedExtension(dirPath, "MangaDex", "mangadex.js", "1.0.0");
            seedExtension(dirPath, "TruyenQQ", "truyenqq.js", "1.0.0");
            seedExtension(dirPath, "FoxTruyen", "foxtruyen.js", "1.0.0");

        } catch (IOException e) {
            System.err.println("[ExtensionSeeder] Error during seeding: " + e.getMessage());
        }
    }

    private void seedExtension(Path dirPath, String name, String filename, String version) throws IOException {
        Path filePath = dirPath.resolve(filename);
        if (!Files.exists(filePath)) {
            System.out.println("[ExtensionSeeder] " + filename + " not found at " + filePath);
            return;
        }

        boolean exists = extensionRepository.findAll().stream()
                .anyMatch(ext -> ext.getName().equalsIgnoreCase(name));

        if (!exists) {
            String jsCode = Files.readString(filePath, StandardCharsets.UTF_8);
            Extension extension = Extension.builder()
                    .name(name)
                    .sourceUrl("local://" + filename)
                    .jsCode(jsCode)
                    .version(version)
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();

            extensionRepository.save(extension);
            System.out.println("[ExtensionSeeder] Successfully seeded " + name + " extension.");
        } else {
            System.out.println("[ExtensionSeeder] " + name + " extension is already seeded.");
        }
    }
}
