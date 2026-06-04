package com.comicaggregator.controller;

import com.comicaggregator.model.User;
import com.comicaggregator.model.UserLibrary;
import com.comicaggregator.repository.UserRepository;
import com.comicaggregator.repository.UserLibraryRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/library")
public class LibraryController {

    private final UserRepository userRepository;
    private final UserLibraryRepository userLibraryRepository;

    public LibraryController(UserRepository userRepository, UserLibraryRepository userLibraryRepository) {
        this.userRepository = userRepository;
        this.userLibraryRepository = userLibraryRepository;
    }

    @GetMapping
    public ResponseEntity<List<UserLibrary>> getLibrary() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByUsername(username).orElseThrow();
        List<UserLibrary> library = userLibraryRepository.findByUserId(user.getId());
        return ResponseEntity.ok(library);
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
                    .build();
            userLibraryRepository.save(newItem);
            return ResponseEntity.ok(Map.of("message", "Added to library", "bookmarked", true));
        }
    }
}
