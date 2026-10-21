# Travel & Trip Management Platform — Polyglot Microservices

A production-style **polyglot microservices platform** built with five programming languages (Java, Node.js, Go, Python, C++), multiple databases (MySQL, PostgreSQL, Cassandra, Redis), RabbitMQ async messaging, Kong API Gateway, and a modern React 18 dashboard.

---

## 🚀 Architectural Overview

```
                      React 18 Frontend (Vite + Tailwind)
                                     |
                                     v
                          Kong API Gateway (:8000)
                                     |
    +-----------------+--------------+--------------+-----------------+
    |                 |                             |                 |
User Service     Trip Service                 Booking Service    Recommendation    Route Service
 (Java 17)       (Node.js)                      (Go 1.21)          (Python)          (C++17)
  [MySQL]       [PostgreSQL]                  [PostgreSQL]       [Cassandra]       [Redis]
    |                 |                             |                 |               |
    +-----------------+-------------+---------------+-----------------+---------------+
                                    |
                         RabbitMQ Event Backbone
```

---

## 🧰 Technology Selection Matrix

| Component | Language / Tech | Database | Rationale for Selection |
|-----------|-----------------|----------|-------------------------|
| **User Service** | Java 17, Spring Boot 3 | MySQL 8 | Strong enterprise security, Spring Security JWT, BCrypt, Spring Data JPA relational integrity. |
| **Trip Service** | Node.js, Express.js | PostgreSQL 15 | High I/O efficiency, fast JSON handling for dynamic trip itineraries and destination search. |
| **Booking Service** | Go 1.21, Gin | PostgreSQL 15 | High-performance goroutines, strict type safety for the **Saga Orchestrator** state machine & outbox relay. |
| **Recommendation Service** | Python 3.11, FastAPI | Apache Cassandra | Natural AI/ML ecosystem, query-driven write-heavy analytics on Cassandra counters for destination popularity. |
| **Route Service** | C++17, CMake, cpp-httplib | Redis Cache | Near-zero overhead graph processing for TSP route optimization and ultra-fast Redis TTL caching. |
| **API Gateway** | Kong Gateway 3.5 | DB-less Declarative | Centralized JWT validation, rate limiting, CORS management, and route proxying. |
| **Frontend** | React 18, Vite, TypeScript | LocalStorage JWT | Modern responsive SaaS UI with TanStack Query, Tailwind CSS, dark mode, and interactive saga timelines. |

---

## ⚙️ Quick Start with Docker Compose

### Prerequisites
- Docker Engine 24+ and Docker Compose v2+

### Running the Entire System

```bash
# Clone and enter directory
cd travel-management

# Start all infrastructure, services, and frontend
docker-compose up -d --build
```

### Access Points

- **React Web Application:** `http://localhost:3000`
- **Kong API Gateway:** `http://localhost:8000`
- **RabbitMQ Management Dashboard:** `http://localhost:15672` (guest / guest)
- **User Service Swagger UI:** `http://localhost:8081/swagger-ui.html`
- **Recommendation Service Docs:** `http://localhost:8084/docs`

---

## 🔄 Saga Pattern & Failure Recovery Demo

The platform implements an explicit **Saga Orchestrator** in Go to manage multi-service booking transactions.

### How to Demo Compensation Flow:
1. Open the React frontend at `http://localhost:3000` and navigate to **Bookings & Saga**.
2. Click **New Booking**.
3. In the form, select **⚡ Failure Injection -> Simulate Payment Failure**.
4. Click **Start Saga**.
5. Observe the workflow:
   - Trip Service reserves the slot (`RESERVED`).
   - Payment step fails deterministically.
   - Compensating step triggers automatically, issuing `ReleaseTripSlot`.
   - Booking status becomes `FAILED` and Saga status becomes `COMPENSATED`.
6. Click **Saga Timeline** to inspect every step execution log.

---

## 📁 Repository Structure

```
travel-management/
├── frontend/                     # React 18 + Vite + TypeScript dashboard
├── services/
│   ├── user-service/             # Java Spring Boot + MySQL
│   ├── trip-service/             # Node.js Express + PostgreSQL
│   ├── booking-service/          # Go Gin + Saga Orchestrator + PostgreSQL
│   ├── recommendation-service/   # Python FastAPI + Cassandra
│   └── route-service/            # C++17 + Redis Cache
├── kong/                         # Declarative Kong configuration (kong.yml)
├── infrastructure/               # SQL / CQL / RabbitMQ init scripts
├── docs/                         # Architecture, API, Database & Saga docs
└── docker-compose.yml            # Container orchestration manifest
```
# Travel-manager
