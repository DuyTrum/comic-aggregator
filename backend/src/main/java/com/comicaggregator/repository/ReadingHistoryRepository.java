package com.comicaggregator.repository;

import com.comicaggregator.model.ReadingHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ReadingHistoryRepository extends JpaRepository<ReadingHistory, String> {
    List<ReadingHistory> findByUserIdOrderByUpdatedAtDesc(String userId);
    Optional<ReadingHistory> findByUserIdAndComicIdAndSource(String userId, String comicId, String source);
}
