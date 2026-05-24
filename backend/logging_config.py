"""
Logging configuration for the ERP backend.
Outputs structured logs to stdout/stderr for better integration with cloud platforms.
"""
import logging
import sys
from datetime import datetime


class StructuredFormatter(logging.Formatter):
    """Custom formatter that outputs structured logs with timestamps."""

    def format(self, record):
        # Add timestamp in ISO format
        record.timestamp = datetime.utcnow().isoformat() + 'Z'

        # Format the message
        log_format = (
            f"[{record.timestamp}] "
            f"[{record.levelname}] "
            f"[{record.name}] "
            f"{record.getMessage()}"
        )

        # Add exception info if present
        if record.exc_info:
            log_format += f"\n{self.formatException(record.exc_info)}"

        return log_format


def setup_logging(log_level: str = "INFO"):
    """
    Configure logging for the application.

    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    """
    # Create formatter
    formatter = StructuredFormatter()

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper()))

    # Remove existing handlers
    root_logger.handlers.clear()

    # Create console handler for stdout
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    console_handler.setFormatter(formatter)

    # Add handler to root logger
    root_logger.addHandler(console_handler)

    # Configure uvicorn loggers
    for logger_name in ["uvicorn", "uvicorn.access", "uvicorn.error"]:
        logger = logging.getLogger(logger_name)
        logger.handlers.clear()
        logger.addHandler(console_handler)
        logger.propagate = False

    # Configure SQLAlchemy logger (reduce verbosity)
    sqlalchemy_logger = logging.getLogger("sqlalchemy.engine")
    sqlalchemy_logger.setLevel(logging.WARNING)
    sqlalchemy_logger.handlers.clear()
    sqlalchemy_logger.addHandler(console_handler)
    sqlalchemy_logger.propagate = False

    # Log startup message
    root_logger.info("Logging configuration initialized")
    root_logger.info(f"Log level set to: {log_level.upper()}")


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance for a specific module.

    Args:
        name: Name of the module/logger

    Returns:
        Logger instance
    """
    return logging.getLogger(name)
