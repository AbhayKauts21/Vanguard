# CLEO Observability - Complete Telemetry Data Flow

## Overview

This document verifies the complete end-to-end data flow of telemetry data (traces, metrics, logs) from applications through OTEL Collector to Grafana Stack.

---

## ✅ Complete Data Flow Architecture

```
Frontend (Browser)        Backend (FastAPI)
     │                         │
     │ Traces                  │ Traces, Metrics, Logs
     │ (OTLP/HTTP)             │ (OTLP/gRPC)
     │                         │
     └────────┬────────────────┘
              │
              ▼
   ┌──────────────────────────┐
   │  OTEL COLLECTOR          │
   │  Port 4317 (gRPC)        │
   │  Port 4318 (HTTP)        │
   └──────────────────────────┘
              │
      ┌───────┼───────┐
      │       │       │
      ▼       ▼       ▼
   Traces  Metrics  Logs
   (Tempo) (Prom)  (Loki)
      │       │       │
      └───────┼───────┘
              │
              ▼
        ┌──────────┐
        │ GRAFANA  │
        │ Port 3200│
        └──────────┘
```

---

## 1️⃣ Frontend → OTEL Collector

### Configuration Location
- **File**: `frontend/src/lib/instrumentation.ts`
- **Initialization**: `frontend/src/lib/telemetry-provider.tsx`
- **Provider**: `frontend/src/app/providers.tsx`

### Data Sent
✅ **Traces Only** (via OTLP/HTTP)

### Endpoint Configuration
```typescript
// Environment variable
NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces

// Code (instrumentation.ts)
const otlpExporter = new OTLPTraceExporter({
  url: OTEL_EXPORTER_OTLP_ENDPOINT, // http://localhost:4318/v1/traces
});
```

### What Gets Instrumented
- ✅ Fetch API requests (to backend)
- ✅ XMLHttpRequest
- ✅ User interactions (clicks, etc.)
- ✅ Document load events
- ✅ Custom spans via `useTelemetry()` hook

### Propagation
- ✅ **B3 Multi-Header** (for backend compatibility)
- ✅ **W3C Trace Context** (standard)

### Verification
```bash
# Check frontend is sending traces
docker logs cleo-frontend-1 2>&1 | grep OTEL
# Should see: "[OTEL] Initializing OpenTelemetry Web SDK"
# Should see: "[OTEL] Export endpoint: http://localhost:4318/v1/traces"
```

---

## 2️⃣ Backend → OTEL Collector

### Configuration Location
- **File**: `backend/app/core/telemetry.py`
- **Middleware**: `backend/app/core/telemetry_middleware.py`
- **Logging**: `backend/app/core/structured_logging.py`
- **Initialization**: `backend/main.py` (lines 50-60)

### Data Sent
✅ **Traces** (via OTLP/gRPC)
✅ **Metrics** (via OTLP/gRPC)
✅ **Logs** (via structured JSON with trace correlation)

### Endpoint Configuration
```python
# Environment variable (docker-compose.observability.yml)
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317

# Code (telemetry.py)
otlp_exporter = OTLPSpanExporter(
    endpoint=config.otlp_endpoint,  # http://otel-collector:4317
    insecure=True
)
```

### What Gets Instrumented
- ✅ **FastAPI** - all HTTP requests/responses
- ✅ **HTTPX** - outbound HTTP calls (Azure OpenAI, Pinecone, BookStack)
- ✅ **SQLAlchemy** - database queries
- ✅ **Logging** - all logs include trace_id and span_id

### Custom Attributes Added
Via `TelemetryMiddleware`:
- ✅ `request_id` - unique request identifier
- ✅ `user_id` - extracted from JWT token
- ✅ `http.route` - FastAPI route template
- ✅ `http.status_code` - response status
- ✅ `http.method` - HTTP method

### Propagation
- ✅ **B3 Multi-Header** (reads from frontend)

