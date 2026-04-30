import api from "./axiosConfig";

export const getHolidays   = (year)  => api.get(`/api/holidays?year=${year}`);
export const createHoliday = (data)  => api.post("/api/holidays", data);
export const deleteHoliday = (id)    => api.delete(`/api/holidays/${id}`);
