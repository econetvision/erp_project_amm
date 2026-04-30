import api from "./axiosConfig";

export const clockIn          = (data)        => api.post("/api/attendance/clock-in", data);
export const clockOut         = (id, data)    => api.patch(`/api/attendance/${id}/clock-out`, data);
export const getMonthlyReport = (empId, m, y) => api.get(`/api/attendance/${empId}/monthly?month=${m}&year=${y}`);
export const getTodayStatus   = (empId)       => api.get(`/api/attendance/${empId}/today`);
export const updateAttendance = (id, data)    => api.put(`/api/attendance/${id}`, data);
export const deleteAttendance = (id)          => api.delete(`/api/attendance/${id}`);
export const faceScan         = (image)       => api.post("/api/attendance/face-scan", { image });
