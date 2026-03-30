"""
OpenTelemetry Instrumentation for FastAPI Backend

This module initializes OpenTelemetry for the FastAPI backend, enabling:
- Distributed tracing across services
- Automatic instrumentation of HTTP requests, database calls, and external APIs
- Structured logging with trace correlation
- Metrics collection (request count, latency, errors)
- B3 propagation for trace context
"""

import logging
from typing import Optional

from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION, DEPLOYMENT_ENVIRONMENT
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
from opentelemetry._logs import set_logger_provider
from opentelemetry.propagate import set_global_textmap
from opentelemetry.propagators.b3 import B3MultiFormat
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.trace import Status, StatusCode

logger = logging.getLogger(__name__)


class OpenTelemetryConfig:
    """Configuration for OpenTelemetry initialization"""
    
    def __init__(
        self,
        service_name: str = "cleo-backend",
        service_version: str = "1.0.0",
        environment: str = "development",
        otlp_endpoint: str = "http://localhost:4317",
        enable_console_exporter: bool = False,
    ):
        self.service_name = service_name
        self.service_version = service_version
        self.environment = environment
        self.otlp_endpoint = otlp_endpoint
        self.enable_console_exporter = enable_console_exporter


def initialize_opentelemetry(config: OpenTelemetryConfig) -> None:
    """
    Initialize OpenTelemetry with tracing and metrics.
    
    Args:
        config: OpenTelemetry configuration
    """
    logger.info(f"[OTEL] Initializing OpenTelemetry for {config.service_name}")
    logger.info(f"[OTEL] Export endpoint: {config.otlp_endpoint}")
    
    # Define resource attributes
    resource = Resource.create({
        SERVICE_NAME: config.service_name,
        SERVICE_VERSION: config.service_version,
        DEPLOYMENT_ENVIRONMENT: config.environment,
        "service.namespace": "cleo",
    })
    
    # Initialize tracing
    _setup_tracing(resource, config)
    
    # Initialize metrics
    _setup_metrics(resource, config)

    # Initialize logs
    _setup_logging(resource, config)
    
    # Set B3 propagator for cross-service trace context
    set_global_textmap(B3MultiFormat())
    
    # Instrument logging to include trace context
    LoggingInstrumentor().instrument(
        set_logging_format=True,
        log_level=logging.INFO,
    )
    
    logger.info("[OTEL] Initialization complete")


def _setup_tracing(resource: Resource, config: OpenTelemetryConfig) -> None:
    """Configure tracing with OTLP exporter"""
    
    # Create tracer provider
    tracer_provider = TracerProvider(resource=resource)
    
    # Configure OTLP exporter for traces
    otlp_exporter = OTLPSpanExporter(
        endpoint=config.otlp_endpoint,
        insecure=True,  # Use insecure for local development
    )
    
    # Add batch processor for efficient export
    tracer_provider.add_span_processor(
        BatchSpanProcessor(
            otlp_exporter,
            max_queue_size=2048,
            max_export_batch_size=512,
            schedule_delay_millis=5000,
        )
    )
    
    # Optional: Add console exporter for debugging
    if config.enable_console_exporter:
        from opentelemetry.sdk.trace.export import ConsoleSpanExporter
        tracer_provider.add_span_processor(
            BatchSpanProcessor(ConsoleSpanExporter())
        )
    
    # Set global tracer provider
    trace.set_tracer_provider(tracer_provider)
    logger.info("[OTEL] Tracing configured")


def _setup_metrics(resource: Resource, config: OpenTelemetryConfig) -> None:
    """Configure metrics with OTLP exporter"""
    
    # Configure OTLP exporter for metrics
    otlp_metric_exporter = OTLPMetricExporter(
        endpoint=config.otlp_endpoint,
        insecure=True,
    )
    
    # Create metric reader with periodic export
    metric_reader = PeriodicExportingMetricReader(
        otlp_metric_exporter,
        export_interval_millis=15000,  # Export every 15s to match Prometheus scrape interval
    )
    
    # Create meter provider
    meter_provider = MeterProvider(
        resource=resource,
        metric_readers=[metric_reader],
    )
    
    # Set global meter provider
    metrics.set_meter_provider(meter_provider)
    logger.info("[OTEL] Metrics configured")


def _setup_logging(resource: Resource, config: OpenTelemetryConfig) -> None:
    """Configure OTLP log exporter so logs are shipped to the collector → Loki"""

    otlp_log_exporter = OTLPLogExporter(
        endpoint=config.otlp_endpoint,
        insecure=True,
    )

    logger_provider = LoggerProvider(resource=resource)
    logger_provider.add_log_record_processor(
        BatchLogRecordProcessor(otlp_log_exporter)
    )
    set_logger_provider(logger_provider)

    # Attach OTel handler to Python root logger so all loguru/stdlib logs flow through
    handler = LoggingHandler(level=logging.DEBUG, logger_provider=logger_provider)
    logging.getLogger().addHandler(handler)

    logger.info("[OTEL] Log exporter configured → OTel Collector → Loki")


def instrument_fastapi(app) -> None:
    """
    Instrument FastAPI application with OpenTelemetry.
    
    Args:
        app: FastAPI application instance
    """
    logger.info("[OTEL] Instrumenting FastAPI application")
    
    # Instrument FastAPI with automatic tracing
    FastAPIInstrumentor.instrument_app(
        app,
        tracer_provider=trace.get_tracer_provider(),
        excluded_urls="health,metrics,docs,openapi.json",  # Exclude health checks
    )
    
    logger.info("[OTEL] FastAPI instrumentation complete")


def instrument_httpx() -> None:
    """Instrument HTTPX client for external API calls"""
    logger.info("[OTEL] Instrumenting HTTPX client")
    HTTPXClientInstrumentor().instrument()


def instrument_sqlalchemy(engine) -> None:
    """
    Instrument SQLAlchemy for database tracing.
    
    Args:
        engine: SQLAlchemy engine instance
    """
    logger.info("[OTEL] Instrumenting SQLAlchemy")
    SQLAlchemyInstrumentor().instrument(
        engine=engine,
        tracer_provider=trace.get_tracer_provider(),
    )


def get_tracer(name: str = "cleo-backend"):
    """Get a tracer instance for manual instrumentation"""
    return trace.get_tracer(name)


def get_meter(name: str = "cleo-backend"):
    """Get a meter instance for custom metrics"""
    return metrics.get_meter(name)


def add_span_attributes(span, attributes: dict) -> None:
    """
    Add custom attributes to current span.
    
    Args:
        span: Current span
        attributes: Dictionary of attributes to add
    """
    if span and span.is_recording():
        for key, value in attributes.items():
            if value is not None:
                span.set_attribute(key, value)


def record_exception(span, exception: Exception, message: str = None) -> None:
    """
    Record an exception in the current span.
    
    Args:
        span: Current span
        exception: Exception to record
        message: Optional error message
    """
    if span and span.is_recording():
        span.record_exception(exception)
        span.set_status(
            Status(
                StatusCode.ERROR,
                message or str(exception),
            )
        )
