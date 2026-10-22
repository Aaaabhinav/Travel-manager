package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"travel-management/services/booking-service/internal/model"
)

type BookingRepository struct {
	db *sql.DB
}

func NewBookingRepository(db *sql.DB) *BookingRepository {
	return &BookingRepository{db: db}
}

func (r *BookingRepository) Create(tx *sql.Tx, userID int64, tripID *int64, bookingType, notes string, totalPrice float64) (*model.Booking, error) {
	var id int
	var createdAt, updatedAt time.Time
	var tripIDVal sql.NullInt64
	if tripID != nil {
		tripIDVal = sql.NullInt64{Int64: *tripID, Valid: true}
	}
	notesVal := sql.NullString{String: notes, Valid: notes != ""}

	err := tx.QueryRow(
		`INSERT INTO bookings (user_id, trip_id, booking_type, status, total_price, notes)
		 VALUES ($1, $2, $3, 'PENDING', $4, $5) RETURNING id, created_at, updated_at`,
		userID, tripIDVal, bookingType, totalPrice, notesVal,
	).Scan(&id, &createdAt, &updatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create booking: %w", err)
	}

	return &model.Booking{
		ID:          id,
		UserID:      userID,
		TripID:      tripIDVal,
		BookingType: bookingType,
		Status:      "PENDING",
		TotalPrice:  totalPrice,
		Notes:       notesVal,
		CreatedAt:   createdAt,
		UpdatedAt:   updatedAt,
	}, nil
}

func (r *BookingRepository) CreateItem(tx *sql.Tx, bookingID int, item model.BookingItemRequest) error {
	details := item.Details
	if details == nil {
		details = json.RawMessage("{}")
	}
	_, err := tx.Exec(
		`INSERT INTO booking_items (booking_id, item_type, name, description, price, quantity, check_in, check_out, details)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		bookingID, item.ItemType, item.Name, item.Description, item.Price, item.Quantity,
		nullString(item.CheckIn), nullString(item.CheckOut), details,
	)
	return err
}

func (r *BookingRepository) GetByID(id int) (*model.Booking, error) {
	booking := &model.Booking{}
	err := r.db.QueryRow(
		`SELECT id, user_id, trip_id, booking_type, status, total_price, notes, created_at, updated_at
		 FROM bookings WHERE id = $1`, id,
	).Scan(&booking.ID, &booking.UserID, &booking.TripID, &booking.BookingType,
		&booking.Status, &booking.TotalPrice, &booking.Notes, &booking.CreatedAt, &booking.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if booking.Notes.Valid && booking.Notes.String != "" {
		booking.Title = booking.Notes.String
	}
	return booking, err
}

func (r *BookingRepository) GetItemsByBookingID(bookingID int) ([]model.BookingItem, error) {
	rows, err := r.db.Query(
		`SELECT id, booking_id, item_type, name, description, price, quantity, check_in, check_out, details, created_at
		 FROM booking_items WHERE booking_id = $1`, bookingID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.BookingItem
	for rows.Next() {
		var item model.BookingItem
		err := rows.Scan(&item.ID, &item.BookingID, &item.ItemType, &item.Name,
			&item.Description, &item.Price, &item.Quantity, &item.CheckIn, &item.CheckOut,
			&item.Details, &item.CreatedAt)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

func (r *BookingRepository) GetByUserID(userID int64) ([]model.Booking, error) {
	rows, err := r.db.Query(
		`SELECT id, user_id, trip_id, booking_type, status, total_price, notes, created_at, updated_at
		 FROM bookings WHERE user_id = $1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bookings []model.Booking
	for rows.Next() {
		var b model.Booking
		err := rows.Scan(&b.ID, &b.UserID, &b.TripID, &b.BookingType,
			&b.Status, &b.TotalPrice, &b.Notes, &b.CreatedAt, &b.UpdatedAt)
		if err != nil {
			return nil, err
		}
		if b.Notes.Valid && b.Notes.String != "" {
			b.Title = b.Notes.String
		}
		bookings = append(bookings, b)
	}
	return bookings, nil
}

func (r *BookingRepository) UpdateStatus(tx *sql.Tx, bookingID int, fromStatus, toStatus, reason string) error {
	result, err := tx.Exec(
		`UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 AND status = $3`,
		toStatus, bookingID, fromStatus)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("booking %d status transition %s -> %s failed (current status mismatch)", bookingID, fromStatus, toStatus)
	}

	// Record status change
	_, err = tx.Exec(
		`INSERT INTO booking_status (booking_id, from_status, to_status, reason) VALUES ($1, $2, $3, $4)`,
		bookingID, fromStatus, toStatus, reason)
	return err
}

func (r *BookingRepository) UpdateStatusDirect(tx *sql.Tx, bookingID int, toStatus string) error {
	_, err := tx.Exec(`UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2`, toStatus, bookingID)
	return err
}

func (r *BookingRepository) GetByTripID(tripID int) ([]model.Booking, error) {
	rows, err := r.db.Query(
		`SELECT id, user_id, trip_id, booking_type, status, total_price, notes, created_at, updated_at
		 FROM bookings WHERE trip_id = $1 ORDER BY created_at DESC`, tripID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bookings []model.Booking
	for rows.Next() {
		var b model.Booking
		err := rows.Scan(&b.ID, &b.UserID, &b.TripID, &b.BookingType,
			&b.Status, &b.TotalPrice, &b.Notes, &b.CreatedAt, &b.UpdatedAt)
		if err != nil {
			return nil, err
		}
		if b.Notes.Valid && b.Notes.String != "" {
			b.Title = b.Notes.String
		}
		bookings = append(bookings, b)
	}
	return bookings, nil
}

func nullString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: s, Valid: true}
}
