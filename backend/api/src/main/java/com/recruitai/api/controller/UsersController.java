package com.recruitai.api.controller;

import com.recruitai.api.security.UserPrincipal;
import com.recruitai.api.dto.user.MeResponse;
import com.recruitai.api.model.User;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UsersController {

    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        User u = principal.getUser();
        return ResponseEntity.ok(new MeResponse(u.getId(), u.getUsername(), u.getEmail(), u.getRole().name()));
    }
}
