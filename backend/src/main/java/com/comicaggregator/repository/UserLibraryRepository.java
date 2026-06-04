package com.comicaggregator.repository;

import com.comicaggregator.model.UserLibrary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserLibraryRepository extends JpaRepository<UserLibrary, String> {
    List<UserLibrary> findByUserId(String userId);
    Optional<UserLibrary> findByUserIdAndComicIdOnSourceAndSourceName(String userId, String comicIdOnSource, String sourceName);
    boolean existsByUserIdAndComicIdOnSourceAndSourceName(String userId, String comicIdOnSource, String sourceName);
}
