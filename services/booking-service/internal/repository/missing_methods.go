package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"travel-management/services/booking-service/internal/model"
)

// Booking Repo additions
func (r *BookingRepository) CreateBookingWithSaga(ctx context.Context, req *model.CreateBookingRequest, userID int64, simulateFailure string) (*model.Booking, *model.SagaInstance, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback()

	if len(req.Items) == 0 {
		itemName := req.Title
		if itemName == "" {
			itemName = req.Notes
		}
		if itemName == "" {
			itemName = fmt.Sprintf("%s Reservation", req.BookingType)
		}
		itemPrice := req.TotalPrice
		if itemPrice <= 0 {
			itemPrice = 150.0
		}
		req.Items = []model.BookingItemRequest{
			{
				ItemType: req.BookingType,
				Name:     itemName,
				Price:    itemPrice,
				Quantity: 1,
			},
		}
	}

	var totalPrice float64
	for _, item := range req.Items {
		totalPrice += item.Price * float64(item.Quantity)
	}
	if totalPrice == 0 && req.TotalPrice > 0 {
		totalPrice = req.TotalPrice
	}

	notes := req.Title
	if notes == "" {
		notes = req.Notes
	}
	if notes == "" && len(req.Items) > 0 {
		notes = req.Items[0].Name
	}

	var tripIDVal *int64
	if req.TripID != nil && *req.TripID > 0 {
		tripIDVal = req.TripID
	}

	b, err := r.Create(tx, userID, tripIDVal, req.BookingType, notes, totalPrice)
	if err != nil {
		return nil, nil, err
	}
	b.Title = notes

	for _, item := range req.Items {
		if err := r.CreateItem(tx, b.ID, item); err != nil {
			return nil, nil, err
		}
	}

	sagaID := fmt.Sprintf("saga-%d-%d", b.ID, time.Now().UnixNano())
	payloadMap := map[string]interface{}{
		"simulate_failure": simulateFailure,
	}
	payloadBytes, _ := json.Marshal(payloadMap)

	saga := &model.SagaInstance{
		ID:          sagaID,
		Type:        "BOOKING_SAGA",
		BookingID:   b.ID,
		Status:      "STARTED",
		CurrentStep: sql.NullString{String: "INIT", Valid: true},
		Payload:     payloadBytes,
		Version:     1,
	}

	if err := NewSagaRepository(r.db).Create(tx, saga); err != nil {
		return nil, nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, nil, err
	}
	return b, saga, nil
}

func (r *BookingRepository) UpdateBookingStatus(id int, status string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := r.UpdateStatusDirect(tx, id, status); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *BookingRepository) CreatePayment(bookingID int, amount float64, status, method string) error {
	// Dummy implementation for now, assuming payments table exists
	_, err := r.db.Exec(`INSERT INTO payments (booking_id, amount, status, payment_method) VALUES ($1, $2, $3, $4)`, bookingID, amount, status, method)
	if err != nil {
		fmt.Printf("CreatePayment skipped/failed: %v\n", err)
	}
	return nil
}

// Saga Repo additions
func (r *SagaRepository) GetSagaWithStepsByBookingID(bookingID int) (*model.SagaInstance, []model.SagaStep, error) {
	saga, err := r.GetByBookingID(bookingID)
	if err != nil || saga == nil {
		return nil, nil, err
	}
	steps, err := r.GetSteps(saga.ID)
	if err != nil {
		return saga, nil, err
	}
	return saga, steps, nil
}

func (r *SagaRepository) ResetForRetry(sagaID string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	saga, err := r.GetByID(sagaID)
	if err != nil || saga == nil {
		return fmt.Errorf("saga not found")
	}

	saga.Status = "STARTED"
	saga.RetryCount++
	if err := r.Update(tx, saga); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *SagaRepository) RecordSagaStep(sagaID, stepName, status string, attempt int, errMsg string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Try to update first
	finishedAt := sql.NullTime{Time: time.Now(), Valid: true}
	errStr := sql.NullString{String: errMsg, Valid: errMsg != ""}
	res, err := tx.Exec(`UPDATE saga_steps SET status = $1, attempt = $2, error = $3, finished_at = $4 WHERE saga_id = $5 AND step_name = $6`, status, attempt, errStr, finishedAt, sagaID, stepName)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		// Insert if not exists
		_, err = tx.Exec(`INSERT INTO saga_steps (saga_id, step_name, status, attempt, error, started_at, finished_at) VALUES ($1, $2, $3, $4, $5, NOW(), $6)`, sagaID, stepName, status, attempt, errStr, finishedAt)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *SagaRepository) SetSagaStatus(sagaID, status, currentStep string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	saga, err := r.GetByID(sagaID)
	if err != nil || saga == nil {
		return fmt.Errorf("saga not found")
	}

	saga.Status = status
	saga.CurrentStep = sql.NullString{String: currentStep, Valid: true}
	if err := r.Update(tx, saga); err != nil {
		return err
	}
	return tx.Commit()
}

// Outbox Repo additions
func (r *OutboxRepository) CreateEvent(eventType string, payload []byte, sagaID string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	eventID := fmt.Sprintf("evt-%d", time.Now().UnixNano())
	
	var raw json.RawMessage
	if len(payload) > 0 {
		raw = json.RawMessage(payload)
	} else {
		raw = json.RawMessage(`{}`)
	}

	if err := r.Insert(tx, eventID, eventType, eventType, raw, sagaID); err != nil {
		return err
	}
	return tx.Commit()
}
func (r *SagaRepository) MarkMessageProcessedDirect(messageID string) error {
	tx, err := r.db.Begin()
	if err != nil { return err }
	defer tx.Rollback()
	if err := r.MarkMessageProcessed(tx, messageID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *OutboxRepository) MarkFailed(id int, errMsg string) error {
	_, err := r.db.Exec(`UPDATE outbox_events SET status = 'FAILED' WHERE id = $1`, id)
	return err
}

func (r *BookingRepository) RefundPayment(bookingID int) error {
	_, err := r.db.Exec(`UPDATE payments SET status = 'REFUNDED' WHERE booking_id = $1`, bookingID)
	return err
}

