package com.comicaggregator.controller;

import com.comicaggregator.model.User;
import com.comicaggregator.model.ReadingHistory;
import com.comicaggregator.model.UserLibrary;
import com.comicaggregator.repository.UserRepository;
import com.comicaggregator.repository.ReadingHistoryRepository;
import com.comicaggregator.repository.UserLibraryRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/history")
public class HistoryController {

    private final UserRepository userRepository;
    private final ReadingHistoryRepository readingHistoryRepository;
    private final UserLibraryRepository userLibraryRepository;

    public HistoryController(UserRepository userRepository, 
                             ReadingHistoryRepository readingHistoryRepository,
                             UserLibraryRepository userLibraryRepository) {
        this.userRepository = userRepository;
        this.readingHistoryRepository = readingHistoryRepository;
        this.userLibraryRepository = userLibraryRepository;
    }

    @GetMapping
    public ResponseEntity<List<ReadingHistory>> getHistory() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByUsername(username).orElseThrow();
        List<ReadingHistory> historyList = readingHistoryRepository.findByUserIdOrderByUpdatedAtDesc(user.getId());
        return ResponseEntity.ok(historyList);
    }

    @PostMapping
    public ResponseEntity<?> updateHistory(@RequestBody Map<String, Object> payload) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByUsername(username).orElseThrow();

        String comicId = (String) payload.get("comicId");
        String source = (String) payload.get("source");
        
        String comicTitle = payload.containsKey("comicTitle") ? (String) payload.get("comicTitle") : "";
        String comicCover = payload.containsKey("comicCover") ? (String) payload.get("comicCover") : "";
        
        String chapterId = payload.containsKey("chapterId") ? (String) payload.get("chapterId") : (String) payload.get("lastChapterId");
        String chapterTitle = payload.containsKey("chapterTitle") ? (String) payload.get("chapterTitle") : (String) payload.get("lastChapterTitle");
        String tags = payload.containsKey("tags") ? (String) payload.get("tags") : "";
        
        Integer scrollPosition = null;
        Object rawScroll = payload.get("scrollPosition");
        if (rawScroll == null) {
            rawScroll = payload.get("currentPage");
        }
        if (rawScroll instanceof Number) {
            scrollPosition = ((Number) rawScroll).intValue();
        }

        Optional<ReadingHistory> existing = readingHistoryRepository
                .findByUserIdAndComicIdAndSource(user.getId(), comicId, source);

        ReadingHistory history;
        if (existing.isPresent()) {
            history = existing.get();
            history.setChapterId(chapterId);
            history.setChapterTitle(chapterTitle);
            history.setScrollPosition(scrollPosition);
            if (comicTitle != null && !comicTitle.isEmpty()) {
                history.setComicTitle(comicTitle);
            }
            if (comicCover != null && !comicCover.isEmpty()) {
                history.setComicCover(comicCover);
            }
            if (tags != null && !tags.isEmpty()) {
                history.setTags(tags);
            }
            history.setUpdatedAt(LocalDateTime.now());
        } else {
            history = ReadingHistory.builder()
                    .userId(user.getId())
                    .comicId(comicId)
                    .comicTitle(comicTitle)
                    .comicCover(comicCover)
                    .source(source)
                    .chapterId(chapterId)
                    .chapterTitle(chapterTitle)
                    .scrollPosition(scrollPosition)
                    .tags(tags)
                    .updatedAt(LocalDateTime.now())
                    .build();
        }

        readingHistoryRepository.save(history);

        // Synchronize with UserLibrary to mark unreadCount as 0 if they read the latest chapter
        Optional<UserLibrary> libOpt = userLibraryRepository
                .findByUserIdAndComicIdOnSourceAndSourceName(user.getId(), comicId, source);
        if (libOpt.isPresent()) {
            UserLibrary libItem = libOpt.get();
            if (libItem.getLatestChapterTitle() != null) {
                double readNum = parseChapterNumber(chapterTitle);
                double latestNum = parseChapterNumber(libItem.getLatestChapterTitle());
                if (readNum >= latestNum) {
                    libItem.setUnreadCount(0);
                    userLibraryRepository.save(libItem);
                }
            } else {
                libItem.setUnreadCount(0);
                userLibraryRepository.save(libItem);
            }
        }

        return ResponseEntity.ok(Map.of("message", "History updated successfully"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteHistoryItem(@PathVariable String id) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByUsername(username).orElseThrow();

        Optional<ReadingHistory> historyOpt = readingHistoryRepository.findById(id);
        if (historyOpt.isPresent() && historyOpt.get().getUserId().equals(user.getId())) {
            readingHistoryRepository.delete(historyOpt.get());
            return ResponseEntity.ok(Map.of("message", "History item deleted successfully"));
        }

        List<ReadingHistory> historyList = readingHistoryRepository.findByUserIdOrderByUpdatedAtDesc(user.getId());
        boolean deleted = false;
        for (ReadingHistory rh : historyList) {
            if (rh.getComicId().equals(id) || rh.getId().equals(id)) {
                readingHistoryRepository.delete(rh);
                deleted = true;
            }
        }

        if (deleted) {
            return ResponseEntity.ok(Map.of("message", "History item deleted successfully"));
        }

        return ResponseEntity.notFound().build();
    }

    @DeleteMapping
    public ResponseEntity<?> clearAllHistory() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByUsername(username).orElseThrow();

        List<ReadingHistory> historyList = readingHistoryRepository.findByUserIdOrderByUpdatedAtDesc(user.getId());
        readingHistoryRepository.deleteAll(historyList);

        return ResponseEntity.ok(Map.of("message", "All history cleared successfully"));
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
}
