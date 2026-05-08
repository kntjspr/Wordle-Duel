FROM golang:1.22-alpine AS builder
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /wordlewars-server .

FROM alpine:3.20
WORKDIR /app
RUN adduser -D -H -u 10001 appuser

COPY --from=builder /wordlewars-server /usr/local/bin/wordlewars-server

ENV PORT=8080
EXPOSE 8080
USER appuser

ENTRYPOINT ["/usr/local/bin/wordlewars-server"]
