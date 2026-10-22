package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	amqp "github.com/rabbitmq/amqp091-go"

	"travel-management/services/booking-service/internal/config"
	"travel-management/services/booking-service/internal/handler"
	"travel-management/services/booking-service/internal/messaging"
	"travel-management/services/booking-service/internal/repository"
	"travel-management/services/booking-service/internal/saga"
	"travel-management/services/booking-service/internal/service"
)

func main() {
	cfg := config.Load()

	// Connect to PostgreSQL with retry
	var db *sql.DB
	var err error
	for i := 0; i < 15; i++ {
		dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
			cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName)
		db, err = sql.Open("postgres", dsn)
		if err == nil {
			err = db.Ping()
		}
		if err == nil {
			log.Println("Connected to PostgreSQL")
			break
		}
		log.Printf("DB connection attempt %d/15 failed: %v", i+1, err)
		time.Sleep(3 * time.Second)
	}
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Connect to RabbitMQ with retry
	var amqpConn *amqp.Connection
	for i := 0; i < 15; i++ {
		amqpConn, err = amqp.Dial(cfg.RabbitMQURL)
		if err == nil {
			log.Println("Connected to RabbitMQ")
			break
		}
		log.Printf("RabbitMQ connection attempt %d/15 failed: %v", i+1, err)
		time.Sleep(3 * time.Second)
	}
	if err != nil {
		log.Fatalf("Failed to connect to RabbitMQ: %v", err)
	}
	defer amqpConn.Close()

	// Setup messaging
	pubCh, err := amqpConn.Channel()
	if err != nil {
		log.Fatalf("Failed to open publisher channel: %v", err)
	}
	publisher := messaging.NewRabbitMQPublisher(pubCh, cfg.RabbitMQExchange)

	// Setup repositories
	bookingRepo := repository.NewBookingRepository(db)
	sagaRepo := repository.NewSagaRepository(db)
	outboxRepo := repository.NewOutboxRepository(db)

	// Setup saga orchestrator
	orchestrator := saga.NewOrchestrator(sagaRepo, bookingRepo, outboxRepo, publisher)

	// Setup services
	bookingSvc := service.NewBookingService(bookingRepo, sagaRepo, outboxRepo, cfg.TripServiceURL)

	// Setup consumer for saga replies
	ch, err := amqpConn.Channel()
	if err != nil {
		log.Fatalf("Failed to open channel: %v", err)
	}
	consumer := messaging.NewConsumer(ch, sagaRepo, orchestrator)
	go consumer.Start(context.Background(), "booking.saga.replies")

	// Setup outbox relay
	outboxRelay := messaging.NewOutboxRelay(outboxRepo, publisher, 5*time.Second)
	go outboxRelay.Start(context.Background())

	// Setup Gin router
	router := gin.Default()

	h := handler.NewBookingHandler(bookingSvc, orchestrator)

	// Register routes for both /bookings and root path
	router.POST("/bookings", h.CreateBooking)
	router.POST("/", h.CreateBooking)

	router.GET("/bookings", h.GetBookings)
	router.GET("/", h.GetBookings)

	router.GET("/trips/:tripId", h.GetTripBookings)
	router.GET("/bookings/trips/:tripId", h.GetTripBookings)

	router.GET("/bookings/:id", h.GetBookingByID)
	router.GET("/:id", h.GetBookingByID)

	router.GET("/users/:userId/bookings", h.GetUserBookings)
	router.GET("/users/:userId", h.GetUserBookings)
	router.GET("/bookings/users/:userId", h.GetUserBookings)

	router.PUT("/bookings/:id/cancel", h.CancelBooking)
	router.PUT("/:id/cancel", h.CancelBooking)
	router.PUT("/bookings/trip/:tripId/cancel", h.CancelTripBookings)
	router.PUT("/trips/:tripId/cancel-bookings", h.CancelTripBookings)

	router.GET("/bookings/:id/saga", h.GetSagaTimeline)
	router.GET("/:id/saga", h.GetSagaTimeline)

	router.POST("/admin/sagas/:id/retry", h.RetrySaga)

	router.GET("/health", func(c *gin.Context) {
		dbErr := db.Ping()
		dbStatus := "UP"
		if dbErr != nil {
			dbStatus = "DOWN"
		}
		rabbitStatus := "UP"
		if amqpConn.IsClosed() {
			rabbitStatus = "DOWN"
		}
		c.JSON(http.StatusOK, gin.H{
			"status":    "UP",
			"service":   "booking-service",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"dependencies": gin.H{
				"database": dbStatus,
				"rabbitmq": rabbitStatus,
			},
		})
	})

	// Start server
	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: router,
	}

	go func() {
		log.Printf("Booking Service started on port %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down Booking Service...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
	log.Println("Booking Service stopped")
}
