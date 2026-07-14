export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  detail: string;
}

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
}

export type LoadingState =
  | "idle"
  | "loading"
  | "success"
  | "error";