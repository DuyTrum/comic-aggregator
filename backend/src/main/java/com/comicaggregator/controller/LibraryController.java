package com.comicaggregator.controller;

import com.comicaggregator.model.User;
import com.comicaggregator.model.UserLibrary;
import com.comicaggregator.model.ReadingHistory;
import com.comicaggregator.repository.UserRepository;
import com.comicaggregator.repository.UserLibraryRepository;
import com.comicaggregator.repository.ReadingHistoryRepository;
import com.comicaggregator.service.ScraperService;
import lombok.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/library")
public class LibraryController {

    private final UserRepository userRepository;
    private final UserLibraryRepository userLibraryRepository;
    private final ReadingHistoryRepository readingHistoryRepository;
    private final ScraperService scraperService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();

    public LibraryController(UserRepository userRepository, 
                             UserLibraryRepository userLibraryRepository,
                             ReadingHistoryRepository readingHistoryRepository,
                             ScraperService scraperService) {
        this.userRepository = userRepository;
        this.userLibraryRepository = userLibraryRepository;
        this.readingHistoryRepository = readingHistoryRepository;
        this.scraperService = scraperService;
    }

    @GetMapping
    public ResponseEntity<List<LibraryItemDto>> getLibrary() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByUsername(username).orElseThrow();
        List<UserLibrary> library = userLibraryRepository.findByUserId(user.getId());
        List<ReadingHistory> histories = readingHistoryRepository.findByUserIdOrderByUpdatedAtDesc(user.getId());
        
        // Map histories by comicId and source for quick lookup
        Map<String, ReadingHistory> historyMap = new HashMap<>();
        for (ReadingHistory h : histories) {
            String key = h.getSource() + "::" + h.getComicId();
            historyMap.putIfAbsent(key, h); // Keep the newest one if multiple
        }
        
        List<LibraryItemDto> dtos = library.stream().map(item -> {
            String key = item.getSourceName() + "::" + item.getComicIdOnSource();
            ReadingHistory history = historyMap.get(key);
            
            String lastReadChapterId = history != null ? history.getChapterId() : null;
            String lastReadChapterTitle = history != null ? history.getChapterTitle() : null;
            
            // Determine if there is a new chapter based on cached latestChapterTitle
            boolean hasNewChapter = false;
            if (item.getLatestChapterTitle() != null && lastReadChapterTitle != null) {
                double latestNum = parseChapterNumber(item.getLatestChapterTitle());
                double readNum = parseChapterNumber(lastReadChapterTitle);
                hasNewChapter = latestNum > readNum;
            } else if (item.getLatestChapterTitle() != null && lastReadChapterTitle == null) {
                hasNewChapter = true;
            }
            
            return LibraryItemDto.builder()
                    .id(item.getId())
                    .comicIdOnSource(item.getComicIdOnSource())
                    .sourceName(item.getSourceName())
                    .comicTitle(item.getComicTitle())
                    .coverUrl(item.getCoverUrl())
                    .latestChapterId(item.getLatestChapterId())
                    .latestChapterTitle(item.getLatestChapterTitle())
                    .lastCheckedAt(item.getLastCheckedAt())
                    .unreadCount(item.getUnreadCount() != null ? item.getUnreadCount() : 0)
                    .bookmarkedAt(item.getBookmarkedAt())
                    .lastReadChapterId(lastReadChapterId)
                    .lastReadChapterTitle(lastReadChapterTitle)
                    .hasNewChapter(hasNewChapter)
                    .build();
        }).collect(Collectors.toList());
        
