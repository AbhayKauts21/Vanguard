"""
Structured Logging with OpenTelemetry Integration

This module configures structured JSON logging with trace correlation.
All logs include trace_id and span_id for correlation with traces.
"""

import sys
import json
import logging
from typing import Any, Dict
from loguru import logger

try:
    from opentelemetry import trace
except ModuleNotFoundError:
    class _NullSpanContext:
        is_valid = False
        trace_id = 0
        span_id = 0
        trace_flags = 0

    class _NullSpan:
        def get_span_context(self):
            return _NullSpanContext()

    class _NullTraceModule:
        @staticmethod
        def get_current_span():
            return _NullSpan()

    trace = _NullTraceModule()


class StructuredJSONFormatter(logging.Formatter):
    """
    JSON formatter that includes OpenTelemetry trace context.
    """
    
    def format(self, record: logging.LogRecord) -> str:
        """
        Format log record as JSON with trace context.
        
        Args:
            record: Log record to format
            
        Returns:
            JSON-formatted log string
        """
        # Get current span context
        span = trace.get_current_span()
        span_context = span.get_span_context() if span else None
        
        # Build structured log entry
        log_entry: Dict[str, Any] = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add trace context if available
        if span_context and span_context.is_valid:
            log_entry["trace_id"] = format(span_context.trace_id, "032x")
            log_entry["span_id"] = format(span_context.span_id, "016x")
            log_entry["trace_flags"] = span_context.trace_flags
        
        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields from record
        if hasattr(record, "request_id"):
            log_entry["request_id"] = record.request_id
        
        if hasattr(record, "user_id"):
            log_entry["user_id"] = record.user_id
        
        # Add custom fields
        for key, value in record.__dict__.items():
            if key not in ["name", "msg", "args", "created", "filename", "funcName",
                          "levelname", "levelno", "lineno", "module", "msecs",
                          "message", "pathname", "process", "processName",
                          "relativeCreated", "thread", "threadName", "exc_info",
                          "exc_text", "stack_info"]:
                log_entry[key] = value
        
        return json.dumps(log_entry)


def configure_structured_logging(
    level: str = "INFO",
    json_format: bool = True,
) -> None:
    """
    Configure structured logging with OpenTelemetry integration.
    
    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        json_format: Whether to use JSON format (True) or pretty format (False)
    """
    # Remove default loguru handler
    logger.remove()
    
    if json_format:
        # Use custom sink function to avoid template collisions with JSON
        logger.add(
            lambda msg: sys.stdout.write(msg),
            format=_json_format_function,
            level=level,
        )
    else:
        # Add pretty formatter for development
        logger.add(
            sys.stdout,
            format=(
                "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
                "<level>{level: <8}</level> | "
                "<cyan>{extra[trace_id]}</cyan> | "
                "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
                "<level>{message}</level>"
            ),
            level=level,
        )
    
    # Configure Python standard logging to use structured format
    if json_format:
        root_logger = logging.getLogger()
        root_logger.setLevel(getattr(logging, level))
        
        # Remove existing handlers
        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)
        
        # Add JSON handler
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(StructuredJSONFormatter())
        root_logger.addHandler(handler)


def _json_format_function(record) -> str:
    """
    Format loguru record as JSON with trace context.
    
    Args:
        record: Loguru record
        
    Returns:
        JSON-formatted log string
    """
    # Get current span context
    span = trace.get_current_span()
    span_context = span.get_span_context() if span else None
    
    # Build structured log entry
    log_entry = {
        "timestamp": record["time"].isoformat(),
        "level": record["level"].name,
        "logger": record["name"],
        "message": record["message"],
        "module": record["module"],
        "function": record["function"],
        "line": record["line"],
    }
    
    # Add trace context if available
    if span_context and span_context.is_valid:
        log_entry["trace_id"] = format(span_context.trace_id, "032x")
        log_entry["span_id"] = format(span_context.span_id, "016x")
        log_entry["trace_flags"] = span_context.trace_flags
    
    # Add exception if present
    if record["exception"]:
        log_entry["exception"] = {
            "type": record["exception"].type.__name__,
            "value": str(record["exception"].value),
            "traceback": record["exception"].traceback,
        }
    
    # Add extra fields
    for key, value in record["extra"].items():
        if key not in log_entry:
            log_entry[key] = value
    
    return json.dumps(log_entry).replace("{", "{{").replace("}", "}}") + "\n"


def get_logger_with_context(name: str, **context) -> logger:
    """
    Get a logger with bound context.
    
    Args:
        name: Logger name
        **context: Context to bind to logger
        
    Returns:
        Logger with bound context
    """
    return logger.bind(**context)
