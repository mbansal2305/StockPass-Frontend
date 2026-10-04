import { apiClient } from './client';
import { User, UserRole } from '../types';

export interface LoginResponse {
  access_token?: string;
  refresh_token?: string;
  access?: string;
  refresh?: string;
  token?: string;
  user?: any;
  data?: any;
  username?: string;
}

export function normalizeRole(rawRole: any): UserRole | null {
  if (!rawRole) return null;
  const roleValue = typeof rawRole === 'object'
    ? rawRole.name || rawRole.value || rawRole.code
    : rawRole;
  const str = String(roleValue || '').toUpperCase();
  if (str.includes('OWNER') || str === 'ADMIN') return 'OWNER';
  if (str.includes('ACCOUNTANT') || str.includes('FINANCE')) return 'ACCOUNTANT';
  if (str.includes('LABOUR')) return 'LABOUR';
  return null;
}

export function transformBackendUser(raw: any, fallbackUser?: User): User {
  if (!raw) {
    return {
      id: 'usr-unknown',
      username: 'user',
      name: 'User',
      role: 'LABOUR',
      status: 'ACTIVE'
    };
  }

  const userData = raw.user || raw.data?.user || raw.data || raw;
  const rawId = userData.id || userData.pk || userData.user_id;
  const id = String(rawId || 'usr-' + Date.now());
  const username = userData.username || userData.email || 'user';
  const matchesFallback = fallbackUser && (
    (rawId && String(rawId) === fallbackUser.id) ||
    (username !== 'user' && username.toLowerCase() === fallbackUser.username.toLowerCase())
  );
  const firstName = userData.first_name || '';
  const lastName = userData.last_name || '';
  const fullName = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : (userData.name || username);

  return {
    id,
    username,
    name: fullName,
    first_name: firstName,
    last_name: lastName,
    email: userData.email || null,
    phone_number: userData.phone_number || userData.phone || null,
    gender_code: userData.gender_code || null,
    profile_picture: userData.profile_picture || null,
    role: normalizeRole(
      userData.role ?? userData.user_role ?? userData.role_name ?? userData.account_type ?? userData.user_type
    ) || (matchesFallback ? fallbackUser.role : 'LABOUR'),
    status: (userData.is_active === false || userData.status === 'DISABLED') ? 'DISABLED' : 'ACTIVE',
    createdAt: userData.created_at || userData.date_joined || new Date().toISOString().split('T')[0]
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
    if (data.user || data.data?.user || data.data?.username || data.username) {
      user = transformBackendUser(data.user || data.data?.user || data.data || data);
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
  async getMe(fallbackUser?: User): Promise<User> {
    const data = await apiClient.get<any>('/auth/me/');
    return transformBackendUser(data, fallbackUser);
  },

  /**
   * POST api/auth/refresh
   * Body: { refresh_token }
   */
  async refresh(): Promise<string | null> {
    return apiClient.refreshAccessToken();
  }
};
