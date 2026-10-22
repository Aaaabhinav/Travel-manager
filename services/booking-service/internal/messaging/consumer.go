package messaging

import (
	"context"
	"encoding/json"
	"log"

	amqp "github.com/rabbitmq/amqp091-go"

	"travel-management/services/booking-service/internal/model"
	"travel-management/services/booking-service/internal/repository"
	"travel-management/services/booking-service/internal/saga"
)

type Consumer struct {
	channel      *amqp.Channel
	sagaRepo     *repository.SagaRepository
	orchestrator *saga.Orchestrator
}

func NewConsumer(ch *amqp.Channel, sagaRepo *repository.SagaRepository, orchestrator *saga.Orchestrator) *Consumer {
	return &Consumer{
		channel:      ch,
		sagaRepo:     sagaRepo,
		orchestrator: orchestrator,
	}
}

func (c *Consumer) Start(ctx context.Context, queueName string) {
	msgs, err := c.channel.Consume(
		queueName,
		"",
		false, // manual ack
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		log.Fatalf("Failed to register consumer on queue %s: %v", queueName, err)
	}

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case msg, ok := <-msgs:
				if !ok {
					return
				}
				c.handleMessage(ctx, msg)
			}
		}
	}()
}

func (c *Consumer) handleMessage(ctx context.Context, msg amqp.Delivery) {
	var env model.Event
	if err := json.Unmarshal(msg.Body, &env); err != nil {
		log.Printf("Invalid message body: %v", err)
		_ = msg.Nack(false, false)
		return
	}

	// Idempotency check using processed_messages
	isProcessed, err := c.sagaRepo.IsMessageProcessed(env.EventID)
	if err != nil {
		log.Printf("Error checking message processing status: %v", err)
		_ = msg.Nack(false, true)
		return
	}

	if isProcessed {
		log.Printf("Duplicate message %s ignored", env.EventID)
		_ = msg.Ack(false)
		return
	}

	// Process message
	switch env.EventType {
	case "TripSlotReserved", "TripSlotRejected", "TripSlotReleased",
		"saga.booking.reply.trip-slot-reserved", "saga.booking.reply.trip-slot-rejected", "saga.booking.reply.trip-slot-released":
		var payload map[string]interface{}
		_ = json.Unmarshal(env.Payload, &payload)
		errMsg := ""
		if em, ok := payload["error"].(string); ok {
			errMsg = em
		} else if rm, ok := payload["reason"].(string); ok {
			errMsg = rm
		}
		err = c.orchestrator.HandleTripSlotReply(ctx, env.SagaID, env.EventType, errMsg)

	case "event.trip.cancelled", "event.trip.deleted", "TripCancelled", "TripDeleted":
		var payload map[string]interface{}
		_ = json.Unmarshal(env.Payload, &payload)
		tripIDVal := 0
		if tid, ok := payload["tripId"].(float64); ok {
			tripIDVal = int(tid)
		} else if tid, ok := payload["trip_id"].(float64); ok {
			tripIDVal = int(tid)
		}
		if tripIDVal > 0 {
			log.Printf("[Consumer] Trip %d cancelled/deleted, cascading cancellation to bookings", tripIDVal)
			err = c.orchestrator.CancelTripBookings(ctx, tripIDVal)
		}

	default:
		log.Printf("Unhandled message type: %s", env.EventType)
	}

	if err != nil {
		log.Printf("Error processing message %s: %v", env.EventID, err)
		_ = msg.Nack(false, true) // requeue
	} else {
		_ = c.sagaRepo.MarkMessageProcessedDirect(env.EventID)
		_ = msg.Ack(false)
	}
}
