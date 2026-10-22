package messaging

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"travel-management/services/booking-service/internal/model"
	"travel-management/services/booking-service/internal/repository"
)

type OutboxRelay struct {
	outboxRepo *repository.OutboxRepository
	publisher  *RabbitMQPublisher
	interval   time.Duration
}

func NewOutboxRelay(outboxRepo *repository.OutboxRepository, publisher *RabbitMQPublisher, interval time.Duration) *OutboxRelay {
	return &OutboxRelay{
		outboxRepo: outboxRepo,
		publisher:  publisher,
		interval:   interval,
	}
}

func (r *OutboxRelay) Start(ctx context.Context) {
	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.processPendingOutbox(ctx)
		}
	}
}

func (r *OutboxRelay) processPendingOutbox(ctx context.Context) {
	events, err := r.outboxRepo.GetPending(10)
	if err != nil {
		log.Printf("Error fetching outbox events: %v", err)
		return
	}

	for _, event := range events {
		var env model.Event
		if err := json.Unmarshal([]byte(event.Payload), &env); err != nil {
			// If payload is not envelope directly, construct envelope
			env = model.Event{
				EventID:    event.EventID,
				EventType:  event.EventType,
				OccurredAt: event.CreatedAt.Format(time.RFC3339),
				Source:     "booking-service",
				SagaID:     event.SagaID.String,
				Payload:    json.RawMessage(event.Payload),
			}
		}

		routingKey := "event." + event.EventType
		if event.EventType == "ReserveTripSlot" {
			routingKey = "saga.trip.command.reserve"
		} else if event.EventType == "ReleaseTripSlot" {
			routingKey = "saga.trip.command.release"
		}

		err := r.publisher.PublishEvent("travel.events", routingKey, &env)
		if err != nil {
			log.Printf("Failed to publish event %s: %v", event.ID, err)
			_ = r.outboxRepo.MarkFailed(event.ID, err.Error())
		} else {
			_ = r.outboxRepo.MarkSent(event.ID)
		}
	}
}
