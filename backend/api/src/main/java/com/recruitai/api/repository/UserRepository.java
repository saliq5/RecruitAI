package com.recruitai.api.repository;

import com.recruitai.api.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByUsernameIgnoreCase(String username);

    Optional<User> findByEmailIgnoreCase(String email);

    default Optional<User> findByUsernameOrEmailIgnoreCase(String usernameOrEmail) {
        Optional<User> byUsername = findByUsernameIgnoreCase(usernameOrEmail);
        if (byUsername.isPresent())
            return byUsername;
        return findByEmailIgnoreCase(usernameOrEmail);
    }

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmailIgnoreCase(String email);
}
