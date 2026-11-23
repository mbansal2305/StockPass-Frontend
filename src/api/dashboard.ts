import { apiClient } from './client';

export type DashboardTimeRange = 'all_time' | 'this_month' | 'this_week';

export interface DashboardExpiringOrder {
  id: string | number;
  order_no: string;
  type: string;
  is_dummy: boolean;
  expiry_date: string;
  days_until_expiry: number;
  quantity: number | string;
  rate: number | string;
  quantity_unit: string;
  quantity_fulfilled: number | string;
  from_client: string | null;
  to_client: string | null;
  commodity: string;
}

export interface DashboardInTransitTransport {
  id: string | number;
  vehicle_no: string | null;
  vehicle_nos: number | null;
  bulk_transport: boolean;
  bill_no: string;
  status: string;
  transporter: string | null;
  transporter_agency: string | null;
  from_client: string | null;
  from_client_nos: number | null;
  to_client: string | null;
  billing_firm: string | null;
  commodity: string | null;
  gross_wt: number;
  bag_nos: number;
  quantity_unit: string;
  unload_date: string | null;
}

export interface DashboardData {
  time_range: DashboardTimeRange;
  pending_orders_count: number;
  pending_purchase_orders_count: number;
  pending_sales_orders_count: number;
  draft_orders_count: number;
  expiring_orders: DashboardExpiringOrder[];
  in_transit_count: number;
  pending_transport_count: number;
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