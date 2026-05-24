import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:8088",
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const stored = localStorage.getItem("erp_auth");
  if (stored) {
    const { access_token } = JSON.parse(stored) as { access_token?: string };
    if (access_token) config.headers.Authorization = `Bearer ${access_token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string | Array<{ msg: string }> }>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("erp_auth");
      window.location.href = "/login";
      return Promise.reject(new Error("Session expired. Please log in again."));
    }
    let message: string;
    if (!error.response) {
      message = "Cannot connect to server. Please ensure the backend is running.";
    } else {
      const detail = error.response.data?.detail;
      if (Array.isArray(detail)) {
        message = detail.map((d) => d.msg).join(", ");
      } else {
        message = detail || `Server error (${error.response.status})`;
      }
    }
    return Promise.reject(new Error(message));
  }
);

export default api;