### Verification
```bash
# Check backend is sending telemetry
docker logs <backend-container-id> 2>&1 | grep OTEL
# Should see: "[OTEL] Initializing OpenTelemetry for cleo-backend"
# Should see: "[OTEL] Export endpoint: http://otel-collector:4317"
# Should see: "[OTEL] Observability initialized"
```

---

## 3️⃣ OTEL Collector → Grafana Stack

### Configuration Location
- **File**: `observability/otel-collector-config.yaml`
- **Docker Compose**: `docker-compose.observability.yml`

### Receivers (Input)

#### OTLP Receiver
```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317  # ← Backend sends here
      http:
        endpoint: 0.0.0.0:4318  # ← Frontend sends here
```

✅ Accepts: **Traces, Metrics, Logs**
✅ Protocols: **gRPC (port 4317), HTTP (port 4318)**
✅ CORS: Enabled for `http://localhost:3000`

#### Prometheus Receiver
```yaml
  prometheus:
    config:
      scrape_configs:
        - job_name: 'otel-collector'
          scrape_interval: 30s
          static_configs:
            - targets: ['localhost:8888']  # Collector's own metrics
```

✅ Accepts: **Metrics** (from collector itself)

---

### Processors (Transform)

✅ **Memory Limiter** - prevents OOM (512MB limit)
✅ **Batch Processor** - batches telemetry for efficiency (10s timeout, 1024 batch size)
✅ **Resource Detection** - adds env, system, docker metadata
✅ **Resource Processor** - adds deployment.environment, service.namespace
✅ **Attributes Processor** - adds custom attributes

---

### Exporters (Output)

#### 1. Tempo (Traces)
```yaml
exporters:
  otlp/tempo:
    endpoint: tempo:4317
    tls:
      insecure: true
```

✅ **Protocol**: OTLP/gRPC
✅ **Endpoint**: `tempo:4317`
✅ **Data**: All traces from frontend + backend
✅ **Storage**: In-memory (configurable to persistent)

#### 2. Loki (Logs)
```yaml
  loki:
    endpoint: http://loki:3100/loki/api/v1/push
    labels:
      resource:
        service.name: "service_name"
        service.namespace: "service_namespace"
```

✅ **Protocol**: HTTP
✅ **Endpoint**: `loki:3100`
✅ **Data**: All logs with trace correlation
✅ **Labels**: service.name, service.namespace, deployment.environment, level, logger
✅ **Retention**: 7 days

#### 3. Prometheus (Metrics)
```yaml
  prometheus:
    endpoint: "0.0.0.0:8889"
    namespace: cleo
    
  prometheusremotewrite:
    endpoint: http://prometheus:9090/api/v1/write
```

✅ **Protocol**: HTTP (scrape endpoint + remote write)
✅ **Scrape Endpoint**: `:8889` (Prometheus scrapes this)
✅ **Remote Write**: `prometheus:9090/api/v1/write`
✅ **Data**: All metrics from backend + collector
✅ **Retention**: 15 days

---

### Pipelines

#### Traces Pipeline
```yaml
pipelines:
  traces:
    receivers: [otlp]
    processors: [memory_limiter, batch, resourcedetection, resource, attributes]
    exporters: [otlp/tempo, logging]
```

✅ **Flow**: OTLP Receiver → Process → Tempo + Debug Logs

#### Metrics Pipeline
```yaml
  metrics:
    receivers: [otlp, prometheus]
    processors: [memory_limiter, batch, resourcedetection, resource]
    exporters: [prometheus, prometheusremotewrite]
```

✅ **Flow**: OTLP + Prometheus Receiver → Process → Prometheus (scrape + remote write)

#### Logs Pipeline
```yaml
  logs:
    receivers: [otlp]
    processors: [memory_limiter, batch, resourcedetection, resource]
    exporters: [loki, logging]
```

✅ **Flow**: OTLP Receiver → Process → Loki + Debug Logs

---

## 4️⃣ Grafana Datasources

### Configuration Location
- **File**: `observability/grafana/provisioning/datasources/datasources.yaml`

### Configured Datasources

