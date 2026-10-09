import api from "./axiosConfig";
import type { AxiosResponse } from "axios";

export interface AttendanceSupervisor {
  id: number;
  username: string;
  display_name: string | null;
  name: string | null;
  is_active: boolean;
  company_id: number | null;
  must_change_password: boolean;
  site_id: number | null;
  site_name: string | null;
}

export const getAttendanceSupervisors = (): Promise<AxiosResponse<AttendanceSupervisor[]>> =>
  api.get("/api/physical-attendance/supervisors");

// locationId = null disables physical attendance for the supervisor.
export const setSupervisorSite = (userId: number, locationId: number | null): Promise<AxiosResponse<AttendanceSupervisor>> =>
  api.put(`/api/physical-attendance/supervisors/${userId}`, { location_id: locationId });
