package com.example.todolist.controller;

import com.example.todolist.dto.AuthResponse;
import com.example.todolist.dto.CurrentUserResponse;
import com.example.todolist.dto.LoginRequest;
import com.example.todolist.dto.RegisterRequest;
import com.example.todolist.entity.User;
import com.example.todolist.security.JwtUtil;
import com.example.todolist.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserService userService;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;

    public AuthController(UserService userService, JwtUtil jwtUtil, AuthenticationManager authenticationManager) {
        this.userService = userService;
        this.jwtUtil = jwtUtil;
        this.authenticationManager = authenticationManager;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        User user = userService.register(request.getUsername(), request.getPassword());
        return ResponseEntity.ok(authResponse(user));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword()));
        User user = userService.getByUsername(request.getUsername());
        return ResponseEntity.ok(authResponse(user));
    }

    @GetMapping("/me")
    public ResponseEntity<CurrentUserResponse> me(Authentication authentication) {
        User user = userService.getByUsername(authentication.getName());
        return ResponseEntity.ok(currentUserResponse(user));
    }

    private AuthResponse authResponse(User user) {
        String token = jwtUtil.generateToken(user.getUsername());
        return new AuthResponse(token, currentUserResponse(user));
    }

    private CurrentUserResponse currentUserResponse(User user) {
        return new CurrentUserResponse(user.getId(), user.getUsername());
    }
}
