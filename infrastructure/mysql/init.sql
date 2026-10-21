-- MySQL init script for User Service
-- Creates the user_service_db tables

CREATE TABLE IF NOT EXISTS roles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    home_city VARCHAR(255),
    travel_preferences JSON,
    avatar_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- Seed default roles
INSERT INTO roles (name) VALUES ('USER'), ('ADMIN');

-- Seed a demo user (password: demo123)
-- BCrypt hash of 'demo123'
INSERT INTO users (email, password_hash, full_name, phone, home_city, travel_preferences)
VALUES ('demo@travel.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Demo User', '+91-9999999999', 'Mumbai', '{"categories": ["beach", "heritage"], "budget": "medium", "seasons": ["winter", "autumn"]}');

INSERT INTO user_roles (user_id, role_id) VALUES (1, 1);

-- Seed an admin user (password: admin123)
INSERT INTO users (email, password_hash, full_name, phone, home_city, travel_preferences)
VALUES ('admin@travel.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Admin User', '+91-8888888888', 'Delhi', '{"categories": ["city", "adventure"], "budget": "high", "seasons": ["summer"]}');

INSERT INTO user_roles (user_id, role_id) VALUES (2, 1), (2, 2);