#### Tempo (Tracing)
```yaml
- name: Tempo
  type: tempo
  url: http://tempo:3200
  jsonData:
    tracesToLogsV2:
      datasourceUid: loki
      filterByTraceID: true
```

✅ **URL**: `http://tempo:3200`
✅ **Trace → Logs**: Enabled (via trace_id)
✅ **Service Graph**: Enabled

#### Loki (Logs)
```yaml
- name: Loki
  type: loki
  url: http://loki:3100
  jsonData:
    derivedFields:
      - name: TraceID
        matcherRegex: "trace_id=(\\w+)"
        url: "$${__value.raw}"
        datasourceUid: tempo
```

✅ **URL**: `http://loki:3100`
✅ **Logs → Traces**: Enabled (via trace_id extraction)
✅ **Retention**: 7 days

#### Prometheus (Metrics)
```yaml
- name: Prometheus
  type: prometheus
  url: http://prometheus:9090
```

✅ **URL**: `http://prometheus:9090`
✅ **Scrape Interval**: 15s
✅ **Retention**: 15 days

---

## 5️⃣ Verification Commands

### Check OTEL Collector is Receiving Data

```bash
# View OTEL Collector logs
docker logs cleo-otel-collector -f

# Should see traces being received:
# "Traces" -> "exporters" -> "otlp/tempo"
# "Logs" -> "exporters" -> "loki"
# "Metrics" -> "exporters" -> "prometheus"
```

### Check Tempo has Traces

```bash
# Query Tempo API
curl http://localhost:3200/api/search | jq .

# Should return traces with service.name="cleo-frontend" or "cleo-backend"
```

### Check Loki has Logs

```bash
# Query Loki API
curl -G http://localhost:3100/loki/api/v1/query \
  --data-urlencode 'query={service_name="cleo-backend"}' \
  --data-urlencode 'limit=10' | jq .

# Should return logs with trace_id and span_id
```

### Check Prometheus has Metrics

```bash
# Query Prometheus API
curl http://localhost:9090/api/v1/query?query=up | jq .

# Check backend metrics
curl "http://localhost:9090/api/v1/query?query=http_server_request_duration_seconds_count" | jq .
```

---

## 6️⃣ Grafana Dashboards

### Access Grafana
- **URL**: http://localhost:3200
- **Credentials**: admin / admin
- **Change password on first login**

### Pre-configured Dashboards

#### 1. Overview Dashboard
- **Location**: `observability/grafana/dashboards/overview.json`
- **Shows**: Service health, request rates, error rates, latency

#### 2. API Performance Dashboard
- **Location**: `observability/grafana/dashboards/api-performance.json`
- **Shows**: Endpoint latency, throughput, error rates, slow queries

#### 3. Traces Dashboard
- **Location**: `observability/grafana/dashboards/traces.json`
- **Shows**: Trace search, duration distribution, service dependencies

#### 4. Logs Dashboard
- **Location**: `observability/grafana/dashboards/logs.json`
- **Shows**: Logs with trace correlation, error logs, log levels

---

## 7️⃣ Complete Test Scenario

### Generate Test Traffic

```bash
# 1. Start the stack
docker-compose -f docker-compose.observability.yml up -d

# 2. Wait for services to be healthy (30s)
sleep 30

# 3. Make a test request to backend
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello CLEO",
    "user_id": "test-user"
  }'

# 4. Make a request from frontend
# Open browser: http://localhost:3000
# Interact with the UI (send a chat message)
```

### Verify in Grafana

```bash
# 1. Open Grafana
open http://localhost:3200

# 2. Go to Explore → Tempo
#    - Search for traces with service.name="cleo-frontend"
#    - Click on a trace to see spans
#    - You should see:
#      * Frontend span (fetch request)
#      * Backend span (HTTP handler)
#      * Database span (SQLAlchemy query)

# 3. Go to Explore → Loki
#    - Query: {service_name="cleo-backend"}
#    - You should see logs with trace_id
#    - Click "Tempo" button next to trace_id to jump to trace

# 4. Go to Explore → Prometheus
#    - Query: rate(http_server_request_duration_seconds_count[5m])
#    - You should see request rate metrics

# 5. Open Dashboard → Overview
#    - You should see service health, request rates, error rates
```

