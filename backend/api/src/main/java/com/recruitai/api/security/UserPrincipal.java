package com.recruitai.api.security;

import com.recruitai.api.model.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

public class UserPrincipal implements UserDetails {

    private final User user;

    public UserPrincipal(User user) {
        this.user = user;
    }

    public User getUser() {
        return this.user;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
    }

    @Override
    public String getPassword() {
        return user.getPasswordHash();
    }

    @Override
    public String getUsername() {
        return user.getUsername(); // subject used can be username or email; we use username by default
    }

    @Override
    public boolean isAccountNonExpired() {
        return true; // MVP: no account expiration
    }

    @Override
    public boolean isAccountNonLocked() {
        return true; // MVP: no lock logic
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true; // MVP: no credential expiration
    }

    @Override
    public boolean isEnabled() {
        return true; // MVP: enabled by default
    }
}
