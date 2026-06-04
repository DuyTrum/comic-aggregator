package com.comicaggregator.repository;

import com.comicaggregator.model.Extension;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface ExtensionRepository extends JpaRepository<Extension, String> {
    Optional<Extension> findBySourceUrl(String sourceUrl);
    boolean existsBySourceUrl(String sourceUrl);
}
