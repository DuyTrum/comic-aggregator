package com.comicaggregator.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "user_library",
    uniqueConstraints = {
        @UniqueConstraint(name = "user_comic_idx", columnNames = {"user_id", "comic_id_on_source", "source_name"})
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserLibrary {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "comic_id_on_source")
    private String comicIdOnSource;

    @Column(name = "source_name")
    private String sourceName;

    private String comicTitle;

    @Column(length = 2048)
    private String coverUrl;

    @Column(name = "latest_chapter_id", length = 1024)
    private String latestChapterId;

    @Column(name = "latest_chapter_title", length = 1024)
    private String latestChapterTitle;

    @Column(name = "last_checked_at")
    private LocalDateTime lastCheckedAt;

    @Column(name = "unread_count")
    @Builder.Default
    private Integer unreadCount = 0;

    @Builder.Default
    private LocalDateTime bookmarkedAt = LocalDateTime.now();
}
