package com.travel.userservice.service;

import com.travel.userservice.config.RabbitMQConfig;
import com.travel.userservice.dto.*;
import com.travel.userservice.exception.ResourceNotFoundException;
import com.travel.userservice.model.Role;
import com.travel.userservice.model.User;
import com.travel.userservice.repository.RoleRepository;
import com.travel.userservice.repository.UserRepository;
import com.travel.userservice.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final RabbitTemplate rabbitTemplate;

    @Transactional
    public UserResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already registered");
        }

        Role userRole = roleRepository.findByName("USER")
                .orElseThrow(() -> new RuntimeException("Default role USER not found"));

        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .phone(request.getPhone())
                .homeCity(request.getHomeCity())
                .travelPreferences(request.getTravelPreferences())
                .roles(new HashSet<>(Set.of(userRole)))
                .build();

        user = userRepository.save(user);
        log.info("User registered: id={}, email={}", user.getId(), user.getEmail());

        // Publish UserRegistered event
        try {
            Map<String, Object> event = new HashMap<>();
            event.put("eventId", UUID.randomUUID().toString());
            event.put("eventType", "UserRegistered");
            event.put("occurredAt", new Date().toInstant().toString());
            event.put("source", "user-service");
            Map<String, Object> payload = new HashMap<>();
            payload.put("userId", user.getId());
            payload.put("email", user.getEmail());
            payload.put("fullName", user.getFullName());
            event.put("payload", payload);

            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE,
                    RabbitMQConfig.USER_REGISTERED_KEY, event);
            log.info("Published UserRegistered event for userId={}", user.getId());
        } catch (Exception e) {
            log.warn("Failed to publish UserRegistered event: {}", e.getMessage());
        }

        return toResponse(user);
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid email or password");
        }

        List<String> roles = user.getRoles().stream()
                .map(Role::getName)
                .collect(Collectors.toList());

        String token = jwtTokenProvider.generateToken(user.getId(), user.getEmail(), roles);

        log.info("User logged in: id={}, email={}", user.getId(), user.getEmail());

        return AuthResponse.builder()
                .token(token)
                .type("Bearer")
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .roles(roles)
                .build();
    }

    public UserResponse getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
        return toResponse(user);
    }

    @Transactional
    public UserResponse updateUser(Long id, UpdateUserRequest request, String requesterId, List<String> requesterRoles) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));

        // Check ownership or admin
        if (!id.toString().equals(requesterId) && !requesterRoles.contains("ADMIN")) {
            throw new SecurityException("You can only update your own profile");
        }

        if (request.getFullName() != null) user.setFullName(request.getFullName());
        if (request.getPhone() != null) user.setPhone(request.getPhone());
        if (request.getHomeCity() != null) user.setHomeCity(request.getHomeCity());
        if (request.getTravelPreferences() != null) user.setTravelPreferences(request.getTravelPreferences());
        if (request.getAvatarUrl() != null) user.setAvatarUrl(request.getAvatarUrl());

        user = userRepository.save(user);
        log.info("User updated: id={}", user.getId());
        return toResponse(user);
    }

    private UserResponse toResponse(User user) {
        List<String> roles = user.getRoles().stream()
                .map(Role::getName)
                .collect(Collectors.toList());

        return UserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .homeCity(user.getHomeCity())
                .travelPreferences(user.getTravelPreferences())
                .avatarUrl(user.getAvatarUrl())
                .roles(roles)
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}
