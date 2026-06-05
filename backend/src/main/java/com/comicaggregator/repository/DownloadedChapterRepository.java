package com.comicaggregator.repository;

import com.comicaggregator.model.DownloadedChapter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface DownloadedChapterRepository extends JpaRepository<DownloadedChapter, String> {
    List<DownloadedChapter> findByComicId(String comicId);
    Optional<DownloadedChapter> findByComicIdAndChapterId(String comicId, String chapterId);
    Optional<DownloadedChapter> findByChapterId(String chapterId);
    List<DownloadedChapter> findByStatus(String status);
}
