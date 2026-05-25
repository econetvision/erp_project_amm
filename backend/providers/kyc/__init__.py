"""KYC verification provider adapters."""
from providers.base import KycProvider, ProviderResult
from providers.registry import register_provider


@register_provider
class CashfreeKycProvider(KycProvider):
    CODE = "cashfree_kyc"
    NAME = "Cashfree KYC"

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

    def verify_aadhaar(self, aadhaar_number: str, **kwargs) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.post(
                f"{self._base_url()}/offline-aadhaar/otp",
                headers=self._headers(),
                json={"aadhaar_number": aadhaar_number},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_call)

    def verify_pan(self, pan_number: str, **kwargs) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.post(
                f"{self._base_url()}/pan",
                headers=self._headers(),
                json={"pan": pan_number},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_call)

    def verify_gst(self, gst_number: str, **kwargs) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.post(
                f"{self._base_url()}/gst",
                headers=self._headers(),
                json={"gst": gst_number},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_call)

    def test_connection(self) -> ProviderResult:
        import httpx
        def _test():
            resp = httpx.post(
                f"{self._base_url()}/pan",
                headers=self._headers(),
                json={"pan": "ABCDE1234F"},
                timeout=10,
            )
            return {"status_code": resp.status_code}
        return self._timed(_test)


@register_provider
class SignzyKycProvider(KycProvider):
    CODE = "signzy_kyc"
    NAME = "Signzy"

    def _headers(self):
        return {
            "Authorization": self.credentials["api_key"],
            "Content-Type": "application/json",
        }

    def _base_url(self):
        return self.credentials.get("base_url", "https://preproduction.signzy.tech/api/v2")

    def verify_aadhaar(self, aadhaar_number: str, **kwargs) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.post(
                f"{self._base_url()}/aadhaar/okyc",
                headers=self._headers(),
                json={"aadhaarNumber": aadhaar_number},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_call)

    def verify_pan(self, pan_number: str, **kwargs) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.post(
                f"{self._base_url()}/pan/verification",
                headers=self._headers(),
                json={"pan": pan_number},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_call)

    def test_connection(self) -> ProviderResult:
        import httpx
        def _test():
            resp = httpx.get(f"{self._base_url()}/health", headers=self._headers(), timeout=10)
            return {"status_code": resp.status_code}
        return self._timed(_test)


@register_provider
class HyperVergeKycProvider(KycProvider):
    CODE = "hyperverge_kyc"
    NAME = "HyperVerge"

    def _headers(self):
        return {
            "appId": self.credentials["app_id"],
            "appKey": self.credentials["app_key"],
            "Content-Type": "application/json",
        }

    def verify_aadhaar(self, aadhaar_number: str, **kwargs) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.post(
                "https://ind.hyperverge.co/v1/aadhaarVerification",
                headers=self._headers(),
                json={"aadhaar_number": aadhaar_number},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_call)

    def verify_pan(self, pan_number: str, **kwargs) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.post(
                "https://ind.hyperverge.co/v1/panVerification",
                headers=self._headers(),
                json={"pan": pan_number},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_call)

    def verify_face(self, image_base64: str, **kwargs) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.post(
                "https://ind.hyperverge.co/v1/photo/verify",
                headers=self._headers(),
                json={"image": image_base64},
                timeout=30,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_call)

    def test_connection(self) -> ProviderResult:
        import httpx
        def _test():
            resp = httpx.get(
                "https://ind.hyperverge.co/v1/health",
                headers=self._headers(),
                timeout=10,
            )
            return {"status_code": resp.status_code}
        return self._timed(_test)


@register_provider
class KarzaKycProvider(KycProvider):
    CODE = "karza_kyc"
    NAME = "Karza"

    def _headers(self):
        return {
            "x-karza-key": self.credentials["api_key"],
            "Content-Type": "application/json",
        }

    def verify_aadhaar(self, aadhaar_number: str, **kwargs) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.post(
                "https://api.karza.in/v3/aadhaar-verification",
                headers=self._headers(),
                json={"aadhaar_number": aadhaar_number, "consent": "Y"},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_call)

    def verify_pan(self, pan_number: str, **kwargs) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.post(
                "https://api.karza.in/v3/pan-verification",
                headers=self._headers(),
                json={"pan": pan_number, "consent": "Y"},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_call)

    def verify_gst(self, gst_number: str, **kwargs) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.post(
                "https://api.karza.in/v3/gst-verification",
                headers=self._headers(),
                json={"gstin": gst_number, "consent": "Y"},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
        return self._timed(_call)

    def test_connection(self) -> ProviderResult:
        import httpx
        def _test():
            resp = httpx.get(
                "https://api.karza.in/v3/health",
                headers=self._headers(),
                timeout=10,
            )
            return {"status_code": resp.status_code}
        return self._timed(_test)
