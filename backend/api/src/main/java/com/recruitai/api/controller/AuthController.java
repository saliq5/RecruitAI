package com.recruitai.api.controller;

import com.recruitai.api.dto.auth.LoginRequest;
import com.recruitai.api.dto.auth.RefreshRequest;
import com.recruitai.api.dto.auth.SignupRequest;
import com.recruitai.api.dto.auth.TokenResponse;
import com.recruitai.api.security.UserPrincipal;
import com.recruitai.api.service.AuthService;
import com.recruitai.api.dto.user.MeResponse;
import com.recruitai.api.model.User;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/signup")
    public ResponseEntity<TokenResponse> signup(@Valid @RequestBody SignupRequest req) {
        TokenResponse tokens = auth.signup(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(tokens);
    }

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest req) {
        return ResponseEntity.ok(auth.login(req));
    }

    @PostMapping("/refresh")
    public ResponseEntity<TokenResponse> refresh(@Valid @RequestBody RefreshRequest req) {
        return ResponseEntity.ok(auth.refresh(req.getRefreshToken()));
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@Valid @RequestBody RefreshRequest req) {
        auth.logout(req.getRefreshToken());
    }

    // Convenience endpoint to verify auth wiring (frontend uses /users/me; see
    // UsersController)
    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null)
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        User u = principal.getUser();
        return ResponseEntity.ok(new MeResponse(u.getId(), u.getUsername(), u.getEmail(), u.getRole().name()));
    }
}
