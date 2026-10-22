package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"travel-management/services/booking-service/internal/model"
	"travel-management/services/booking-service/internal/repository"
)

type BookingService struct {
	bookingRepo *repository.BookingRepository
	sagaRepo    *repository.SagaRepository
	outboxRepo  *repository.OutboxRepository
	tripServiceURL string
}

func NewBookingService(
	bookingRepo *repository.BookingRepository,
	sagaRepo *repository.SagaRepository,
	outboxRepo *repository.OutboxRepository,
	tripServiceURL string,
) *BookingService {
	return &BookingService{
		bookingRepo:    bookingRepo,
		sagaRepo:       sagaRepo,
		outboxRepo:     outboxRepo,
		tripServiceURL: tripServiceURL,
	}
}

// ValidateTripWithTripService makes a REST call to Trip Service to ensure the trip exists
func (s *BookingService) ValidateTripWithTripService(ctx context.Context, tripID int64, userID int64) error {
	url := fmt.Sprintf("%s/trips/%d", s.tripServiceURL, tripID)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("X-User-Id", fmt.Sprintf("%d", userID))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to contact trip service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return fmt.Errorf("trip %d not found", tripID)
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("trip service returned status %d", resp.StatusCode)
	}
	return nil
}

func (s *BookingService) CreateBooking(ctx context.Context, req *model.CreateBookingRequest, userID int64, simulateFailure string) (*model.Booking, string, error) {
	// If tripId provided, validate via REST
	if req.TripID != nil && *req.TripID > 0 {
		if err := s.ValidateTripWithTripService(ctx, *req.TripID, userID); err != nil {
			return nil, "", fmt.Errorf("trip validation failed: %w", err)
		}
	}

	booking, saga, err := s.bookingRepo.CreateBookingWithSaga(ctx, req, userID, simulateFailure)
	if err != nil {
		return nil, "", err
	}

	return booking, saga.ID, nil
}

func (s *BookingService) GetBookingByID(ctx context.Context, id int64) (*model.Booking, error) {
	return s.bookingRepo.GetByID(int(id))
}

func (s *BookingService) GetUserBookings(ctx context.Context, userID int64) ([]model.Booking, error) {
	return s.bookingRepo.GetByUserID(userID)
}

func (s *BookingService) GetTripBookings(ctx context.Context, tripID int) ([]model.Booking, error) {
	return s.bookingRepo.GetByTripID(tripID)
}

func (s *BookingService) CancelBooking(ctx context.Context, id int64, userID int64) (*model.Booking, error) {
	booking, err := s.bookingRepo.GetByID(int(id))
	if err != nil {
		return nil, err
	}
	if booking == nil {
		return nil, fmt.Errorf("booking not found")
	}
	if booking.UserID != userID && userID != 0 {
		return nil, fmt.Errorf("unauthorized to cancel this booking")
	}

	if booking.Status == "CANCELLED" || booking.Status == "FAILED" {
		return booking, nil
	}

	_ = s.bookingRepo.UpdateBookingStatus(int(id), "CANCELLING")

	// Mark status as CANCELLED
	_ = s.bookingRepo.UpdateBookingStatus(int(id), "CANCELLED")
	booking.Status = "CANCELLED"

	// Refund any payment record
	_ = s.bookingRepo.RefundPayment(int(id))

	// Find saga instance and record compensation/cancellation steps
	sagaInstance, _ := s.sagaRepo.GetByBookingID(int(id))
	sagaID := ""
	if sagaInstance != nil {
		sagaID = sagaInstance.ID
		_ = s.sagaRepo.RecordSagaStep(sagaID, "CANCEL_RESERVATION", "SUCCEEDED", 1, "Reservation slot released")
		_ = s.sagaRepo.RecordSagaStep(sagaID, "REFUND_PAYMENT", "SUCCEEDED", 1, "Payment refunded")
		_ = s.sagaRepo.SetSagaStatus(sagaID, "CANCELLED", "CANCELLED")
	}

	// Create cancellation saga event in outbox for trip-service to release the slot
	var tripIDInt int64
	if booking.TripID.Valid {
		tripIDInt = booking.TripID.Int64
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"booking_id": id,
		"bookingId":  id,
		"trip_id":    tripIDInt,
		"tripId":     tripIDInt,
		"user_id":    booking.UserID,
		"userId":     booking.UserID,
		"status":     "CANCELLED",
	})
	_ = s.outboxRepo.CreateEvent("BookingCancelled", payload, sagaID)

	return booking, nil
}

func (s *BookingService) CancelTripBookings(ctx context.Context, tripID int) error {
	bookings, err := s.bookingRepo.GetByTripID(tripID)
	if err != nil {
		return err
	}
	for _, b := range bookings {
		if b.Status != "CANCELLED" && b.Status != "FAILED" {
			_, _ = s.CancelBooking(ctx, int64(b.ID), b.UserID)
		}
	}
	return nil
}

func (s *BookingService) GetSagaTimeline(ctx context.Context, bookingID int64) (*model.SagaStatusResponse, error) {
	saga, steps, err := s.sagaRepo.GetSagaWithStepsByBookingID(int(bookingID))
	if err != nil {
		return nil, err
	}
	if saga == nil {
		return nil, fmt.Errorf("saga not found for booking %d", bookingID)
	}

	var currentStep string
	if saga.CurrentStep.Valid {
		currentStep = saga.CurrentStep.String
	}
	var stepResponses []model.SagaStepResponse
	for _, st := range steps {
		stepResponses = append(stepResponses, model.SagaStepResponse{
			StepName: st.StepName,
			Status: st.Status,
			Attempt: st.Attempt,
			Error: st.Error.String,
		})
	}

	return &model.SagaStatusResponse{
		SagaID:      saga.ID,
		BookingID:   saga.BookingID,
		Type:        saga.Type,
		Status:      saga.Status,
		CurrentStep: currentStep,
		RetryCount:  saga.RetryCount,
		CreatedAt:   saga.CreatedAt,
		UpdatedAt:   saga.UpdatedAt,
		Steps:       stepResponses,
	}, nil
}

func (s *BookingService) RetrySaga(ctx context.Context, sagaID string) error {
	return s.sagaRepo.ResetForRetry(sagaID)
}
