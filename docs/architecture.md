# System Architecture & Event Topology

## Overview

The **Travel & Trip Management Platform** is a polyglot microservices application designed with database-per-service isolation, asynchronous messaging, and an API Gateway entry point.

```
React 18 Frontend (Vite, Tailwind, TypeScript)
       |
       v  [HTTP / REST]
Kong API Gateway (Port 8000)
       |
       +----> Java User Service (MySQL)            Port 8081
       +----> Node.js Trip Service (PostgreSQL)     Port 8082
       +----> Go Booking Service (PostgreSQL)      Port 8083 (Saga Orchestrator)
       +----> Python Recommendation (Cassandra)   Port 8084
       +----> C++ Route Service (Redis)           Port 8085
```

---

## Service Responsibilities & Tech Stack

| Service | Language & Framework | Primary DB | Async Messaging | Key Responsibilities |
|---------|---------------------|------------|-----------------|----------------------|
| **User Service** | Java 17, Spring Boot 3 | MySQL 8 | RabbitMQ Producer | User registration, authentication, BCrypt hashing, JWT issuance, profile management. |
| **Trip Service** | Node.js, Express.js | PostgreSQL 15 | RabbitMQ Consumer/Producer | Trip CRUD, destination catalog (30+ destinations), itinerary planning, participant in booking saga. |
| **Booking Service** | Go 1.21, Gin | PostgreSQL 15 | RabbitMQ Producer/Consumer | Booking CRUD, payment gateway simulation, **Saga Orchestrator** for creation & cancellation workflows, transactional outbox. |
| **Recommendation Service** | Python 3.11, FastAPI | Apache Cassandra | RabbitMQ Consumer | Destination/activity recommendation scoring, user preference tracking, counter popularity updates. |
| **Route Service** | C++17, CMake, httplib | Redis 7 | N/A | Haversine + Nearest Neighbor TSP route optimization, Redis TTL result caching. |

---

## Asynchronous Event Topology (RabbitMQ)

Topic Exchange: `travel.events`

| Queue Name | Routing Key | Producer | Consumer(s) | Description |
|------------|-------------|----------|-------------|-------------|
| `trip.commands` | `trip.commands` | Booking Service | Trip Service | Command queue for `ReserveTripSlot` and `ReleaseTripSlot`. |
| `booking.saga.replies` | `booking.saga.replies` | Trip Service | Booking Service | Reply queue for `TripSlotReserved`, `TripSlotRejected`, `TripSlotReleased`. |
| `recommendation_queue` | `event.#`, `booking.#` | User, Trip, Booking Services | Recommendation Service | Fan-out subscriber for preference and popularity counter updates. |

---

## Network Isolation & Security Rules

1. **Gateway Isolation:** Only Kong (Port 8000) and the React Frontend (Port 3000 / 80) expose external host ports. All backend databases and services communicate within the internal Docker bridge network (`travel_net`).
2. **JWT Security:** Kong validates signed JWT tokens issued by the Java User Service on protected routes.
