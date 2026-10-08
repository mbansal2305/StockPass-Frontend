import { apiClient } from './client';

export interface BillHisaabSearchResult {
  from_client: string | null;
  to_client: string | null;
  vehicle_no: string | null;
  gross_wt: number | string;
  gross_wt_unit: string;
  bill_no: string;
  billing_firm: string;
  rent: number | string;
  rent_type: string;
}

export const billsApi = {
  async search(billingFirmId: string, billNumber: string): Promise<BillHisaabSearchResult> {
    if (!/^\d+$/.test(billingFirmId)) {
      throw new Error('The selected firm has an invalid ID');
    }

    const response = await apiClient.post<any>('/bills/search/', {
      billing_firm_id: Number(billingFirmId),
      bill_no: billNumber
    });
    const result = response?.data?.data ?? response?.data ?? response;
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('Invalid bill search response');
    }
    return {
      from_client: result.from_client == null ? null : String(result.from_client),
      to_client: result.to_client == null ? null : String(result.to_client),
      vehicle_no: result.vehicle_no == null ? null : String(result.vehicle_no),
      gross_wt: result.gross_wt ?? 0,
      gross_wt_unit: String(result.gross_wt_unit ?? ''),
      bill_no: String(result.bill_no ?? ''),
      billing_firm: String(result.billing_firm ?? ''),
      rent: result.rent ?? 0,
      rent_type: String(result.rent_type ?? '')
    };
  }
};
