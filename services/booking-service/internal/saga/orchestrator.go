package saga

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"travel-management/services/booking-service/internal/model"
	"travel-management/services/booking-service/internal/repository"
)

type Publisher interface {
	PublishEvent(exchange, routingKey string, event *model.Event) error
}

type Orchestrator struct {
	sagaRepo    *repository.SagaRepository
	bookingRepo *repository.BookingRepository
	outboxRepo  *repository.OutboxRepository
	publisher   Publisher
}

func NewOrchestrator(
	sagaRepo *repository.SagaRepository,
	bookingRepo *repository.BookingRepository,
	outboxRepo *repository.OutboxRepository,
	publisher Publisher,
) *Orchestrator {
	return &Orchestrator{
		sagaRepo:    sagaRepo,
		bookingRepo: bookingRepo,
		outboxRepo:  outboxRepo,
		publisher:   publisher,
	}
}

// ProcessSagaStep advances a saga state machine
func (o *Orchestrator) ProcessSagaStep(ctx context.Context, sagaID string) error {
	saga, err := o.sagaRepo.GetByID(sagaID)
	if err != nil || saga == nil {
		return fmt.Errorf("saga not found: %s", sagaID)
	}

	if saga.Status == "COMPLETED" || saga.Status == "COMPENSATED" || saga.Status == "COMPENSATION_FAILED" {
		return nil
	}

	var payload map[string]interface{}
	_ = json.Unmarshal([]byte(saga.Payload), &payload)

	simulatedFailure := ""
	if sf, ok := payload["simulate_failure"].(string); ok {
		simulatedFailure = sf
	}

	booking, err := o.bookingRepo.GetByID(saga.BookingID)
	if err != nil || booking == nil {
		return fmt.Errorf("booking not found for saga: %s", sagaID)
	}

	switch saga.Status {
	case "STARTED":
		// Step 1: Send ReserveTripSlot command if tripId exists
		if booking.TripID.Valid && booking.TripID.Int64 > 0 {
			if simulatedFailure == "trip-reservation" {
				// Reject immediately
				log.Printf("[Saga %s] Simulated trip-reservation failure", sagaID)
				_ = o.sagaRepo.RecordSagaStep(sagaID, "RESERVE_TRIP_SLOT", "FAILED", 1, "Simulated reservation failure")
				_ = o.sagaRepo.SetSagaStatus(sagaID, "COMPENSATING", "RESERVE_TRIP_SLOT")
				return o.ProcessSagaStep(ctx, sagaID)
			}

			// Record step as PENDING
			_ = o.sagaRepo.RecordSagaStep(sagaID, "RESERVE_TRIP_SLOT", "PENDING", 1, "")

			// Create command event in outbox
			cmdPayload, _ := json.Marshal(map[string]interface{}{
				"saga_id":    sagaID,
				"booking_id": booking.ID,
				"trip_id":    booking.TripID.Int64,
				"user_id":    booking.UserID,
				"start_date": booking.CreatedAt.Format(time.RFC3339),
				"end_date":   booking.CreatedAt.AddDate(0, 0, 7).Format(time.RFC3339),
			})

			cmdEnvelope := &model.Event{
				EventID:    fmt.Sprintf("cmd-%d", time.Now().UnixNano()),
				EventType:  "ReserveTripSlot",
				OccurredAt: time.Now().Format(time.RFC3339),
				Source:     "booking-service",
				SagaID:     sagaID,
				Payload:    cmdPayload,
			}
			data, _ := json.Marshal(cmdEnvelope)
			_ = o.outboxRepo.CreateEvent("ReserveTripSlot", data, sagaID)
		} else {
			// No trip ID attached, jump to Payment
			_ = o.sagaRepo.SetSagaStatus(sagaID, "STARTED", "PAYMENT")
			return o.ProcessPaymentStep(ctx, saga, booking, simulatedFailure)
		}

	case "COMPENSATING":
		// Release trip slot if reserved
		if booking.TripID.Valid && booking.TripID.Int64 > 0 {
			_ = o.sagaRepo.RecordSagaStep(sagaID, "RELEASE_TRIP_SLOT", "PENDING", 1, "")

			cmdPayload, _ := json.Marshal(map[string]interface{}{
				"saga_id":    sagaID,
				"booking_id": booking.ID,
				"trip_id":    booking.TripID.Int64,
			})
			cmdEnvelope := &model.Event{
				EventID:    fmt.Sprintf("cmd-rel-%d", time.Now().UnixNano()),
				EventType:  "ReleaseTripSlot",
				OccurredAt: time.Now().Format(time.RFC3339),
				Source:     "booking-service",
				SagaID:     sagaID,
				Payload:    cmdPayload,
			}
			data, _ := json.Marshal(cmdEnvelope)
			_ = o.outboxRepo.CreateEvent("ReleaseTripSlot", data, sagaID)
		} else {
			// Complete compensation directly
			o.FinishCompensation(ctx, sagaID, booking.ID)
		}
	}

	return nil
}

