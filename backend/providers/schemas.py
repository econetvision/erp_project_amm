"""
Provider Config Schemas
========================
Declares, for every built-in provider, which credential/config keys it needs.
Stored into ``integration_providers.config_schema`` (JSONB) so the frontend can
render exact, labelled input fields instead of free-form key/value pairs, and
so the API can validate that required keys are present before saving.

Schema shape::

    {
        "credentials": {
            "<key>": {"label": str, "required": bool, "secret": bool, "help": str},
            ...
        },
        "config": {
            "<key>": {"label": str, "required": bool, "help": str},
            ...
        },
    }

Key names MUST match what the adapter classes read from ``self.credentials`` /
``self.config`` (see providers/sms, email, maps, kyc, bank, otp).
"""


def _f(label: str, required: bool = False, secret: bool = False, help: str = ""):
    return {"label": label, "required": required, "secret": secret, "help": help}


PROVIDER_CONFIG_SCHEMAS: dict[str, dict] = {
    # ── SMS ──────────────────────────────────────────────────────────────
    "twilio_sms": {
        "credentials": {
            "account_sid": _f("Account SID", required=True, help="Twilio Console → Account Info"),
            "auth_token": _f("Auth Token", required=True, secret=True),
            "from_number": _f("From Number", help="E.164 sender number, e.g. +14155550100"),
            "verify_service_sid": _f("Verify Service SID", help="Required only for OTP via Twilio Verify (starts with VA…)"),
        },
        "config": {},
    },
    "msg91_sms": {
        "credentials": {
            "auth_key": _f("Auth Key", required=True, secret=True),
        },
        "config": {
            "template_id": _f("SMS Flow/Template ID"),
            "otp_template_id": _f("OTP Template ID"),
        },
    },
    "aws_sns_sms": {
        "credentials": {
            "access_key_id": _f("Access Key ID", required=True),
            "secret_access_key": _f("Secret Access Key", required=True, secret=True),
            "region": _f("Region", help="Default: ap-south-1"),
        },
        "config": {},
    },
    "textlocal_sms": {
        "credentials": {
            "api_key": _f("API Key", required=True, secret=True),
        },
        "config": {
            "sender": _f("Sender ID", help="Default: ERPSMS"),
        },
    },
    "vonage_sms": {
        "credentials": {
            "api_key": _f("API Key", required=True),
            "api_secret": _f("API Secret", required=True, secret=True),
        },
        "config": {
            "from_name": _f("From Name", help="Default: ERP"),
        },
    },

    # ── Email ────────────────────────────────────────────────────────────
    "smtp_email": {
        "credentials": {
            "host": _f("SMTP Host", required=True),
            "port": _f("SMTP Port", help="Default: 587"),
            "username": _f("Username"),
            "password": _f("Password", secret=True),
            "from_email": _f("From Email"),
            "use_tls": _f("Use TLS", help="true / false — default true"),
        },
        "config": {},
    },
    "sendgrid_email": {
        "credentials": {
            "api_key": _f("API Key", required=True, secret=True),
            "from_email": _f("From Email"),
        },
        "config": {},
    },
    "aws_ses_email": {
        "credentials": {
            "access_key_id": _f("Access Key ID", required=True),
            "secret_access_key": _f("Secret Access Key", required=True, secret=True),
            "region": _f("Region", help="Default: ap-south-1"),
            "from_email": _f("From Email"),
        },
        "config": {},
    },
    "mailgun_email": {
        "credentials": {
            "api_key": _f("API Key", required=True, secret=True),
            "domain": _f("Sending Domain", required=True),
            "from_email": _f("From Email"),
        },
        "config": {},
    },

    # ── Maps ─────────────────────────────────────────────────────────────
    "google_maps": {
        "credentials": {
            "api_key": _f("API Key", required=True, secret=True),
        },
        "config": {},
    },
    "mapbox_maps": {
        "credentials": {
            "access_token": _f("Access Token", required=True, secret=True),
        },
        "config": {},
    },
    "osm_maps": {
        "credentials": {},
        "config": {},
    },
    "here_maps": {
        "credentials": {
            "api_key": _f("API Key", required=True, secret=True),
        },
        "config": {},
    },

    # ── KYC ──────────────────────────────────────────────────────────────
    "cashfree_kyc": {
        "credentials": {
            "client_id": _f("Client ID", required=True),
            "client_secret": _f("Client Secret", required=True, secret=True),
        },
        "config": {
            "environment": _f("Environment", help="production / sandbox — default production"),
        },
    },
    "signzy_kyc": {
        "credentials": {
            "api_key": _f("API Key", required=True, secret=True),
            "base_url": _f("Base URL", help="Default: Signzy pre-production"),
        },
        "config": {},
    },
    "hyperverge_kyc": {
        "credentials": {
            "app_id": _f("App ID", required=True),
            "app_key": _f("App Key", required=True, secret=True),
        },
        "config": {},
    },
    "karza_kyc": {
        "credentials": {
            "api_key": _f("API Key", required=True, secret=True),
        },
        "config": {},
    },

    # ── Bank ─────────────────────────────────────────────────────────────
    "razorpayx_bank": {
        "credentials": {
            "key_id": _f("Key ID", required=True),
            "key_secret": _f("Key Secret", required=True, secret=True),
            "source_account": _f("Source Account Number"),
        },
        "config": {},
    },
    "cashfree_bank": {
        "credentials": {
            "client_id": _f("Client ID", required=True),
            "client_secret": _f("Client Secret", required=True, secret=True),
        },
        "config": {
            "environment": _f("Environment", help="production / sandbox — default production"),
        },
    },
    "decentro_bank": {
        "credentials": {
            "client_id": _f("Client ID", required=True),
            "client_secret": _f("Client Secret", required=True, secret=True),
            "module_secret": _f("Module Secret", secret=True),
        },
        "config": {},
    },
    "setu_bank": {
        "credentials": {
            "client_id": _f("Client ID", required=True),
            "client_secret": _f("Client Secret", required=True, secret=True),
            "product_instance_id": _f("Product Instance ID"),
        },
        "config": {},
    },

    # ── OTP ──────────────────────────────────────────────────────────────
    "twilio_verify": {
        "credentials": {
            "account_sid": _f("Account SID", required=True, help="Twilio Console → Account Info"),
            "auth_token": _f("Auth Token", required=True, secret=True),
            "verify_service_sid": _f("Verify Service SID", required=True, help="Twilio Verify service (starts with VA…)"),
        },
        "config": {},
    },
}


def missing_required_credentials(code: str, credentials: dict | None) -> list[str]:
    """Return required credential keys absent/blank in the given dict."""
    schema = PROVIDER_CONFIG_SCHEMAS.get(code)
    if not schema:
        return []
    creds = credentials or {}
    return [
        key
        for key, spec in schema.get("credentials", {}).items()
        if spec.get("required") and not str(creds.get(key) or "").strip()
    ]
