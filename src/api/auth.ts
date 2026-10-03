import { apiClient } from './client';
import { User, UserRole } from '../types';

export interface LoginResponse {
  access_token?: string;
  refresh_token?: string;
  access?: string;
  refresh?: string;
  token?: string;
  user?: any;
}

export function normalizeRole(rawRole: any): UserRole {
  if (!rawRole) return 'LABOUR';
  const str = String(rawRole).toUpperCase();
  if (str.includes('OWNER') || str === 'ADMIN') return 'OWNER';
  if (str.includes('ACCOUNTANT') || str.includes('FINANCE')) return 'ACCOUNTANT';
  return 'LABOUR';
}

export function transformBackendUser(raw: any): User {
  if (!raw) {
    return {
      id: 'usr-unknown',
      username: 'user',
      name: 'User',
      role: 'LABOUR',
      status: 'ACTIVE'
    };
  }

  const id = String(raw.id || raw.pk || raw.user_id || 'usr-' + Date.now());
  const username = raw.username || raw.email || 'user';
  const firstName = raw.first_name || '';
  const lastName = raw.last_name || '';
  const fullName = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : (raw.name || username);

  return {
    id,
    username,
    name: fullName,
    first_name: firstName,
    last_name: lastName,
    email: raw.email || null,
    phone_number: raw.phone_number || raw.phone || null,
    gender_code: raw.gender_code || null,
    profile_picture: raw.profile_picture || null,
    role: normalizeRole(raw.role),
    status: (raw.is_active === false || raw.status === 'DISABLED') ? 'DISABLED' : 'ACTIVE',
    createdAt: raw.created_at || raw.date_joined || new Date().toISOString().split('T')[0]
  };
}

export const authApi = {
  /**
   * POST api/auth/login
   * Body: { username, password }
   */
  async login(username: string, password: string): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string } }> {
    const data = await apiClient.post<LoginResponse>('/auth/login/', {
      username: username.trim(),
      password
    });

    const accessToken = data.access_token || data.access || data.token || '';
    const refreshToken = data.refresh_token || data.refresh || '';

    if (accessToken) {
      apiClient.setTokens({ accessToken, refreshToken });
    }

    // Attempt to get current user details
    let user: User;
    if (data.user) {
      user = transformBackendUser(data.user);
    } else {
      try {
        user = await authApi.getMe();
      } catch {
        user = transformBackendUser({ username, id: 'usr-current' });
      }
    }

    return { user, tokens: { accessToken, refreshToken } };
  },

  /**
   * POST api/auth/logout
   * Body: { refresh_token }
   */
  async logout(): Promise<void> {
    const refreshToken = apiClient.getRefreshToken();
    try {
      if (refreshToken) {
        await apiClient.post('/auth/logout/', {
          refresh_token: refreshToken
        });
      }
    } catch (e) {
      console.warn('Backend logout request failed (continuing local logout):', e);
    } finally {
      apiClient.clearTokens();
    }
  },

  /**
   * GET api/auth/me
   */
  async getMe(): Promise<User> {
    const data = await apiClient.get<any>('/auth/me/');
    return transformBackendUser(data);
  },

  /**
   * POST api/auth/refresh
   * Body: { refresh_token }
   */
  async refresh(): Promise<string | null> {
    return apiClient.refreshAccessToken();
  }
};
