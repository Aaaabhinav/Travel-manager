package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"travel-management/services/booking-service/internal/model"
	"travel-management/services/booking-service/internal/saga"
	"travel-management/services/booking-service/internal/service"
)

type BookingHandler struct {
	bookingService *service.BookingService
	orchestrator   *saga.Orchestrator
}

func NewBookingHandler(bookingService *service.BookingService, orchestrator *saga.Orchestrator) *BookingHandler {
	return &BookingHandler{
		bookingService: bookingService,
		orchestrator:   orchestrator,
	}
}

func (h *BookingHandler) getUserIDFromHeader(c *gin.Context) (int64, bool) {
	userIdStr := c.GetHeader("X-User-Id")
	if userIdStr == "" {
		userIdStr = c.Query("userId")
	}
	if userIdStr == "" {
		// Fallback for direct testing if header not provided
		return 1, true
	}
	uid, err := strconv.ParseInt(userIdStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid X-User-Id header"})
		return 0, false
	}
	return uid, true
}

// CreateBooking handles POST /bookings
func (h *BookingHandler) CreateBooking(c *gin.Context) {
	userID, ok := h.getUserIDFromHeader(c)
	if !ok {
		return
	}

	var req model.CreateBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	simulateFailure := c.GetHeader("X-Simulate-Failure")

	booking, sagaID, err := h.bookingService.CreateBooking(c.Request.Context(), &req, userID, simulateFailure)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Trigger Saga step asynchronously
	go func() {
		_ = h.orchestrator.ProcessSagaStep(c.Request.Context(), sagaID)
	}()

	c.JSON(http.StatusAccepted, gin.H{
		"message":   "Booking process initiated",
		"booking":   booking,
		"saga_id":   sagaID,
		"status":    "PENDING",
	})
}

// GetBookingByID handles GET /bookings/:id
func (h *BookingHandler) GetBookingByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid booking ID"})
		return
	}

	booking, err := h.bookingService.GetBookingByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if booking == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Booking not found"})
		return
	}

	c.JSON(http.StatusOK, booking)
}

// GetBookings handles GET /bookings (supports ?trip_id=... or current user via header/query)
func (h *BookingHandler) GetBookings(c *gin.Context) {
	tripIdStr := c.Query("trip_id")
	if tripIdStr == "" {
		tripIdStr = c.Query("tripId")
	}
	if tripIdStr != "" {
		tripID, err := strconv.Atoi(tripIdStr)
		if err == nil {
			bookings, err := h.bookingService.GetTripBookings(c.Request.Context(), tripID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, bookings)
			return
		}
	}

	userID, _ := h.getUserIDFromHeader(c)
	bookings, err := h.bookingService.GetUserBookings(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, bookings)
}

// GetTripBookings handles GET /trips/:tripId
func (h *BookingHandler) GetTripBookings(c *gin.Context) {
	tripIdStr := c.Param("tripId")
	tripID, err := strconv.Atoi(tripIdStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}

	bookings, err := h.bookingService.GetTripBookings(c.Request.Context(), tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, bookings)
}

// GetUserBookings handles GET /users/:userId/bookings
func (h *BookingHandler) GetUserBookings(c *gin.Context) {
	userIdStr := c.Param("userId")
	userID, err := strconv.ParseInt(userIdStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	bookings, err := h.bookingService.GetUserBookings(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, bookings)
}

// CancelBooking handles PUT /bookings/:id/cancel
func (h *BookingHandler) CancelBooking(c *gin.Context) {
	userID, ok := h.getUserIDFromHeader(c)
	if !ok {
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid booking ID"})
		return
	}

	booking, err := h.bookingService.CancelBooking(c.Request.Context(), id, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Booking cancellation initiated",
		"booking": booking,
	})
}

// CancelTripBookings handles PUT /bookings/trip/:tripId/cancel or PUT /trips/:tripId/cancel-bookings
func (h *BookingHandler) CancelTripBookings(c *gin.Context) {
	tripIdStr := c.Param("tripId")
	tripID, err := strconv.Atoi(tripIdStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid trip ID"})
		return
	}

	err = h.bookingService.CancelTripBookings(c.Request.Context(), tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "All trip bookings cancelled successfully",
		"trip_id": tripID,
	})
}


// GetSagaTimeline handles GET /bookings/:id/saga
func (h *BookingHandler) GetSagaTimeline(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid booking ID"})
		return
	}

	timeline, err := h.bookingService.GetSagaTimeline(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, timeline)
}

// RetrySaga handles POST /admin/sagas/:id/retry
func (h *BookingHandler) RetrySaga(c *gin.Context) {
	sagaID := c.Param("id")
	err := h.bookingService.RetrySaga(c.Request.Context(), sagaID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	go func() {
		_ = h.orchestrator.ProcessSagaStep(c.Request.Context(), sagaID)
	}()

	c.JSON(http.StatusOK, gin.H{
		"message": "Saga retry initiated",
		"saga_id": sagaID,
	})
}

// HealthCheck handles GET /health
func (h *BookingHandler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "UP",
		"service":   "booking-service",
		"timestamp": strconv.FormatInt(c.Request.Context().Value("ts").(int64), 10),
	})
}
