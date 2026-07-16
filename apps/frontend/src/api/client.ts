import axios from 'axios';
import type { ApiResponse } from '@dds/shared';

const client = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.error?.message ?? err.message ?? 'Request failed';
    return Promise.reject(new Error(message));
  },
);

export async function get<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
  const { data } = await client.get<ApiResponse<T>>(url, { params });
  return data;
}

export async function post<T>(url: string, body: unknown): Promise<ApiResponse<T>> {
  const { data } = await client.post<ApiResponse<T>>(url, body);
  return data;
}

export async function put<T>(url: string, body: unknown): Promise<ApiResponse<T>> {
  const { data } = await client.put<ApiResponse<T>>(url, body);
  return data;
}

export async function del<T>(url: string): Promise<ApiResponse<T>> {
  const { data } = await client.delete<ApiResponse<T>>(url);
  return data;
}