---

## 8️⃣ Trace Context Propagation

### How Trace Context Flows

1. **User clicks button in Frontend**
   - Browser creates a new trace with `trace_id=abc123`
   - Span created: `frontend-click-handler`

2. **Frontend makes fetch() to Backend**
   - B3 headers injected into request:
     ```
     X-B3-TraceId: abc123
     X-B3-SpanId: def456
     X-B3-Sampled: 1
     ```

3. **Backend receives request**
   - B3 propagator extracts trace context from headers
   - Creates child span with same `trace_id=abc123`
   - Span created: `POST /api/v1/chat`

4. **Backend calls database**
   - Creates child span: `SELECT * FROM users`
   - Same `trace_id=abc123`

5. **All spans sent to OTEL Collector**
   - OTEL Collector batches and sends to Tempo
   - Tempo stores all spans under same `trace_id`

6. **Logs include trace context**
   - All backend logs include:
     ```json
     {
       "level": "info",
       "message": "Processing chat request",
       "trace_id": "abc123",
       "span_id": "def456"
     }
     ```

7. **View complete trace in Grafana**
   - Tempo shows full trace: Frontend → Backend → Database
   - Click trace_id in Loki logs → Jump to Tempo trace
   - See complete distributed transaction

---

## 9️⃣ Troubleshooting

### No Traces in Grafana

```bash
# 1. Check OTEL Collector is running
docker ps | grep otel-collector

# 2. Check OTEL Collector logs for errors
docker logs cleo-otel-collector 2>&1 | grep -i error

# 3. Check Tempo is receiving traces
docker logs cleo-tempo 2>&1 | grep -i received

# 4. Verify backend is sending traces
docker logs <backend-container> 2>&1 | grep "OTEL"
# Should see: "[OTEL] Observability initialized"

# 5. Check network connectivity
docker exec <backend-container> nc -zv otel-collector 4317
# Should see: "Connection to otel-collector 4317 port [tcp/*] succeeded!"
```

### No Logs in Loki

```bash
# 1. Check Loki is running
docker ps | grep loki

# 2. Check OTEL Collector is exporting to Loki
docker logs cleo-otel-collector 2>&1 | grep loki

# 3. Query Loki directly
curl -G http://localhost:3100/loki/api/v1/labels | jq .
# Should return labels like service_name, level, etc.

# 4. Check backend logs are JSON formatted
docker logs <backend-container> 2>&1 | head -1 | jq .
# Should parse as valid JSON with trace_id
```

### No Metrics in Prometheus

```bash
# 1. Check Prometheus is scraping OTEL Collector
curl http://localhost:9090/api/v1/targets | jq .
# Look for "otel-collector" target with state="up"

# 2. Check OTEL Collector metrics endpoint
curl http://localhost:8889/metrics
# Should return Prometheus-formatted metrics

# 3. Verify remote write is working
docker logs cleo-prometheus 2>&1 | grep -i "remote write"
```

---

## 🎯 Summary

✅ **Frontend → OTEL Collector**: Traces via OTLP/HTTP (port 4318)
✅ **Backend → OTEL Collector**: Traces, Metrics, Logs via OTLP/gRPC (port 4317)
✅ **OTEL Collector → Tempo**: Traces via OTLP/gRPC (port 4317)
✅ **OTEL Collector → Loki**: Logs via HTTP (port 3100)
✅ **OTEL Collector → Prometheus**: Metrics via scrape (port 8889) + remote write (port 9090)
✅ **Grafana**: Visualizes all data from Tempo, Loki, Prometheus
✅ **Trace Propagation**: B3 multi-header format ensures trace continuity
✅ **Log Correlation**: All logs include trace_id and span_id
✅ **Dashboards**: 4 pre-configured dashboards for monitoring

**The complete observability pipeline is configured and ready to use!**
