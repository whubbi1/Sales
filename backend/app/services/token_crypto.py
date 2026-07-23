# backend/app/services/token_crypto.py
# Encrypts Outlook OAuth tokens at rest (outlook_connections.access_token_encrypted/
# refresh_token_encrypted) and signs the OAuth `state` param passed through the Microsoft
# login redirect — reusing one Fernet key for both rather than adding a separate JWT scheme
# (this codebase has no existing token-signing helper to reuse instead).
import os
import json
from cryptography.fernet import Fernet, InvalidToken

_KEY = os.getenv("OUTLOOK_TOKEN_ENCRYPTION_KEY")
_fernet = Fernet(_KEY.encode()) if _KEY else None


def encrypt(value: str) -> str:
    if not _fernet:
        raise RuntimeError("OUTLOOK_TOKEN_ENCRYPTION_KEY is not configured")
    return _fernet.encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    if not _fernet:
        raise RuntimeError("OUTLOOK_TOKEN_ENCRYPTION_KEY is not configured")
    return _fernet.decrypt(value.encode()).decode()


def encrypt_state(payload: dict) -> str:
    return encrypt(json.dumps(payload))


def decrypt_state(token: str) -> dict | None:
    try:
        return json.loads(decrypt(token))
    except (InvalidToken, ValueError):
        return None
