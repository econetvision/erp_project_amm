import api from "./axiosConfig";

export const generatePayslip      = (data)         => api.post("/api/payslips/generate", data);
export const getEmployeePayslips  = (empId)         => api.get(`/api/payslips/${empId}`);
export const getPayslip           = (empId, y, m)   => api.get(`/api/payslips/${empId}/${y}/${m}`);
export const getMonthPayslips     = (y, m)          => api.get(`/api/payslips/month/${y}/${m}`);
export const deletePayslip        = (id)            => api.delete(`/api/payslips/${id}`);