        return ResponseEntity.ok(dtos);
    }

    @PostMapping
    public ResponseEntity<?> toggleBookmark(@RequestBody Map<String, String> payload) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByUsername(username).orElseThrow();

        String comicId = payload.get("comicIdOnSource");
        String sourceName = payload.get("sourceName");
        String comicTitle = payload.get("comicTitle");
        String coverUrl = payload.get("coverUrl");

        Optional<UserLibrary> existing = userLibraryRepository
                .findByUserIdAndComicIdOnSourceAndSourceName(user.getId(), comicId, sourceName);

        if (existing.isPresent()) {
            userLibraryRepository.delete(existing.get());
            return ResponseEntity.ok(Map.of("message", "Removed from library", "bookmarked", false));
        } else {
            UserLibrary newItem = UserLibrary.builder()
                    .userId(user.getId())
                    .comicIdOnSource(comicId)
                    .sourceName(sourceName)
                    .comicTitle(comicTitle)
                    .coverUrl(coverUrl)
                    .unreadCount(0)
                    .build();
            userLibraryRepository.save(newItem);
            return ResponseEntity.ok(Map.of("message", "Added to library", "bookmarked", true));
        }
    }

    @PostMapping("/check-updates")
    public ResponseEntity<?> checkUpdates() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByUsername(username).orElseThrow();
        List<UserLibrary> library = userLibraryRepository.findByUserId(user.getId());
        List<ReadingHistory> histories = readingHistoryRepository.findByUserIdOrderByUpdatedAtDesc(user.getId());
        
        // Map histories by comicId and source for lookup
        Map<String, ReadingHistory> historyMap = new HashMap<>();
        for (ReadingHistory h : histories) {
            String key = h.getSource() + "::" + h.getComicId();
            historyMap.putIfAbsent(key, h);
        }
        
        if (library.isEmpty()) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        
        // Create an executor service to query scrapers in parallel
        ExecutorService executor = Executors.newFixedThreadPool(Math.min(10, library.size()));
        List<CompletableFuture<Void>> futures = library.stream()
            .map(item -> CompletableFuture.runAsync(() -> {
                try {
                    // Fetch comic details which contains the chapters list
                    String detailJson = scraperService.runExtension(item.getSourceName(), "getDetail", Map.of("comicId", item.getComicIdOnSource()));
                    Map<String, Object> detailMap = objectMapper.readValue(detailJson, Map.class);
                    List<Map<String, Object>> chaptersList = (List<Map<String, Object>>) detailMap.get("chapters");
                    
                    if (chaptersList != null && !chaptersList.isEmpty()) {
                        // Sort chapters descending by parsed chapter number
                        chaptersList.sort((c1, c2) -> {
                            double num1 = parseChapterNumber((String) c1.get("title"));
                            double num2 = parseChapterNumber((String) c2.get("title"));
                            return Double.compare(num2, num1);
                        });
                        
                        Map<String, Object> latestChapter = chaptersList.get(0);
                        String latestId = (String) latestChapter.get("id");
                        String latestTitle = (String) latestChapter.get("title");
                        
                        item.setLatestChapterId(latestId);
                        item.setLatestChapterTitle(latestTitle);
                        item.setLastCheckedAt(LocalDateTime.now());
                        
                        // Calculate unread count comparing with history
                        String key = item.getSourceName() + "::" + item.getComicIdOnSource();
                        ReadingHistory history = historyMap.get(key);
                        if (history != null) {
                            double readNum = parseChapterNumber(history.getChapterTitle());
                            long unreadCount = chaptersList.stream()
                                .map(ch -> parseChapterNumber((String) ch.get("title")))
                                .filter(num -> num > readNum)
                                .count();
                            item.setUnreadCount((int) unreadCount);
                        } else {
                            // If never read, all chapters are unread
                            item.setUnreadCount(chaptersList.size());
                        }
                    } else {
                        item.setUnreadCount(0);
                        item.setLastCheckedAt(LocalDateTime.now());
                    }
                    userLibraryRepository.save(item);
                } catch (Exception e) {
                    System.err.println("[ERROR] Failed to check update for " + item.getComicTitle() + ": " + e.getMessage());
                }
            }, executor))
            .collect(Collectors.toList());
        
        // Wait for all checks to finish
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        executor.shutdown();
        
        // Now return the updated list
        return getLibrary();
    }

    private static double parseChapterNumber(String title) {
        if (title == null) return 0.0;
        Pattern pattern = Pattern.compile("(?:chapter|chương|chap|\\b)\\s*(\\d+(?:\\.\\d+)?)", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(title);
        if (matcher.find()) {
            try {
                return Double.parseDouble(matcher.group(1));
            } catch (NumberFormatException e) {
                return 0.0;
            }
        }
        return 0.0;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LibraryItemDto {
        private String id;
        private String comicIdOnSource;
        private String sourceName;
        private String comicTitle;
        private String coverUrl;
        private String latestChapterId;
        private String latestChapterTitle;
        private LocalDateTime lastCheckedAt;
        private Integer unreadCount;
        private LocalDateTime bookmarkedAt;
        
        // Enriched progress fields
        private String lastReadChapterId;
        private String lastReadChapterTitle;
        private boolean hasNewChapter;
    }
}
