FROM golang:1.21-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY . .
RUN rm -f go.sum && go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -o booking-service ./cmd/main.go

FROM alpine:3.19

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app
COPY --from=builder /app/booking-service .

USER appuser

EXPOSE 8083

CMD ["./booking-service"]
