package com.travel.userservice.controller;

import com.travel.userservice.dto.*;
import com.travel.userservice.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping({"/users/register", "/register"})
    public ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
        UserResponse response = userService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping({"/users/login", "/login"})
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = userService.login(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping({"/users/{id}", "/{id}"})
    public ResponseEntity<UserResponse> getUser(@PathVariable Long id) {
        UserResponse response = userService.getUserById(id);
        return ResponseEntity.ok(response);
    }

    @PutMapping({"/users/{id}", "/{id}"})
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable Long id,
            @RequestBody UpdateUserRequest request,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-User-Roles", required = false, defaultValue = "") String roles) {
        List<String> roleList = roles.isEmpty() ? List.of() :
                Arrays.asList(roles.split(","));
        UserResponse response = userService.updateUser(id, request, userId, roleList);
        return ResponseEntity.ok(response);
    }

    @GetMapping({"/users/{id}/profile", "/{id}/profile"})
    public ResponseEntity<UserResponse> getProfile(@PathVariable Long id) {
        UserResponse response = userService.getUserById(id);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> status = new HashMap<>();
        status.put("status", "UP");
        status.put("service", "user-service");
        status.put("timestamp", new Date().toInstant().toString());
        return ResponseEntity.ok(status);
    }
}
