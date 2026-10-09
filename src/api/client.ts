/**
 * HTTP Client Wrapper with automatic Token Refresh, Ngrok bypass headers,
 * and comprehensive error handling.
 */

// const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
// const BASE_URL = '/api';
const BASE_URL = "https://sharply-wriggly-curvy.ngrok-free.dev/api";


const TOKEN_STORAGE_KEY = 'vistar_auth_tokens_v1';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

class ApiClient {
  private baseUrl: string;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string | null) => void> = [];

  constructor(baseUrl: string) {
    // Ensure no trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  public getTokens(): StoredTokens | null {
    try {
      const data = localStorage.getItem(TOKEN_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  public setTokens(tokens: { accessToken: string; refreshToken: string }): void {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    } catch (e) {
      console.error('Failed to save auth tokens', e);
    }
  }

  public clearTokens(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear auth tokens', e);
    }
  }

  public getAccessToken(): string | null {
    return this.getTokens()?.accessToken || null;
  }

  public getRefreshToken(): string | null {
    return this.getTokens()?.refreshToken || null;
  }

  private onTokenRefreshed(token: string | null) {
    this.refreshSubscribers.forEach(cb => cb(token));
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(cb: (token: string | null) => void) {
    this.refreshSubscribers.push(cb);
  }

  /**
   * Refresh the access token using the stored refresh_token
   */
  public async refreshAccessToken(): Promise<string | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearTokens();
      return null;
    }

    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if (!res.ok) {
        // Try fallback payload { refresh: refreshToken } in case backend uses simplejwt
        const altRes = await fetch(`${this.baseUrl}/auth/refresh/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({ refresh: refreshToken })
        });

        if (!altRes.ok) {
          throw new Error('Refresh token invalid or expired');
        }
        const data = await altRes.json();
        const newAccess = data.access_token || data.access || data.token;
        const newRefresh = data.refresh_token || data.refresh || refreshToken;

        if (newAccess) {
          this.setTokens({ accessToken: newAccess, refreshToken: newRefresh });
          return newAccess;
        }
        return null;
      }

      const data = await res.json();
      const newAccess = data.access_token || data.access || data.token;
      const newRefresh = data.refresh_token || data.refresh || refreshToken;

      if (newAccess) {
        this.setTokens({ accessToken: newAccess, refreshToken: newRefresh });
        return newAccess;
      }
      return null;
    } catch (err) {
      console.warn('Token refresh failed:', err);
      this.clearTokens();
      return null;
    }
  }

  /**
   * Main request method with retry on 401
   */
  public async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
    retryOnAuthFailure = true
  ): Promise<T> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      'ngrok-skip-browser-warning': 'true',
      ...(options.headers as Record<string, string> || {})
    };
    if (isFormData) delete headers['Content-Type'];

    const token = this.getAccessToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      // Handle 401 Unauthorized with automatic refresh
      if (response.status === 401 && retryOnAuthFailure && !cleanEndpoint.includes('/auth/login') && !cleanEndpoint.includes('/auth/refresh')) {
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          const newToken = await this.refreshAccessToken();
          this.isRefreshing = false;
          this.onTokenRefreshed(newToken);

          if (newToken) {
            headers['Authorization'] = `Bearer ${newToken}`;
            return this.request<T>(endpoint, { ...options, headers }, false);
          } else {
            // Force logout trigger
            window.dispatchEvent(new CustomEvent('api:auth_expired'));
            throw new Error('Session expired. Please log in again.');
          }
        } else {
          // Wait for the active refresh to finish
          return new Promise<T>((resolve, reject) => {
            this.addRefreshSubscriber(newToken => {
              if (newToken) {
                headers['Authorization'] = `Bearer ${newToken}`;
                resolve(this.request<T>(endpoint, { ...options, headers }, false));
              } else {
                reject(new Error('Session expired. Please log in again.'));
              }
            });
          });
        }
      }

      // Parse JSON response or handle error
      let data: any = null;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      if (!response.ok) {
        let errorMsg = 'An error occurred';
        if (typeof data === 'object' && data !== null) {
          errorMsg = data.detail || data.message || data.error || (Array.isArray(data) ? data.join(', ') : JSON.stringify(data));
        } else if (typeof data === 'string' && data.length > 0) {
          errorMsg = data;
        }
        const error: any = new Error(errorMsg);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data as T;
    } catch (err: any) {
      throw err;
    }
  }

  // Convenience methods
  public get<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  }

  public postForm<T = any>(endpoint: string, body: FormData): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body });
  }

  public patch<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  }

  public patchForm<T = any>(endpoint: string, body: FormData): Promise<T> {
    return this.request<T>(endpoint, { method: 'PATCH', body });
  }

  public put<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  }

  public delete<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(BASE_URL);
