package com.recruitai.api.repository;

import com.recruitai.api.model.User;
import com.recruitai.api.model.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    List<RefreshToken> findAllByUserAndFamilyId(User user, UUID familyId);

    long deleteByUserAndExpiresAtBefore(User user, Instant before);
}