// HandleTripSlotReply handles TripSlotReserved or TripSlotRejected reply events
func (o *Orchestrator) HandleTripSlotReply(ctx context.Context, sagaID string, eventType string, errMessage string) error {
	saga, err := o.sagaRepo.GetByID(sagaID)
	if err != nil || saga == nil {
		return nil
	}

	booking, _ := o.bookingRepo.GetByID(saga.BookingID)
	if booking == nil {
		return nil
	}

	var payload map[string]interface{}
	_ = json.Unmarshal([]byte(saga.Payload), &payload)

	simulatedFailure := ""
	if sf, ok := payload["simulate_failure"].(string); ok {
		simulatedFailure = sf
	}

	if eventType == "TripSlotReserved" || eventType == "saga.booking.reply.trip-slot-reserved" {
		_ = o.sagaRepo.RecordSagaStep(sagaID, "RESERVE_TRIP_SLOT", "SUCCEEDED", 1, "")
		_ = o.sagaRepo.SetSagaStatus(sagaID, "STARTED", "PAYMENT")
		return o.ProcessPaymentStep(ctx, saga, booking, simulatedFailure)
	} else if eventType == "TripSlotRejected" || eventType == "saga.booking.reply.trip-slot-rejected" {
		_ = o.sagaRepo.RecordSagaStep(sagaID, "RESERVE_TRIP_SLOT", "FAILED", 1, errMessage)
		_ = o.sagaRepo.SetSagaStatus(sagaID, "COMPENSATING", "RELEASE_TRIP_SLOT")
		return o.ProcessSagaStep(ctx, sagaID)
	} else if eventType == "TripSlotReleased" || eventType == "saga.booking.reply.trip-slot-released" {
		_ = o.sagaRepo.RecordSagaStep(sagaID, "RELEASE_TRIP_SLOT", "COMPENSATED", 1, "")
		return o.FinishCompensation(ctx, sagaID, booking.ID)
	}

	return nil
}

func (o *Orchestrator) ProcessPaymentStep(ctx context.Context, saga *model.SagaInstance, booking *model.Booking, simulatedFailure string) error {
	_ = o.sagaRepo.RecordSagaStep(saga.ID, "PAYMENT", "PENDING", 1, "")

	// Check simulated failure or payment logic
	if simulatedFailure == "payment" {
		log.Printf("[Saga %s] Simulated payment failure!", saga.ID)
		_ = o.sagaRepo.RecordSagaStep(saga.ID, "PAYMENT", "FAILED", 1, "Payment processing failed (simulated)")
		_ = o.bookingRepo.CreatePayment(booking.ID, booking.TotalPrice, "FAILED", "simulated_card")
		_ = o.sagaRepo.SetSagaStatus(saga.ID, "COMPENSATING", "RELEASE_TRIP_SLOT")
		return o.ProcessSagaStep(ctx, saga.ID)
	}

	// Successful payment
	_ = o.sagaRepo.RecordSagaStep(saga.ID, "PAYMENT", "SUCCEEDED", 1, "")
	_ = o.bookingRepo.CreatePayment(booking.ID, booking.TotalPrice, "SUCCESS", "credit_card")

	// Final step: Confirm booking
	_ = o.bookingRepo.UpdateBookingStatus(booking.ID, "CONFIRMED")
	_ = o.sagaRepo.SetSagaStatus(saga.ID, "COMPLETED", "CONFIRM_BOOKING")
	_ = o.sagaRepo.RecordSagaStep(saga.ID, "CONFIRM_BOOKING", "SUCCEEDED", 1, "")

	// Publish BookingConfirmed event to outbox
	eventPayload, _ := json.Marshal(map[string]interface{}{
		"booking_id":  booking.ID,
		"user_id":     booking.UserID,
		"trip_id":     booking.TripID,
		"total_price": booking.TotalPrice,
		"status":      "CONFIRMED",
	})
	_ = o.outboxRepo.CreateEvent("BookingConfirmed", eventPayload, saga.ID)
	return nil
}

func (o *Orchestrator) FinishCompensation(ctx context.Context, sagaID string, bookingID int) error {
	_ = o.bookingRepo.UpdateBookingStatus(bookingID, "FAILED")
	_ = o.sagaRepo.SetSagaStatus(sagaID, "COMPENSATED", "COMPENSATION_COMPLETE")

	eventPayload, _ := json.Marshal(map[string]interface{}{
		"booking_id": bookingID,
		"saga_id":    sagaID,
		"status":     "FAILED",
		"reason":     "Saga compensation completed",
	})
	_ = o.outboxRepo.CreateEvent("BookingFailed", eventPayload, sagaID)
	return nil
}

func (o *Orchestrator) CancelTripBookings(ctx context.Context, tripID int) error {
	bookings, err := o.bookingRepo.GetByTripID(tripID)
	if err != nil {
		return err
	}
	for _, b := range bookings {
		if b.Status != "CANCELLED" && b.Status != "FAILED" {
			_ = o.bookingRepo.UpdateBookingStatus(b.ID, "CANCELLED")
			_ = o.bookingRepo.RefundPayment(b.ID)
			saga, _ := o.sagaRepo.GetByBookingID(b.ID)
			if saga != nil {
				_ = o.sagaRepo.RecordSagaStep(saga.ID, "CANCEL_RESERVATION", "SUCCEEDED", 1, "Trip cancelled")
				_ = o.sagaRepo.RecordSagaStep(saga.ID, "REFUND_PAYMENT", "SUCCEEDED", 1, "Payment refunded")
				_ = o.sagaRepo.SetSagaStatus(saga.ID, "CANCELLED", "CANCELLED")
			}
		}
	}
	return nil
}

