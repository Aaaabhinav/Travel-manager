package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"travel-management/services/booking-service/internal/model"
)

type SagaRepository struct {
	db *sql.DB
}

func NewSagaRepository(db *sql.DB) *SagaRepository {
	return &SagaRepository{db: db}
}

func (r *SagaRepository) Create(tx *sql.Tx, saga *model.SagaInstance) error {
	_, err := tx.Exec(
		`INSERT INTO saga_instances (id, type, booking_id, status, current_step, payload, retry_count, timeout_at, version)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		saga.ID, saga.Type, saga.BookingID, saga.Status, saga.CurrentStep,
		saga.Payload, saga.RetryCount, saga.TimeoutAt, saga.Version,
	)
	return err
}

func (r *SagaRepository) GetByID(id string) (*model.SagaInstance, error) {
	saga := &model.SagaInstance{}
	err := r.db.QueryRow(
		`SELECT id, type, booking_id, status, current_step, payload, retry_count, timeout_at, version, created_at, updated_at
		 FROM saga_instances WHERE id = $1`, id,
	).Scan(&saga.ID, &saga.Type, &saga.BookingID, &saga.Status, &saga.CurrentStep,
		&saga.Payload, &saga.RetryCount, &saga.TimeoutAt, &saga.Version, &saga.CreatedAt, &saga.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return saga, err
}

func (r *SagaRepository) GetByBookingID(bookingID int) (*model.SagaInstance, error) {
	saga := &model.SagaInstance{}
	err := r.db.QueryRow(
		`SELECT id, type, booking_id, status, current_step, payload, retry_count, timeout_at, version, created_at, updated_at
		 FROM saga_instances WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1`, bookingID,
	).Scan(&saga.ID, &saga.Type, &saga.BookingID, &saga.Status, &saga.CurrentStep,
		&saga.Payload, &saga.RetryCount, &saga.TimeoutAt, &saga.Version, &saga.CreatedAt, &saga.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return saga, err
}

func (r *SagaRepository) Update(tx *sql.Tx, saga *model.SagaInstance) error {
	result, err := tx.Exec(
		`UPDATE saga_instances SET status = $1, current_step = $2, payload = $3, retry_count = $4,
		 timeout_at = $5, version = version + 1, updated_at = NOW()
		 WHERE id = $6 AND version = $7`,
		saga.Status, saga.CurrentStep, saga.Payload, saga.RetryCount, saga.TimeoutAt,
		saga.ID, saga.Version,
	)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("optimistic locking failed for saga %s (version %d)", saga.ID, saga.Version)
	}
	saga.Version++
	return nil
}

func (r *SagaRepository) CreateStep(tx *sql.Tx, step *model.SagaStep) error {
	_, err := tx.Exec(
		`INSERT INTO saga_steps (saga_id, step_name, status, attempt, error, started_at, finished_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		step.SagaID, step.StepName, step.Status, step.Attempt, step.Error, step.StartedAt, step.FinishedAt,
	)
	return err
}

func (r *SagaRepository) UpdateStep(tx *sql.Tx, sagaID, stepName, status string, attempt int, errMsg string) error {
	finishedAt := sql.NullTime{Time: time.Now(), Valid: true}
	errStr := sql.NullString{String: errMsg, Valid: errMsg != ""}
	_, err := tx.Exec(
		`UPDATE saga_steps SET status = $1, attempt = $2, error = $3, finished_at = $4
		 WHERE saga_id = $5 AND step_name = $6`,
		status, attempt, errStr, finishedAt, sagaID, stepName,
	)
	return err
}

func (r *SagaRepository) GetSteps(sagaID string) ([]model.SagaStep, error) {
	rows, err := r.db.Query(
		`SELECT id, saga_id, step_name, status, attempt, error, started_at, finished_at
		 FROM saga_steps WHERE saga_id = $1 ORDER BY id`, sagaID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var steps []model.SagaStep
	for rows.Next() {
		var s model.SagaStep
		err := rows.Scan(&s.ID, &s.SagaID, &s.StepName, &s.Status, &s.Attempt, &s.Error, &s.StartedAt, &s.FinishedAt)
		if err != nil {
			return nil, err
		}
		steps = append(steps, s)
	}
	return steps, nil
}

func (r *SagaRepository) GetNonTerminalSagas() ([]model.SagaInstance, error) {
	rows, err := r.db.Query(
		`SELECT id, type, booking_id, status, current_step, payload, retry_count, timeout_at, version, created_at, updated_at
		 FROM saga_instances WHERE status IN ('STARTED', 'COMPENSATING') ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sagas []model.SagaInstance
	for rows.Next() {
		var s model.SagaInstance
		err := rows.Scan(&s.ID, &s.Type, &s.BookingID, &s.Status, &s.CurrentStep,
			&s.Payload, &s.RetryCount, &s.TimeoutAt, &s.Version, &s.CreatedAt, &s.UpdatedAt)
		if err != nil {
			return nil, err
		}
		sagas = append(sagas, s)
	}
	return sagas, nil
}

func (r *SagaRepository) GetTimedOutSagas() ([]model.SagaInstance, error) {
	rows, err := r.db.Query(
		`SELECT id, type, booking_id, status, current_step, payload, retry_count, timeout_at, version, created_at, updated_at
		 FROM saga_instances WHERE status IN ('STARTED', 'COMPENSATING') AND timeout_at < NOW()`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sagas []model.SagaInstance
	for rows.Next() {
		var s model.SagaInstance
		err := rows.Scan(&s.ID, &s.Type, &s.BookingID, &s.Status, &s.CurrentStep,
			&s.Payload, &s.RetryCount, &s.TimeoutAt, &s.Version, &s.CreatedAt, &s.UpdatedAt)
		if err != nil {
			return nil, err
		}
		sagas = append(sagas, s)
	}
	return sagas, nil
}

func (r *SagaRepository) IsMessageProcessed(messageID string) (bool, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM processed_messages WHERE message_id = $1`, messageID).Scan(&count)
	return count > 0, err
}

func (r *SagaRepository) MarkMessageProcessed(tx *sql.Tx, messageID string) error {
	_, err := tx.Exec(`INSERT INTO processed_messages (message_id) VALUES ($1) ON CONFLICT DO NOTHING`, messageID)
	return err
}

// GetSagaPayload gets the payload and unmarshals it
func GetSagaPayload(saga *model.SagaInstance) (map[string]interface{}, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(saga.Payload, &payload); err != nil {
		return nil, err
	}
	return payload, nil
}
