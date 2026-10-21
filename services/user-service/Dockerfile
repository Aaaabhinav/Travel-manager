FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests -B

FROM eclipse-temurin:17-jre-alpine
RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup
WORKDIR /app
COPY --from=builder /app/target/user-service-1.0.0.jar app.jar
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
