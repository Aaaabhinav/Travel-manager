package messaging

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	amqp "github.com/rabbitmq/amqp091-go"
)

type Publisher struct {
	channel  *amqp.Channel
	exchange string
}

func NewPublisher(conn *amqp.Connection, exchange string) (*Publisher, error) {
	ch, err := conn.Channel()
	if err != nil {
		return nil, fmt.Errorf("failed to open channel: %w", err)
	}

	err = ch.ExchangeDeclare(exchange, "topic", true, false, false, false, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to declare exchange: %w", err)
	}

	return &Publisher{channel: ch, exchange: exchange}, nil
}

type EventEnvelope struct {
	EventID    string      `json:"eventId"`
	EventType  string      `json:"eventType"`
	OccurredAt string      `json:"occurredAt"`
	Source     string      `json:"source"`
	SagaID     string      `json:"sagaId,omitempty"`
	Payload    interface{} `json:"payload"`
}

func (p *Publisher) Publish(routingKey string, payload interface{}, sagaID string) error {
	envelope := EventEnvelope{
		EventID:    uuid.New().String(),
		EventType:  routingKey,
		OccurredAt: time.Now().UTC().Format(time.RFC3339),
		Source:     "booking-service",
		SagaID:     sagaID,
		Payload:    payload,
	}

	body, err := json.Marshal(envelope)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	err = p.channel.Publish(
		p.exchange,
		routingKey,
		false,
		false,
		amqp.Publishing{
			ContentType:  "application/json",
			Body:         body,
			DeliveryMode: amqp.Persistent,
			MessageId:    envelope.EventID,
			Timestamp:    time.Now(),
		},
	)
	if err != nil {
		return fmt.Errorf("failed to publish event: %w", err)
	}

	log.Printf("Published event: %s (sagaId=%s)", routingKey, sagaID)
	return nil
}
