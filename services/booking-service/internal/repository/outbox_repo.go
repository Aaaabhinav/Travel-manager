package repository

import (
	"database/sql"
	"encoding/json"
	"time"
)

type OutboxRepository struct {
	db *sql.DB
}

func NewOutboxRepository(db *sql.DB) *OutboxRepository {
	return &OutboxRepository{db: db}
}

func (r *OutboxRepository) Insert(tx *sql.Tx, eventID, eventType, routingKey string, payload interface{}, sagaID string) error {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	sagaIDVal := sql.NullString{String: sagaID, Valid: sagaID != ""}
	_, err = tx.Exec(
		`INSERT INTO outbox_events (event_id, event_type, routing_key, payload, saga_id, status)
		 VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
		eventID, eventType, routingKey, payloadBytes, sagaIDVal,
	)
	return err
}

type OutboxEvent struct {
	ID         int
	EventID    string
	EventType  string
	RoutingKey string
	Payload    json.RawMessage
	SagaID     sql.NullString
	Status     string
	CreatedAt  time.Time
}

func (r *OutboxRepository) GetPending(limit int) ([]OutboxEvent, error) {
	rows, err := r.db.Query(
		`SELECT id, event_id, event_type, routing_key, payload, saga_id, status, created_at
		 FROM outbox_events WHERE status = 'PENDING' ORDER BY id LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []OutboxEvent
	for rows.Next() {
		var e OutboxEvent
		err := rows.Scan(&e.ID, &e.EventID, &e.EventType, &e.RoutingKey, &e.Payload, &e.SagaID, &e.Status, &e.CreatedAt)
		if err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, nil
}

func (r *OutboxRepository) MarkSent(id int) error {
	_, err := r.db.Exec(
		`UPDATE outbox_events SET status = 'SENT', sent_at = NOW() WHERE id = $1`, id)
	return err
}
