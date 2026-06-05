package com.comicaggregator.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "reading_history",
    uniqueConstraints = {
        @UniqueConstraint(name = "user_history_idx", columnNames = {"user_id", "comic_id", "source"})
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReadingHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "comic_id")
    private String comicId;

    private String comicTitle;

    @Column(length = 2048)
    private String comicCover;

    private String source;

    private String chapterId;

    private String chapterTitle;

    private Integer scrollPosition;

    @Column(name = "tags", length = 1024)
    private String tags;

    private LocalDateTime updatedAt = LocalDateTime.now();
}
