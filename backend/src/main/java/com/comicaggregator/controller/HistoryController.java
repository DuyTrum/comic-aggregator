package com.comicaggregator.controller;

import com.comicaggregator.model.User;
import com.comicaggregator.model.ReadingHistory;
import com.comicaggregator.repository.UserRepository;
import com.comicaggregator.repository.ReadingHistoryRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/history")
public class HistoryController {

    private final UserRepository userRepository;
    private final ReadingHistoryRepository readingHistoryRepository;

    public HistoryController(UserRepository userRepository, ReadingHistoryRepository readingHistoryRepository) {
        this.userRepository = userRepository;
        this.readingHistoryRepository = readingHistoryRepository;
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
                    .updatedAt(LocalDateTime.now())
                    .build();
        }

        readingHistoryRepository.save(history);
        return ResponseEntity.ok(Map.of("message", "History updated successfully"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteHistoryItem(@PathVariable String id) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByUsername(username).orElseThrow();

        // Try to delete by document ID first
        Optional<ReadingHistory> historyOpt = readingHistoryRepository.findById(id);
        if (historyOpt.isPresent() && historyOpt.get().getUserId().equals(user.getId())) {
            readingHistoryRepository.delete(historyOpt.get());
            return ResponseEntity.ok(Map.of("message", "History item deleted successfully"));
        }

        // If not found by document ID, look for items matching comicId for this user and delete them
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
}
