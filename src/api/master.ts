/**
 * Master Data API Client
 * Endpoints:
 * - POST /master/add/
 * - PATCH /master/upd/
 * - GET /master/get/
 * - DELETE /master/del/
 * - POST /master/lst/
 * - POST /master/search/
 *
 * Backend response structure:
 * {
 *   "success": true,
 *   "entity": "commodity",
 *   "data": {
 *     "page": 1,
 *     "page_size": 50,
 *     "total": 3,
 *     "total_pages": 1,
 *     "results": [ ... ]
 *   }
 * }
 */

import { apiClient } from './client';
import { MasterEntityType } from '../types';

export interface PaginatedResult<T = any> {
  results: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function parsePaginatedResponse<T>(res: any): PaginatedResult<T> {
  if (!res) {
    return { results: [], total: 0, page: 1, pageSize: 50, totalPages: 1 };
  }

  // Standard response pattern: { success: true, entity: "...", data: { page, page_size, total, total_pages, results: [...] } }
  if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
    const d = res.data;
    const results: T[] = Array.isArray(d.results)
      ? d.results
      : Array.isArray(d.items)
      ? d.items
      : Array.isArray(d.data)
      ? d.data
      : [];

    return {
      results,
      total: typeof d.total === 'number' ? d.total : results.length,
      page: typeof d.page === 'number' ? d.page : 1,
      pageSize: typeof d.page_size === 'number' ? d.page_size : (results.length || 50),
      totalPages: typeof d.total_pages === 'number' ? d.total_pages : 1
    };
  }

  // Direct results inside data array: { success: true, data: [...] }
  if (Array.isArray(res.data)) {
    return {
      results: res.data,
      total: res.total || res.count || res.data.length,
      page: res.page || 1,
      pageSize: res.page_size || res.pageSize || res.data.length,
      totalPages: res.total_pages || 1
    };
  }

  // Results at root: { results: [...] }
  if (Array.isArray(res.results)) {
    return {
      results: res.results,
      total: res.total || res.count || res.results.length,
      page: res.page || 1,
      pageSize: res.page_size || res.pageSize || res.results.length,
      totalPages: res.total_pages || 1
    };
  }

  // Bare array: [...]
  if (Array.isArray(res)) {
    return {
      results: res,
      total: res.length,
      page: 1,
      pageSize: res.length,
      totalPages: 1
    };
  }

  return { results: [], total: 0, page: 1, pageSize: 50, totalPages: 1 };
}

