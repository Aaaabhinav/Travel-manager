package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port                    string
	DBHost                  string
	DBPort                  string
	DBUser                  string
	DBPassword              string
	DBName                  string
	RabbitMQURL             string
	RabbitMQExchange        string
	TripServiceURL          string
	JWTSecret               string
	SagaStepTimeoutSec      int
	SagaMaxRetries          int
	SagaRetryBackoffMs      int
	OutboxPollIntervalMs    int
	SagaRecoveryIntervalSec int
	EnableFailureInjection  bool
}

func Load() *Config {
	return &Config{
		Port:                    getEnv("PORT", "8083"),
		DBHost:                  getEnv("DB_HOST", "localhost"),
		DBPort:                  getEnv("DB_PORT", "5432"),
		DBUser:                  getEnv("DB_USER", "postgres"),
		DBPassword:              getEnv("DB_PASSWORD", "postgres_pass"),
		DBName:                  getEnv("DB_NAME", "booking_service_db"),
		RabbitMQURL:             getEnv("RABBITMQ_URL", "amqp://travel:travel_pass@localhost:5672/"),
		RabbitMQExchange:        getEnv("RABBITMQ_EXCHANGE", "travel.events"),
		TripServiceURL:          getEnv("TRIP_SERVICE_URL", "http://trip-service:8082"),
		JWTSecret:               getEnv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production"),
		SagaStepTimeoutSec:      getEnvInt("SAGA_STEP_TIMEOUT_SECONDS", 30),
		SagaMaxRetries:          getEnvInt("SAGA_MAX_RETRIES", 3),
		SagaRetryBackoffMs:      getEnvInt("SAGA_RETRY_BACKOFF_MS", 1000),
		OutboxPollIntervalMs:    getEnvInt("OUTBOX_POLL_INTERVAL_MS", 500),
		SagaRecoveryIntervalSec: getEnvInt("SAGA_RECOVERY_INTERVAL_SECONDS", 60),
		EnableFailureInjection:  getEnv("ENABLE_FAILURE_INJECTION", "false") == "true",
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if value, ok := os.LookupEnv(key); ok {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return fallback
}
