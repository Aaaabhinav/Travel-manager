package model

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// Booking represents a booking record
type Booking struct {
	ID          int             `json:"id"`
	UserID      int64           `json:"user_id"`
	TripID      sql.NullInt64   `json:"-"`
	BookingType string          `json:"booking_type"`
	Status      string          `json:"status"`
	TotalPrice  float64         `json:"total_price"`
	Notes       sql.NullString  `json:"-"`
	Title       string          `json:"title"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

func (b Booking) MarshalJSON() ([]byte, error) {
	var tripID *int64
	if b.TripID.Valid {
		v := b.TripID.Int64
		tripID = &v
	}
	notes := ""
	if b.Notes.Valid {
		notes = b.Notes.String
	}
	title := b.Title
	if title == "" {
		title = notes
	}
	if title == "" {
		title = fmt.Sprintf("%s Reservation", b.BookingType)
	}

	return json.Marshal(&struct {
		ID          int       `json:"id"`
		UserID      int64     `json:"user_id"`
		TripID      *int64    `json:"trip_id"`
		BookingType string    `json:"booking_type"`
		Status      string    `json:"status"`
		TotalPrice  float64   `json:"total_price"`
		Notes       string    `json:"notes"`
		Title       string    `json:"title"`
		CreatedAt   time.Time `json:"created_at"`
		UpdatedAt   time.Time `json:"updated_at"`
	}{
		ID:          b.ID,
		UserID:      b.UserID,
		TripID:      tripID,
		BookingType: b.BookingType,
		Status:      b.Status,
		TotalPrice:  b.TotalPrice,
		Notes:       notes,
		Title:       title,
		CreatedAt:   b.CreatedAt,
		UpdatedAt:   b.UpdatedAt,
	})
}

// BookingItem represents an item within a booking
type BookingItem struct {
	ID          int             `json:"id"`
	BookingID   int             `json:"booking_id"`
	ItemType    string          `json:"item_type"`
	Name        string          `json:"name"`
	Description sql.NullString  `json:"description"`
	Price       float64         `json:"price"`
	Quantity    int             `json:"quantity"`
	CheckIn     sql.NullString  `json:"check_in"`
	CheckOut    sql.NullString  `json:"check_out"`
	Details     json.RawMessage `json:"details"`
	CreatedAt   time.Time       `json:"created_at"`
}

// Payment represents a payment record
type Payment struct {
	ID            int            `json:"id"`
	BookingID     int            `json:"booking_id"`
	Amount        float64        `json:"amount"`
	Status        string         `json:"status"`
	PaymentMethod string         `json:"payment_method"`
	TransactionID sql.NullString `json:"transaction_id"`
	ErrorMessage  sql.NullString `json:"error_message"`
	CreatedAt     time.Time      `json:"created_at"`
}

// SagaInstance represents a saga state machine
type SagaInstance struct {
	ID          string          `json:"id"`
	Type        string          `json:"type"`
	BookingID   int             `json:"booking_id"`
	Status      string          `json:"status"`
	CurrentStep sql.NullString  `json:"current_step"`
	Payload     json.RawMessage `json:"payload"`
	RetryCount  int             `json:"retry_count"`
	TimeoutAt   sql.NullTime    `json:"timeout_at"`
	Version     int             `json:"version"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

// SagaStep represents a step in the saga
type SagaStep struct {
	ID         int            `json:"id"`
	SagaID     string         `json:"saga_id"`
	StepName   string         `json:"step_name"`
	Status     string         `json:"status"`
	Attempt    int            `json:"attempt"`
	Error      sql.NullString `json:"error"`
	StartedAt  sql.NullTime   `json:"started_at"`
	FinishedAt sql.NullTime   `json:"finished_at"`
}

// CreateBookingRequest is the API request body
type CreateBookingRequest struct {
	TripID      *int64               `json:"trip_id"`
	BookingType string               `json:"booking_type" binding:"required,oneof=HOTEL TRANSPORT ACTIVITY"`
	Title       string               `json:"title"`
	TotalPrice  float64              `json:"total_price"`
	Items       []BookingItemRequest `json:"items"`
	Notes       string               `json:"notes"`
	BookingDate string               `json:"booking_date"`
}

type BookingItemRequest struct {
	ItemType    string          `json:"item_type"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Price       float64         `json:"price"`
	Quantity    int             `json:"quantity"`
	CheckIn     string          `json:"check_in"`
	CheckOut    string          `json:"check_out"`
	Details     json.RawMessage `json:"details"`
}

// BookingResponse is the API response
type BookingResponse struct {
	ID          int              `json:"id"`
	UserID      int64            `json:"user_id"`
	TripID      *int64           `json:"trip_id,omitempty"`
	BookingType string           `json:"booking_type"`
	Status      string           `json:"status"`
	TotalPrice  float64          `json:"total_price"`
	Notes       string           `json:"notes,omitempty"`
	SagaID      string           `json:"saga_id,omitempty"`
	Items       []BookingItemResponse `json:"items,omitempty"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
}

type BookingItemResponse struct {
	ID          int             `json:"id"`
	ItemType    string          `json:"item_type"`
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Price       float64         `json:"price"`
	Quantity    int             `json:"quantity"`
	CheckIn     string          `json:"check_in,omitempty"`
	CheckOut    string          `json:"check_out,omitempty"`
	Details     json.RawMessage `json:"details,omitempty"`
}

// SagaStatusResponse for GET /bookings/:id/saga
type SagaStatusResponse struct {
	SagaID      string          `json:"saga_id"`
	Type        string          `json:"type"`
	BookingID   int             `json:"booking_id"`
	Status      string          `json:"status"`
	CurrentStep string          `json:"current_step"`
	RetryCount  int             `json:"retry_count"`
	Steps       []SagaStepResponse `json:"steps"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

type SagaStepResponse struct {
	StepName   string     `json:"step_name"`
	Status     string     `json:"status"`
	Attempt    int        `json:"attempt"`
	Error      string     `json:"error,omitempty"`
	StartedAt  *time.Time `json:"started_at,omitempty"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
}

// Event envelope for RabbitMQ
type Event struct {
	EventID    string          `json:"eventId"`
	EventType  string          `json:"eventType"`
	OccurredAt string          `json:"occurredAt"`
	Source     string          `json:"source"`
	SagaID     string          `json:"sagaId,omitempty"`
	Payload    json.RawMessage `json:"payload"`
}
