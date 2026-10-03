import { apiClient } from './client';

export type DashboardTimeRange = 'all_time' | 'this_month' | 'this_week';

export interface DashboardExpiringOrder {
  id: string | number;
  order_no: string;
  type: string;
  expiry_date: string;
  days_until_expiry: number;
  quantity: number;
  quantity_unit: string;
  quantity_fulfilled: number;
  from_client: string | null;
  to_client: string | null;
  commodity: string;
}

export interface DashboardInTransitTransport {
  id: string | number;
  vehicle_no: string;
  bill_no: string;
  status: string;
  gross_wt: number;
  quantity_unit: string;
  unload_date: string | null;
}

export interface DashboardData {
  time_range: DashboardTimeRange;
  pending_orders_count: number;
  draft_orders_count: number;
  expiring_orders: DashboardExpiringOrder[];
  in_transit_count: number;
  transport_status_counts: Record<string, number>;
  in_transit_transports: DashboardInTransitTransport[];
}

interface DashboardResponse {
  success: boolean;
  data: DashboardData;
}

export const dashboardApi = {
  async getSummary(timeRange: DashboardTimeRange = 'all_time'): Promise<DashboardData> {
    const response = await apiClient.post<DashboardResponse>('/dashboard/', {
      time_range: timeRange
    });
    return response.data;
  }
};