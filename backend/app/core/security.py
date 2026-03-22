"""Webhook signature verification utilities.

BookStack sends an HMAC-SHA256 signature in the `X-BookStack-Signature`
header computed over the raw request body.  We recompute it server-side
and use constant-time comparison to validate authenticity.
"""

import hashlib
import hmac


def verify_webhook_signature(
    payload: bytes,
    signature: str,
    secret: str,
) -> bool:
    """Return True when the HMAC-SHA256 of *payload* matches *signature*.

    Uses ``hmac.compare_digest`` for constant-time comparison to prevent
    timing side-channel attacks.
    """
    if not secret:
        # If no secret is configured, skip verification (dev mode).
        return True

    if not signature:
        return False

    expected = hmac.new(
        secret.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, signature)
