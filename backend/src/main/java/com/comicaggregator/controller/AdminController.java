package com.comicaggregator.controller;

import com.comicaggregator.model.User;
import com.comicaggregator.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Value;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserRepository userRepository;

    @Value("${app.cache.dir}")
    private String cacheDir;

    public AdminController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping("/cache/stats")
    public ResponseEntity<?> getCacheStats() {
        try {
            Path cachePath = Paths.get(cacheDir);
            long fileCount = 0;
            long totalBytes = 0;
            
            if (Files.exists(cachePath)) {
                try (var stream = Files.walk(cachePath)) {
                    List<Path> files = stream.filter(Files::isRegularFile).toList();
                    fileCount = files.size();
                    for (Path file : files) {
                        totalBytes += Files.size(file);
                    }
                }
            }
            
            double sizeInMb = Math.round((totalBytes / (1024.0 * 1024.0)) * 100.0) / 100.0;
            
            return ResponseEntity.ok(Map.of(
                "fileCount", fileCount,
                "sizeMb", sizeInMb
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Lỗi khi đọc thống kê cache: " + e.getMessage()));
        }
    }

    @PostMapping("/cache/clear")
    public ResponseEntity<?> clearImageCache() {
        try {
            Path cachePath = Paths.get(cacheDir);
            long fileCount = 0;
            long totalBytes = 0;
            
            if (Files.exists(cachePath)) {
                try (var stream = Files.walk(cachePath)) {
                    List<Path> files = stream.filter(Files::isRegularFile).toList();
                    fileCount = files.size();
                    for (Path file : files) {
                        totalBytes += Files.size(file);
                        Files.delete(file);
                    }
                }
            }
            
            double sizeInMb = Math.round((totalBytes / (1024.0 * 1024.0)) * 100.0) / 100.0;
            
            return ResponseEntity.ok(Map.of(
                "message", "Đã xóa toàn bộ cache hình ảnh thành công!",
                "filesDeleted", fileCount,
                "sizeClearedMb", sizeInMb
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Lỗi khi xóa cache: " + e.getMessage()));
        }
    }

    @GetMapping("/users")
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userRepository.findAll());
    }

    @PutMapping("/users/{id}/role")
    public ResponseEntity<?> updateUserRole(@PathVariable String id, @RequestBody Map<String, String> body) {
        String newRole = body.get("role");
        if (newRole == null || (!newRole.equals("USER") && !newRole.equals("ADMIN"))) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid role: must be USER or ADMIN"));
        }

        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        
        // Safety check: Prevent demoting the last seeded admin to avoid lockout
        if (user.getUsername().equals("admin") && newRole.equals("USER")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot demote the primary seeded admin user!"));
        }

        user.setRole(newRole);
        userRepository.save(user);

        return ResponseEntity.ok(user);
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable String id) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        
        // Safety check: Prevent deleting the primary admin
        if (user.getUsername().equals("admin")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot delete the primary seeded admin user!"));
        }

        userRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "User deleted successfully"));
    }
}
