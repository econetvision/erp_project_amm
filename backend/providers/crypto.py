"""
Credential encryption utilities.
Uses Fernet symmetric encryption; key derived from SECRET_KEY env var.
"""
import base64
import hashlib
import json
from typing import Optional
from cryptography.fernet import Fernet

from config.settings import settings


def _get_fernet() -> Fernet:
    secret = settings.secret_key
    # Derive a 32-byte key from SECRET_KEY via SHA-256, then base64-encode for Fernet
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
    return Fernet(key)


def encrypt_value(plain: str) -> str:
    """Encrypt a single string value."""
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_value(cipher: str) -> str:
    """Decrypt a single string value."""
    return _get_fernet().decrypt(cipher.encode()).decode()


def encrypt_credentials(creds: Optional[dict]) -> Optional[dict]:
    """Encrypt all values in a credentials dict."""
    if not creds:
        return creds
    encrypted = {}
    for k, v in creds.items():
        encrypted[k] = encrypt_value(str(v)) if v is not None else None
    return encrypted


def decrypt_credentials(creds: Optional[dict]) -> Optional[dict]:
    """Decrypt all values in a credentials dict."""
    if not creds:
        return creds
    decrypted = {}
    for k, v in creds.items():
        try:
            decrypted[k] = decrypt_value(v) if v is not None else None
        except Exception:
            decrypted[k] = v  # already plain or corrupted
    return decrypted


def mask_credentials(creds: Optional[dict]) -> Optional[dict]:
    """Return masked version of credentials for UI display."""
    if not creds:
        return creds
    masked = {}
    for k, v in creds.items():
        if v and len(str(v)) > 4:
            masked[k] = str(v)[:2] + "***" + str(v)[-2:]
        else:
            masked[k] = "***"
    return masked
