FROM alpine:3.19 AS builder

RUN apk add --no-cache \
    g++ \
    cmake \
    make \
    hiredis-dev \
    nlohmann-json \
    curl \
    linux-headers

WORKDIR /app

COPY . .

# Download httplib.h single header
RUN mkdir -p /app/src && curl -sSL https://raw.githubusercontent.com/yhirose/cpp-httplib/v0.14.3/httplib.h -o /app/src/httplib.h

RUN mkdir -p build && cd build && \
    cmake .. && \
    make -j$(nproc)

FROM alpine:3.19

RUN apk add --no-cache hiredis libstdc++ libgcc curl

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app
COPY --from=builder /app/build/route-service .

USER appuser

EXPOSE 8085

CMD ["./route-service"]
