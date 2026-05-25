"""Maps / Geolocation provider adapters."""
from providers.base import MapsProvider, ProviderResult
from providers.registry import register_provider


@register_provider
class GoogleMapsProvider(MapsProvider):
    CODE = "google_maps"
    NAME = "Google Maps"

    def _base_params(self):
        return {"key": self.credentials["api_key"]}

    def geocode(self, address: str) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={**self._base_params(), "address": address},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            if data["status"] == "OK" and data["results"]:
                loc = data["results"][0]["geometry"]["location"]
                return {"lat": loc["lat"], "lng": loc["lng"], "formatted": data["results"][0]["formatted_address"]}
            return {"status": data["status"]}
        return self._timed(_call)

    def reverse_geocode(self, lat: float, lng: float) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={**self._base_params(), "latlng": f"{lat},{lng}"},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            if data["status"] == "OK" and data["results"]:
                return {"address": data["results"][0]["formatted_address"]}
            return {"status": data["status"]}
        return self._timed(_call)

    def distance(self, origin: tuple, destination: tuple) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.get(
                "https://maps.googleapis.com/maps/api/distancematrix/json",
                params={
                    **self._base_params(),
                    "origins": f"{origin[0]},{origin[1]}",
                    "destinations": f"{destination[0]},{destination[1]}",
                },
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            el = data["rows"][0]["elements"][0]
            return {"distance": el.get("distance", {}).get("text"), "duration": el.get("duration", {}).get("text")}
        return self._timed(_call)

    def autocomplete(self, query: str) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.get(
                "https://maps.googleapis.com/maps/api/place/autocomplete/json",
                params={**self._base_params(), "input": query},
                timeout=10,
            )
            resp.raise_for_status()
            return {"predictions": [p["description"] for p in resp.json().get("predictions", [])]}
        return self._timed(_call)

    def test_connection(self) -> ProviderResult:
        return self.geocode("Mumbai, India")


@register_provider
class MapboxProvider(MapsProvider):
    CODE = "mapbox_maps"
    NAME = "Mapbox"

    def geocode(self, address: str) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.get(
                f"https://api.mapbox.com/geocoding/v5/mapbox.places/{address}.json",
                params={"access_token": self.credentials["access_token"], "limit": 1},
                timeout=10,
            )
            resp.raise_for_status()
            features = resp.json().get("features", [])
            if features:
                coords = features[0]["center"]  # [lng, lat]
                return {"lat": coords[1], "lng": coords[0], "formatted": features[0].get("place_name")}
            return {"status": "no_results"}
        return self._timed(_call)

    def reverse_geocode(self, lat: float, lng: float) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.get(
                f"https://api.mapbox.com/geocoding/v5/mapbox.places/{lng},{lat}.json",
                params={"access_token": self.credentials["access_token"], "limit": 1},
                timeout=10,
            )
            resp.raise_for_status()
            features = resp.json().get("features", [])
            if features:
                return {"address": features[0].get("place_name")}
            return {"status": "no_results"}
        return self._timed(_call)

    def test_connection(self) -> ProviderResult:
        return self.geocode("Mumbai, India")


@register_provider
class OpenStreetMapProvider(MapsProvider):
    CODE = "osm_maps"
    NAME = "OpenStreetMap / Nominatim"

    def geocode(self, address: str) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": address, "format": "json", "limit": 1},
                headers={"User-Agent": "ERP-System/1.0"},
                timeout=10,
            )
            resp.raise_for_status()
            results = resp.json()
            if results:
                return {"lat": float(results[0]["lat"]), "lng": float(results[0]["lon"]), "formatted": results[0]["display_name"]}
            return {"status": "no_results"}
        return self._timed(_call)

    def reverse_geocode(self, lat: float, lng: float) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lng, "format": "json"},
                headers={"User-Agent": "ERP-System/1.0"},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            return {"address": data.get("display_name", "")}
        return self._timed(_call)

    def test_connection(self) -> ProviderResult:
        return self.geocode("Mumbai, India")


@register_provider
class HereMapsProvider(MapsProvider):
    CODE = "here_maps"
    NAME = "HERE Maps"

    def geocode(self, address: str) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.get(
                "https://geocode.search.hereapi.com/v1/geocode",
                params={"q": address, "apiKey": self.credentials["api_key"]},
                timeout=10,
            )
            resp.raise_for_status()
            items = resp.json().get("items", [])
            if items:
                pos = items[0]["position"]
                return {"lat": pos["lat"], "lng": pos["lng"], "formatted": items[0].get("title")}
            return {"status": "no_results"}
        return self._timed(_call)

    def reverse_geocode(self, lat: float, lng: float) -> ProviderResult:
        import httpx
        def _call():
            resp = httpx.get(
                "https://revgeocode.search.hereapi.com/v1/revgeocode",
                params={"at": f"{lat},{lng}", "apiKey": self.credentials["api_key"]},
                timeout=10,
            )
            resp.raise_for_status()
            items = resp.json().get("items", [])
            if items:
                return {"address": items[0].get("title")}
            return {"status": "no_results"}
        return self._timed(_call)

    def test_connection(self) -> ProviderResult:
        return self.geocode("Mumbai, India")
