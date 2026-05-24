import httpx
from fastapi import HTTPException


async def lookup_ifsc(ifsc_code: str) -> dict:
    """Look up bank details from IFSC code using public Razorpay API."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"https://ifsc.razorpay.com/{ifsc_code}")
            if resp.status_code == 404:
                raise HTTPException(status_code=400, detail=f"Invalid IFSC code: {ifsc_code}")
            resp.raise_for_status()
            data = resp.json()
            return {
                "bank": data.get("BANK", ""),
                "branch": data.get("BRANCH", ""),
                "address": data.get("ADDRESS", ""),
                "city": data.get("CITY", ""),
                "state": data.get("STATE", ""),
            }
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not reach IFSC lookup service")


async def verify_bank_account(
    bank_account: str,
    ifsc_code: str,
    account_holder_name: str,
    provider: str = "manual",
    api_key: str | None = None,
    api_secret: str | None = None,
) -> dict:
    """
    Verify bank account. Currently supports manual mode.
    
    For production, integrate with:
    - Cashfree: POST https://api.cashfree.com/verification/bank-account
    - Razorpay: POST https://api.razorpay.com/v1/fund_accounts/validations
    
    Returns: {"status": "verified"|"failed"|"name_mismatch", "registered_name": str|None}
    """
    if provider == "cashfree" and api_key and api_secret:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    "https://api.cashfree.com/verification/bank-account",
                    headers={
                        "x-client-id": api_key,
                        "x-client-secret": api_secret,
                        "Content-Type": "application/json",
                    },
                    json={
                        "bank_account": bank_account,
                        "ifsc": ifsc_code,
                        "name": account_holder_name,
                    },
                )
                data = resp.json()
                if data.get("account_status") == "VALID":
                    registered = data.get("registered_name", "")
                    if registered.upper().strip() == account_holder_name.upper().strip():
                        return {"status": "verified", "registered_name": registered}
                    else:
                        return {"status": "name_mismatch", "registered_name": registered}
                else:
                    return {"status": "failed", "registered_name": None}
        except Exception:
            raise HTTPException(status_code=502, detail="Bank verification service unavailable")
    
    # Manual/fallback — just mark as pending for admin review
    return {"status": "pending", "registered_name": None}