export const masterApi = {
  /**
   * POST /master/lst/
   * Returns paginated metadata along with results
   */
  async listPaginated<T = any>(
    entity: MasterEntityType,
    filters: Record<string, any> = {},
    page = 1,
    pageSize = 50
  ): Promise<PaginatedResult<T>> {
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v !== undefined && v !== '' && v !== 'ALL')
    );

    if (entity === 'businessclient') {
      if (cleanFilters.type) cleanFilters.type = String(cleanFilters.type).toLowerCase();
      if (cleanFilters.flag) cleanFilters.flag = String(cleanFilters.flag).toLowerCase();
    }

    const payload = {
      entity,
      filters: cleanFilters,
      page,
      page_size: pageSize
    };

    const res = await apiClient.post<any>('/master/lst/', payload);
    return parsePaginatedResponse<T>(res);
  },

  /**
   * POST /master/lst/
   * List entities returning array of items
   */
  async list<T = any>(
    entity: MasterEntityType,
    filters: Record<string, any> = {},
    page = 1,
    pageSize = 50
  ): Promise<T[]> {
    const paginated = await this.listPaginated<T>(entity, filters, page, pageSize);
    return paginated.results;
  },

  /**
   * POST /master/search/
   * Search entities returning paginated result
   */
  async searchPaginated<T = any>(
    entity: MasterEntityType,
    search: string,
    filters: Record<string, any> = {}
  ): Promise<PaginatedResult<T>> {
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v !== undefined && v !== '' && v !== 'ALL')
    );

    if (entity === 'businessclient') {
      if (cleanFilters.type) cleanFilters.type = String(cleanFilters.type).toLowerCase();
      if (cleanFilters.flag) cleanFilters.flag = String(cleanFilters.flag).toLowerCase();
    }

    const payload = {
      entity,
      search: search.trim(),
      filters: cleanFilters
    };

    const res = await apiClient.post<any>('/master/search/', payload);
    return parsePaginatedResponse<T>(res);
  },

  /**
   * POST /master/search/
   * Search entities with query string and optional filters returning array
   */
  async search<T = any>(
    entity: MasterEntityType,
    search: string,
    filters: Record<string, any> = {}
  ): Promise<T[]> {
    const paginated = await this.searchPaginated<T>(entity, search, filters);
    return paginated.results;
  },

  /**
   * GET /master/get/
   * Retrieve single entity by ID
   */
  async get<T = any>(entity: MasterEntityType, id: number | string): Promise<T> {
    const numericId = typeof id === 'number' ? id : parseInt(String(id).replace(/\D/g, ''), 10) || id;
    const query = `?entity=${encodeURIComponent(entity)}&id=${encodeURIComponent(String(numericId))}`;
    const res = await apiClient.get<any>(`/master/get/${query}`);

    // Handle { success: true, data: { ... } } or { success: true, data: { results: [ ... ] } }
    if (res && res.data) {
      if (Array.isArray(res.data.results) && res.data.results.length > 0) {
        return res.data.results[0];
      }
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data[0];
      }
      return res.data;
    }
    if (res && Array.isArray(res.results) && res.results.length > 0) {
      return res.results[0];
    }
    return res;
  },

  /**
   * POST /master/add/
   * Add a new entity (type and flag for businessclient are lowercased)
   */
  async add<T = any>(entity: MasterEntityType, content: Record<string, any>): Promise<T> {
    const normalizedContent = { ...content };
    if (entity === 'businessclient') {
      if (normalizedContent.type) normalizedContent.type = String(normalizedContent.type).toLowerCase();
      if (normalizedContent.flag) normalizedContent.flag = String(normalizedContent.flag).toLowerCase();
    }
    const payload = {
      entity,
      content: normalizedContent
    };
    const res = await apiClient.post<any>('/master/add/', payload);
    return res?.data ?? res;
  },

  /**
   * PATCH /master/upd/
   * Update an existing entity (type and flag for businessclient are lowercased)
   */
  async update<T = any>(entity: MasterEntityType, id: number | string, content: Record<string, any>): Promise<T> {
    const numericId = typeof id === 'number' ? id : parseInt(String(id).replace(/\D/g, ''), 10) || id;
    const normalizedContent = { ...content };
    if (entity === 'businessclient') {
      if (normalizedContent.type) normalizedContent.type = String(normalizedContent.type).toLowerCase();
      if (normalizedContent.flag) normalizedContent.flag = String(normalizedContent.flag).toLowerCase();
    }
    const payload = {
      entity,
      id: numericId,
      content: normalizedContent
    };
    const res = await apiClient.patch<any>('/master/upd/', payload);
    return res?.data ?? res;
  },

  /**
   * DELETE /master/del/
   * Delete or deactivate entity
   */
  async delete(entity: MasterEntityType, id: number | string): Promise<any> {
    const numericId = typeof id === 'number' ? id : parseInt(String(id).replace(/\D/g, ''), 10) || id;
    const query = `?entity=${encodeURIComponent(entity)}&id=${encodeURIComponent(String(numericId))}`;

    try {
      return await apiClient.delete(`/master/del/${query}`, {
        body: JSON.stringify({ entity, id: numericId }) as any
      });
    } catch (err: any) {
      if (err.status === 405) {
        return await apiClient.post('/master/del/', { entity, id: numericId });
      }
      throw err;
    }
  }
};