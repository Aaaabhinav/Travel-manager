package messaging

import (
	"encoding/json"
	"fmt"

	amqp "github.com/rabbitmq/amqp091-go"

	"travel-management/services/booking-service/internal/model"
)

type RabbitMQPublisher struct {
	channel  *amqp.Channel
	exchange string
}

func NewRabbitMQPublisher(ch *amqp.Channel, exchange string) *RabbitMQPublisher {
	return &RabbitMQPublisher{
		channel:  ch,
		exchange: exchange,
	}
}

func (p *RabbitMQPublisher) PublishEvent(exchange, routingKey string, event *model.Event) error {
	if p.channel == nil {
		return fmt.Errorf("rabbitmq channel is nil")
	}

	body, err := json.Marshal(event)
	if err != nil {
		return err
	}

	if exchange == "" {
		exchange = p.exchange
	}

	return p.channel.Publish(
		exchange,
		routingKey,
		false,
		false,
		amqp.Publishing{
			ContentType: "application/json",
			Body:        body,
		},
	)
}
