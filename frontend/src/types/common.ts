export interface AlertState {
  type: string;
  message: string;
}

export interface ApiError {
  detail: string | Array<{ msg: string }>;
}
