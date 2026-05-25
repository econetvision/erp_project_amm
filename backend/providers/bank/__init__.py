"""Bank account verification provider adapters."""
from providers.base import BankProvider, ProviderResult
from providers.registry import register_provider


@register_provider
class RazorpayxBankProvider(BankProvider):
    CODE = "razorpayx_bank"
    NAME = "RazorpayX"

    def _auth(self):
        return (self.credentials["key_id"], self.credentials["key_secret"])

    def _base_url(self):
        return "https://api.razorpay.com/v1"

    def verify_account(self, account_number: str, ifsc: str, **kwargs) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.post(
                f"{self._base_url()}/fund_accounts/validations",
                auth=self._auth(),
                json={
                    "account_number": self.credentials.get("source_account", ""),
                    "fund_account": {
                        "account_type": "bank_account",
                        "bank_account": {
                            "ifsc": ifsc,
                            "name": kwargs.get("name", "Test"),
                            "account_number": account_number,
                        },
                    },
                    "type": "bank_account",
                    "currency": "INR",
                    "amount": 100,
                },
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_call)

    def verify_upi(self, upi_id: str, **kwargs) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.post(
                f"{self._base_url()}/payments/validate/vpa",
                auth=self._auth(),
                json={"vpa": upi_id},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_call)

    def validate_ifsc(self, ifsc: str) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.get(f"https://ifsc.razorpay.com/{ifsc}", timeout=10)
            resp.raise_for_status()
            return resp.json()
        return self._timed(_call)

    def test_connection(self) -> ProviderResult:
        import httpx
        def _test():
            resp = httpx.get(f"{self._base_url()}/payments?count=1", auth=self._auth(), timeout=10)
            return {"status_code": resp.status_code}
        return self._timed(_test)


@register_provider
class CashfreeBankProvider(BankProvider):
    CODE = "cashfree_bank"
    NAME = "Cashfree"

    def _headers(self):
        return {
            "x-client-id": self.credentials["client_id"],
            "x-client-secret": self.credentials["client_secret"],
            "Content-Type": "application/json",
        }

    def _base_url(self):
        env = self.config.get("environment", "production")
        if env == "sandbox":
            return "https://sandbox.cashfree.com/verification"
        return "https://api.cashfree.com/verification"

    def verify_account(self, account_number: str, ifsc: str, **kwargs) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.post(
                f"{self._base_url()}/bank-account/sync",
                headers=self._headers(),
                json={
                    "bank_account": account_number,
                    "ifsc": ifsc,
                    "name": kwargs.get("name", "Test"),
                },
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_call)

    def validate_ifsc(self, ifsc: str) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.get(f"https://ifsc.razorpay.com/{ifsc}", timeout=10)
            resp.raise_for_status()
            return resp.json()
        return self._timed(_call)

    def test_connection(self) -> ProviderResult:
        import httpx
        def _test():
            resp = httpx.post(
                f"{self._base_url()}/bank-account/sync",
                headers=self._headers(),
                json={"bank_account": "0000000000", "ifsc": "SBIN0000001", "name": "Test"},
                timeout=10,
            )
            return {"status_code": resp.status_code}
        return self._timed(_test)


@register_provider
class DecentroBankProvider(BankProvider):
    CODE = "decentro_bank"
    NAME = "Decentro"

    def _headers(self):
        return {
            "client_id": self.credentials["client_id"],
            "client_secret": self.credentials["client_secret"],
            "module_secret": self.credentials.get("module_secret", ""),
            "Content-Type": "application/json",
        }

    def verify_account(self, account_number: str, ifsc: str, **kwargs) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.post(
                "https://in.decentro.tech/v2/banking/account/verify",
                headers=self._headers(),
                json={
                    "account_number": account_number,
                    "ifsc": ifsc,
                },
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_call)

    def test_connection(self) -> ProviderResult:
        import httpx
        def _test():
            resp = httpx.get(
                "https://in.decentro.tech/v2/banking/health",
                headers=self._headers(),
                timeout=10,
            )
            return {"status_code": resp.status_code}
        return self._timed(_test)


@register_provider
class SetuBankProvider(BankProvider):
    CODE = "setu_bank"
    NAME = "Setu"

    def _headers(self):
        return {
            "x-client-id": self.credentials["client_id"],
            "x-client-secret": self.credentials["client_secret"],
            "x-product-instance-id": self.credentials.get("product_instance_id", ""),
            "Content-Type": "application/json",
        }

    def verify_account(self, account_number: str, ifsc: str, **kwargs) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.post(
                "https://dg.setu.co/api/verify/ban/reverse",
                headers=self._headers(),
                json={"ifsc": ifsc, "accountNumber": account_number},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_call)

    def verify_upi(self, upi_id: str, **kwargs) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.post(
                "https://dg.setu.co/api/verify/upi",
                headers=self._headers(),
                json={"vpa": upi_id},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_call)

    def test_connection(self) -> ProviderResult:
        import httpx
        def _test():
            resp = httpx.get("https://dg.setu.co/api/health", headers=self._headers(), timeout=10)
            return {"status_code": resp.status_code}
        return self._timed(_test)
