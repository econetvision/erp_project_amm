"""
Provider Abstraction Layer
==========================
Strategy + Factory + Adapter pattern for dynamic, config-driven provider resolution.

Usage:
    from providers.registry import resolve_provider
    sms = resolve_provider("sms", company_id=5, db=db)
    result = sms.send(to="+91...", message="OTP 1234")
"""
