#  Wayfare — Polyglot Microservices Travel & Trip Management Platform

A production-grade, enterprise-ready **polyglot microservices platform** engineered to demonstrate modern distributed systems architecture. Built with **5 distinct programming languages** (Java, Node.js, Go, Python, C++), **5 specialized databases and storage engines** (MySQL, PostgreSQL, Apache Cassandra, Redis), **RabbitMQ** event-driven messaging, **Kong API Gateway**, and a modern **React 18** SaaS web application.

---

##  Table of Contents
1. [Architectural Overview](#-architectural-overview)
2. [Technology Matrix & Service Architecture](#-technology-matrix--service-architecture)
3. [Distributed Transactions & Saga Pattern](#-distributed-transactions--saga-pattern)
4. [C++ Route Optimization Engine](#-c-route-optimization-engine)
5. [Quick Start & Setup](#-quick-start--setup)
6. [Interactive CLI & Database Inspection Guide](#-interactive-cli--database-inspection-guide)
7. [API Gateway & cURL Testing](#-api-gateway--curl-testing)
8. [End-to-End User Flow & Viva Demonstration Script](#-end-to-end-user-flow--viva-demonstration-script)
9. [Repository Structure](#-repository-structure)
10. [Troubleshooting & Maintenance](#-troubleshooting--maintenance)

---

##  Architectural Overview

The system strictly enforces the **Database-per-Service** pattern, decoupling domain boundaries and ensuring failure isolation. Communication between services occurs through **synchronous REST** (via Kong API Gateway) and **asynchronous event-driven messaging** (via RabbitMQ topic exchanges and dead-letter queues).

```
                               ┌──────────────────────────────────────────────┐
                               │     React 18 Frontend (Vite + Tailwind)      │
                               │           http://localhost:3000              │
                               └──────────────────────┬───────────────────────┘
                                                      │ HTTP / REST
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │           Kong API Gateway (:8000)           │
                               │  - JWT Verification & Header Enrichment      │
                               │  - Rate Limiting, Route Proxying & CORS      │
                               └──────┬───────┬────────┬────────┬───────┬─────┘
                                      │       │        │        │       │
              ┌───────────────────────┘       │        │        │       └────────────────────────┐
              ▼                               ▼        │        ▼                                ▼
     ┌─────────────────┐             ┌─────────────────┤┌─────────────────┐             ┌─────────────────┐
     │  User Service   │             │  Trip Service   ││ Booking Service │             │  Route Service  │
     │  Java 17 Spring │             │ Node.js Express ││    Go 1.21 Gin  │             │   C++20 Crow    │
     │    Port 8081    │             │    Port 8082    ││    Port 8083    │             │    Port 8085    │
     └────────┬────────┘             └────────┬────────┘└───────┬─────────┘             └────────┬────────┘
              │                               │                 │                                │
              ▼                               ▼                 ▼                                ▼
        ┌───────────┐                   ┌───────────┐     ┌───────────┐                    ┌───────────┐
        │ MySQL 8.0 │                   │PostgreSQL │     │PostgreSQL │                    │  Redis 7  │
        │(Auth & DB)│                   │(Trip DB)  │     │(Saga & DB)│                    │(Cache/TTL)│
        └───────────┘                   └─────┬─────┘     └─────┬─────┘                    └───────────┘
                                              │                 │
                                              │   ▲       ▲     │
                                              │   │       │     │
                                              ▼   │       │   ┌─┴────────────────┐
                                      ┌───────────┴───────┴───┴──────┐           ▼
                                      │      RabbitMQ Event Bus      │  ┌─────────────────┐
                                      │   Exchange: travel.events    │  │ Recommendation  │
                                      │  Topic & Dead-Letter Queues  │  │ Python FastAPI  │
                                      └──────────────────────────────┘  │    Port 8084    │
                                                                        └────────┬────────┘
                                                                                 │
                                                                                 ▼
                                                                           ┌───────────┐
                                                                           │ Cassandra │
                                                                           │(Analytics)│
                                                                           └───────────┘
```

---

##  Technology Matrix & Service Architecture

| Microservice | Language / Framework | Database & Storage | Key Patterns & Architecture |
| :--- | :--- | :--- | :--- |
| **User Service** | Java 17, Spring Boot 3, JPA | **MySQL 8.0** (`user_service_db`) | BCrypt password hashing, signed JWT token generation, role-based access control (`ADMIN`, `TRAVELER`), input validation. |
| **Trip Service** | Node.js (v20), Express.js | **PostgreSQL 15** (`trip_service_db`) | High I/O itinerary management, destination catalog, itinerary day mapping, event publishing, and slot reservations (`trip_reservations`). |
| **Booking Service** | Go 1.21, Gin Framework | **PostgreSQL 15** (`booking_service_db`) | **Saga State Machine Orchestration**, Transactional Outbox pattern, idempotent message consumers, payment capture and refund simulation. |
| **Recommendation Service** | Python 3.11, FastAPI | **Apache Cassandra 4.1** (`recommendation_service`) | NoSQL wide-column store for high-velocity user activity streams, destination scoring algorithms, preference filtering. |
| **Route Service** | C++20, Crow C++ framework | **Redis 7** (In-Memory Key/Value) | Dynamic Traveling Salesperson Problem (TSP) solver, Haversine geo-distance matrix calculations, sub-millisecond Redis TTL route caching. |
| **API Gateway** | Kong Gateway 3.5 | DB-less Declarative (`kong.yml`) | Central ingress point, JWT signature & expiration verification, automated header injection (`X-User-Id`, `X-User-Roles`). |
| **Frontend** | React 18, Vite, TypeScript | Browser LocalStorage | Modern responsive SaaS interface, dark/light theme, live distributed Saga timeline logs, real-time cascading state updates. |

---

## Distributed Transactions & Saga Pattern

Traditional ACID transactions cannot span multiple databases across microservices. Wayfare implements an **Orchestrated Saga Pattern** with a **Transactional Outbox** to ensure eventual consistency:

```
[Booking Request] ──► [Go Orchestrator]
                            │
                            ├── 1. Forward Step: ReserveTripSlot ──► [Trip Service (Postgres)]
                            │                                         Captures: trip_reservations (RESERVED)
                            │
                            ├── 2. Forward Step: Process Payment ──► [Payment Ledger (Postgres)]
                            │                                         Captures: payments (SUCCESS)
                            │
                            └── 3. Confirm Booking ────────────────► [Bookings DB]
                                                                      Status: CONFIRMED | Saga: COMPLETED

─── Failure / Cancellation Compensation Flow ───────────────────────────────────────────
                            │
                            ├── Compensate: ReleaseTripSlot ───────► [Trip Service]
                            │                                         Releases: trip_reservations (RELEASED)
                            │
                            ├── Compensate: Refund Payment ────────► [Payment Ledger]
                            │                                         Releases: payments (REFUNDED)
                            │
                            └── Finalize State ────────────────────► [Saga Engine]
                                                                      Status: CANCELLED / COMPENSATED
```

### Physical Resources Captured & Released:
1. **Trip Inventory Slot (`trip_reservations` in `trip_service_db`)**:
   - **Captured**: On `RESERVE_TRIP_SLOT`, locks calendar slots to prevent overbooking.
   - **Released**: On failure or trip cancellation, status transitions to `RELEASED` with timestamp `released_at`.
2. **Payment Funds (`payments` in `booking_service_db`)**:
   - **Captured**: On `PAYMENT`, charges the user and marks `SUCCESS`.
   - **Released**: On compensation/cancellation, issues a rollback and records `REFUNDED`.
3. **Cascading Trip Cancellation**:
   - Cancelling or deleting an entire trip itinerary automatically propagates through RabbitMQ to cancel all child reservations, release inventory slots, refund payments, and log terminal audit entries in `saga_steps`.

---

## ⚡ C++ Route Optimization Engine

When visiting multiple cities in a trip, finding the optimal order to minimize travel distance is an NP-hard Traveling Salesperson Problem (TSP):
- Built in **C++20** using `Crow` for ultra-low memory footprint and compute efficiency.
- Computes distances using spherical trigonometry (**Haversine formula**) using city latitude and longitude coordinates.
- Solves the route using a greedy nearest-neighbor heuristic with branch bounding.
- **Redis Caching**: Caches optimized itineraries using sorted key hashes (e.g. `route:1:2:3:4`) with an expiration TTL, eliminating redundant calculations.

---

## ⚙️ Quick Start & Setup

### Prerequisites
- [Docker](https://www.docker.com/) (version 24+)
- [Docker Compose](https://docs.docker.com/compose/) (v2.20+)

### 1. Clone & Configure
```bash
git clone <repository-url>
cd travel-management

# Ensure .env is present (defaults are pre-configured for local docker)
cp .env.example .env
```

### 2. Launch All Services
```bash
# Start all 12 containers in detached mode
docker compose up -d

# Verify all containers are running and healthy
docker compose ps
```

### 3. Application Endpoints
| Component | URL | Credentials / Notes |
| :--- | :--- | :--- |
| **Web Dashboard** | [http://localhost:3000](http://localhost:3000) | Main UI (Register or use existing user) |
| **Kong API Gateway** | [http://localhost:8000](http://localhost:8000) | Public API Entrypoint |
| **Kong Admin API** | [http://localhost:8001](http://localhost:8001) | Gateway configuration and routes |
| **RabbitMQ Management** | [http://localhost:15672](http://localhost:15672) | Username: `travel` \| Password: `travel_pass` |
| **User Service Swagger**| [http://localhost:8081/swagger-ui.html](http://localhost:8081/swagger-ui.html) | Direct Spring Boot OpenAPI |
| **Recommendation Docs** | [http://localhost:8084/docs](http://localhost:8084/docs) | FastAPI interactive Swagger docs |

---

## 💻 Interactive CLI & Database Inspection Guide

To demonstrate the **Database-per-Service** architecture to professors or examiners, use these exact command-line instructions:

### 1. MySQL CLI — User & Identity Database
Log into the MySQL container to inspect users, hashed credentials, and roles:
```bash
# Connect to MySQL interactive CLI
docker exec -it travel-mysql mysql -u user_service -puser_service_pass user_service_db

# Inside MySQL prompt:
SHOW TABLES;
SELECT id, username, email, role, created_at FROM users;
SELECT * FROM user_roles;
EXIT;
```
> **Viva Talking Point:** Passwords in the `users` table are hashed using salted BCrypt. Credentials never leave the User Service boundary.

---

### 2. PostgreSQL CLI — Trip Service Database
Inspect destination catalogs, trip itineraries, and slot reservations:
```bash
# Connect to PostgreSQL (trip_service_db)
docker exec -it travel-postgres psql -U postgres -d trip_service_db

# Inside psql prompt:
\dt
-- View all trips
SELECT id, user_id, title, start_date, end_date, budget, status FROM trips;

-- View destinations in catalog
SELECT id, name, category, daily_cost FROM destinations LIMIT 5;

-- View live inventory slot reservations captured by the Saga
SELECT id, trip_id, booking_id, status, reserved_at, released_at FROM trip_reservations;
\q
```
> **Viva Talking Point:** Notice `trip_reservations`. When a Saga booking starts, status is `RESERVED`. When cancelled, it transitions to `RELEASED`.

---

### 3. PostgreSQL CLI — Booking & Saga Orchestrator Database
Inspect the distributed transaction state machine, audit logs, outbox queue, and payments:
```bash
# Connect to PostgreSQL (booking_service_db)
docker exec -it travel-postgres psql -U postgres -d booking_service_db

# Inside psql prompt:
\dt

-- 1. View all Bookings and their current state
SELECT id, user_id, trip_id, booking_type, status, total_price, title FROM bookings;

-- 2. View Saga State Machine Instances
SELECT id, booking_id, status, current_step, retry_count, updated_at FROM saga_instances;

-- 3. View Step-by-Step Saga Audit Trail
SELECT id, saga_id, step_name, status, attempt, error, started_at, finished_at 
FROM saga_steps ORDER BY id ASC;

-- 4. View Payment Ledger (Capture & Refunds)
SELECT id, booking_id, amount, status, payment_method FROM payments;

-- 5. View Transactional Outbox Events (Reliable Event Dispatcher)
SELECT id, event_id, event_type, status, created_at FROM outbox_events ORDER BY id DESC LIMIT 5;
\q
```
> **Viva Talking Point:** `saga_steps` proves the exact progression of steps (`RESERVE_TRIP_SLOT`, `PAYMENT`, `CONFIRM_BOOKING`), and records compensation steps (`CANCEL_RESERVATION`, `REFUND_PAYMENT`) on failure or cancellation.

---

### 4. Cassandra CQLSH CLI — Recommendation Service Database
Inspect the NoSQL wide-column store for destination popularity and analytics:
```bash
# Connect to Cassandra CQL shell
docker exec -it travel-cassandra cqlsh -k recommendation_service

# Inside cqlsh prompt:
DESCRIBE TABLES;

-- Query precomputed destination scores
SELECT destination_id, category, score, reason FROM destination_scores LIMIT 10;

-- Query user interaction telemetry
SELECT user_id, destination_id, interaction_type, timestamp FROM user_interactions LIMIT 10;
EXIT;
```
> **Viva Talking Point:** Cassandra is selected for its high write throughput and horizontal scaling for logging continuous clickstream events without bottlenecking relational databases.

---

### 5. Redis CLI — Route Optimization Cache
Inspect cached TSP routes and TTL expiration:
```bash
# Connect to Redis CLI
docker exec -it travel-redis redis-cli

# Inside redis prompt:
PING
# List all cached route keys
KEYS "route:*"
# Inspect a cached route computation (replace with an active key from KEYS)
GET "route:1:2:3"
# Check remaining time to live (seconds)
TTL "route:1:2:3"
EXIT;
```
> **Viva Talking Point:** Caching dynamic TSP route calculations prevents redundant $O(n!)$ combinatorial operations on repeated requests.

---

### 6. RabbitMQ CLI & Management Dashboard
Inspect queues, message rates, and dead-letter exchanges:
- **Web UI:** Open [http://localhost:15672](http://localhost:15672) (User: `travel` / Password: `travel_pass`)
- **CLI Inspection:**
```bash
# List all active queues and unacknowledged messages
docker exec -it travel-rabbitmq rabbitmqctl list_queues name messages consumers

# Check cluster and node health
docker exec -it travel-rabbitmq rabbitmq-diagnostics check_running
```

---

##  API Gateway & cURL Testing

All external requests pass through Kong on port `8000`:

### 1. Authenticate (User Service via Kong)
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"abhi","password":"password123"}'
```
*Save the returned `"token"` for subsequent calls.*

### 2. Fetch Trips (Trip Service via Kong)
```bash
curl -X GET http://localhost:8000/api/v1/trips \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

### 3. Route Optimization (C++ Service via Kong)
```bash
curl -X POST http://localhost:8000/api/v1/routes/optimize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{"destinationIds": [1, 2, 3]}'
```

### 4. Trigger Saga Booking with Failure Simulation
```bash
# Simulate Payment Failure in Saga
curl -X POST http://localhost:8000/api/v1/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "X-Simulate-Failure: payment" \
  -d '{
    "trip_id": 1,
    "booking_type": "HOTEL",
    "title": "Grand Palace Hotel",
    "total_price": 250.00
  }'
```

---

##  End-to-End User Flow & Viva Demonstration Script

When presenting this project to your professor, follow this 4-step sequence:

### Step 1: Prove System Health & Microservices Mesh (1 min)
1. Run `docker compose ps` to show all 12 services running and healthy.
2. Open the web app at [http://localhost:3000](http://localhost:3000) and click the **"5 Polyglot Services Active"** badge in the navbar to show the service-to-database mapping modal.

### Step 2: Polyglot Database Diversity (2 mins)
1. Open your terminal and run the CLI queries from Section 6:
   - Run the **MySQL** query to show user credentials and BCrypt hashes.
   - Run the **PostgreSQL** query to show itineraries in `trip_service_db`.
   - Run the **Cassandra** query to show wide-column destination scoring.
   - Run the **Redis** query to show in-memory route caching.

### Step 3: High-Performance C++ Route Optimization (1 min)
1. Navigate to **Trips** $\rightarrow$ Open any trip with 3+ destinations.
2. Click **Optimize Itinerary Sequence**.
3. Point out that the C++ Crow microservice calculated the Haversine spherical distance matrix and solved the TSP sequence, storing the result in Redis with a 1-hour TTL.

### Step 4: Distributed Saga State Machine & Failure Resilience (2 mins)
1. **Normal Flow**:
   - Add a reservation in **Standard Mode** $\rightarrow$ Click **Log** $\rightarrow$ Show the green `COMPLETED` saga with all 3 steps (`RESERVE_TRIP_SLOT`, `PAYMENT`, `CONFIRM_BOOKING`).
2. **Failure Simulation**:
   - Add a reservation with **Simulation Mode: Simulate Payment Failure**.
   - Open the **Log** $\rightarrow$ Show the automated compensation: payment fails, `RELEASE_TRIP_SLOT` is dispatched, funds are not charged, slot is freed, and overall status is red `COMPENSATED`.
3. **Cascading Cancellation**:
   - Click **Cancel Trip Itinerary** $\rightarrow$ Show that all associated hotel and transport reservations automatically transition to `CANCELLED`, payment is refunded, and the saga log records `CANCEL_RESERVATION` and `REFUND_PAYMENT`.

---

##  Repository Structure

```
travel-management/
├── frontend/                       # React 18 + Vite + TypeScript SaaS Dashboard
│   ├── src/pages/                  # Dashboard, Trips, TripDetails, Bookings, Recommendations
│   └── src/components/             # Navbars, Sidebars, Modals, Saga Timeline Drawers
├── services/
│   ├── user-service/               # Java 17 Spring Boot + MySQL (Auth, JWT, Roles)
│   ├── trip-service/               # Node.js 20 Express + PostgreSQL (Trips & Destinations)
│   ├── booking-service/            # Go 1.21 Gin + PostgreSQL (Saga Orchestrator & Outbox)
│   ├── recommendation-service/     # Python 3.11 FastAPI + Apache Cassandra (Analytics)
│   └── route-service/              # C++20 Crow Engine + Redis (TSP Route Solver)
├── kong/                           # Kong API Gateway declarative routes (kong.yml)
├── infrastructure/                 # Initialization scripts (MySQL, PostgreSQL, Cassandra, RabbitMQ)
│   ├── mysql/init.sql              # User schema & seed data
│   ├── postgres/init.sql           # Trips, Bookings, Saga instances, Outbox schemas
│   ├── cassandra/init.cql          # Keyspace & table definitions
│   └── rabbitmq/                   # Exchange, queue, and DLQ configurations
├── docs/                           # Architectural specifications & technical manuals
├── explanation.md                  # Comprehensive viva explanation document
├── docker-compose.yml              # Multi-container service definitions
├── .env.example                    # Sample environment variables
└── README.md                       # Main project documentation
```

---

##  Troubleshooting & Maintenance

### Restarting a Specific Service
```bash
# Restart only the booking service without affecting other containers
docker compose restart booking-service
```

### Viewing Real-time Container Logs
```bash
# Tail logs for the Saga Orchestrator
docker compose logs -f booking-service

# Tail logs for the Trip Service
docker compose logs -f trip-service
```

### Rebuilding After Code Changes
```bash
# Rebuild a single service after making edits
docker compose build booking-service
docker compose up -d --no-deps booking-service
```

### Stopping the Entire Stack
```bash
# Graceful stop
docker compose down

# Stop and wipe persistent volume data (clean reset)
docker compose down -v
```

---


