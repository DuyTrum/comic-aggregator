package com.comicaggregator.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "downloaded_chapters",
    uniqueConstraints = {
        @UniqueConstraint(name = "comic_chapter_idx", columnNames = {"comic_id", "chapter_id"})
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DownloadedChapter {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "comic_id")
    private String comicId;

    private String comicTitle;

    @Column(length = 2048)
    private String comicCover;

    private String source;

    @Column(name = "chapter_id")
    private String chapterId;

    private String chapterTitle;

    private String status; // PENDING, DOWNLOADING, COMPLETED, FAILED

    private Integer downloadedPages;

    private Integer totalPages;

    private LocalDateTime downloadedAt;
}
