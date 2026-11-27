import { apiClient } from './client';

export type WagonAssignmentStatus = 'draft' | 'pending' | 'submitted';

export interface WagonVehicle {
  id: number;
  vehicle_no: string;
  gross_wt: string | number | null;
  quantity_unit: string;
  bag_nos: string | number | null;
}

export interface WagonAssignment {
  id?: number;
  transport: number;
  wagon_number: string;
  wagon_order: number;
  quantity: string;
  bag_nos: string | number;
}

export interface WagonTrain {
  id?: number;
  name: string;
  assignments: WagonAssignment[];
}

export interface WagonAssignmentState {
  bulk_transport: number;
  status: WagonAssignmentStatus;
  trains: WagonTrain[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response || response.success !== true || response.data == null) {
    throw new Error(response?.message || response?.error || 'Invalid wagon assignment response');
  }
  return response.data;
}

export const wagonAssignmentsApi = {
  async vehicles(id: string): Promise<WagonVehicle[]> {
    const data = unwrap(await apiClient.get<ApiResponse<WagonVehicle[]>>(`/bulk-transports/assignwagons/sel/?id=${encodeURIComponent(id)}`));
    if (!Array.isArray(data)) throw new Error('Invalid vehicle list response');
    return data;
  },
  async get(id: string): Promise<WagonAssignmentState> {
    return unwrap(await apiClient.get<ApiResponse<WagonAssignmentState>>(`/bulk-transports/assignwagons/get?id=${encodeURIComponent(id)}`));
  },
  async save(state: WagonAssignmentState, exists: boolean): Promise<WagonAssignmentState> {
    const endpoint = exists ? '/bulk-transports/assignwagons/upd' : '/bulk-transports/assignwagons/add';
    const response = exists
      ? await apiClient.patch<ApiResponse<WagonAssignmentState>>(endpoint, state)
      : await apiClient.post<ApiResponse<WagonAssignmentState>>(endpoint, state);
    return unwrap(response);
  }
};
