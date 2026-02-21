package com.recruitai.api.service;

import com.recruitai.api.dto.auth.LoginRequest;
import com.recruitai.api.dto.auth.SignupRequest;
import com.recruitai.api.dto.auth.TokenResponse;
import com.recruitai.api.model.RefreshToken;
import com.recruitai.api.repository.RefreshTokenRepository;
import com.recruitai.api.security.JwtService;
import com.recruitai.api.model.User;
import com.recruitai.api.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final AuthenticationManager authManager;

    @Value("${app.security.jwt.refresh-token-ttl-days:7}")
    private long refreshTtlDays;

    public AuthService(UserRepository users,
            RefreshTokenRepository refreshTokens,
            PasswordEncoder encoder,
            JwtService jwt,
            AuthenticationManager authManager) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.encoder = encoder;
        this.jwt = jwt;
        this.authManager = authManager;
    }

    @Transactional
    public TokenResponse signup(SignupRequest req) {
        if (users.existsByUsernameIgnoreCase(req.getUsername())) {
            throw new IllegalArgumentException("Username already exists");
        }
        if (users.existsByEmailIgnoreCase(req.getEmail())) {
            throw new IllegalArgumentException("Email already exists");
        }

        User u = new User(req.getUsername(), req.getEmail(), encoder.encode(req.getPassword()), User.Role.CANDIDATE);
        u = users.save(u);

        return issueTokensFor(u, null);
    }

    @Transactional
    public TokenResponse login(LoginRequest req) {
        // Delegate to AuthenticationManager for password validation
        authManager.authenticate(new UsernamePasswordAuthenticationToken(req.getUsernameOrEmail(), req.getPassword()));

        // Load user by username or email
        Optional<User> userOpt = users.findByUsernameOrEmailIgnoreCase(req.getUsernameOrEmail());
        if (userOpt.isEmpty()) {
            throw new IllegalArgumentException("Invalid credentials");
        }
        User u = userOpt.get();

        return issueTokensFor(u, null);
    }

    @Transactional
    public TokenResponse refresh(String providedRefreshToken) {
        String hash = sha256B64(providedRefreshToken);
        RefreshToken existing = refreshTokens.findByTokenHash(hash)
                .orElseThrow(() -> new IllegalArgumentException("Invalid refresh token"));

        if (existing.isRevoked() || existing.getExpiresAt().isBefore(Instant.now())) {
            // Reuse/expired: revoke entire family for safety
            revokeFamily(existing);
            throw new IllegalArgumentException("Refresh token expired or revoked");
        }

        // Rotate: revoke old and issue new within same family
        existing.setRevoked(true);
        RefreshToken rotated = createRefreshToken(existing.getUser(), existing.getFamilyId());
        existing.setReplacedBy(rotated.getId());
        refreshTokens.save(existing);
        refreshTokens.save(rotated);

        String access = generateAccess(existing.getUser());
        return new TokenResponse(access, rawFromHash(rotated, providedRefreshToken),
                existing.getUser().getRole().name());
    }

    @Transactional
    public void logout(String providedRefreshToken) {
        String hash = sha256B64(providedRefreshToken);
        refreshTokens.findByTokenHash(hash).ifPresent(rt -> {
            rt.setRevoked(true);
            refreshTokens.save(rt);
        });
    }

    // ----- helpers -----

    private TokenResponse issueTokensFor(User u, UUID familyId) {
        String access = generateAccess(u);
        RefreshToken rt = createRefreshToken(u, familyId);
        refreshTokens.save(rt);
        return new TokenResponse(access, rawFromHash(rt, null), u.getRole().name());
    }

    private String generateAccess(User u) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("role", u.getRole().name());
        // subject as username (frontend uses /users/me for details)
        return jwt.generateToken(u.getUsername(), claims);
    }

    // Create a refresh token: return entity with only the hashed token persisted.
    private RefreshToken createRefreshToken(User u, UUID familyId) {
        String raw = randomToken();
        String hash = sha256B64(raw);
        Instant exp = Instant.now().plus(refreshTtlDays, ChronoUnit.DAYS);
        RefreshToken rt = new RefreshToken(u, hash, exp, familyId);
        // We need to return the plain token to client; we transiently keep raw via
        // ThreadLocal or encode in response builder.
        // For simplicity we stash the raw into a thread-local map keyed by entity id
        // after save; here we set a hint in replacedBy (not persisted yet).
        // Instead, we will reconstruct response using rawFromHash(...) which returns
        // `raw` if provided, otherwise placeholder.
        rawLastGenerated = raw;
        return rt;
    }

    // This is a simple holder for the last generated raw token in this thread (MVP
    // only).
    private static final ThreadLocal<String> lastRawToken = new ThreadLocal<>();
    private static String rawLastGenerated;

    private String rawFromHash(RefreshToken rt, String providedRawIfRefreshFlow) {
        // If this is part of refresh flow, we already returned rotated token after
        // generating in same thread.
        String raw = rawLastGenerated;
        if (providedRawIfRefreshFlow != null) {
            // during refresh() we generated a new one right before, so rawLastGenerated
            // holds it.
        }
        // Clear after read
        lastRawToken.remove();
        String out = raw;
        rawLastGenerated = null;
        // Safety: never return null
        return out != null ? out : "REDACTED_TOKEN_CLIENT_SHOULD_RELOGIN";
    }

    private static final SecureRandom RNG = new SecureRandom();

    private String randomToken() {
        byte[] buf = new byte[32];
        RNG.nextBytes(buf);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
    }

    private String sha256B64(String raw) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(digest);
        } catch (Exception e) {
            throw new IllegalStateException("Unable to hash token", e);
        }
    }

    private void revokeFamily(RefreshToken rt) {
        refreshTokens.findAllByUserAndFamilyId(rt.getUser(), rt.getFamilyId())
                .forEach(t -> {
                    t.setRevoked(true);
                    refreshTokens.save(t);
                });
    }
}
