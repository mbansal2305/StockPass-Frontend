import { apiClient } from './client';
import { User, UserCreatePayload, UserUpdatePayload } from '../types';
import { transformBackendUser } from './auth';

export const usersApi = {
  /**
   * GET api/users/ -> get all users list
   */
  async getUsers(): Promise<User[]> {
    const data = await apiClient.get<any>('/users/');
    const list = Array.isArray(data) ? data : (data.results || data.users || data.data || []);
    return list.map(transformBackendUser);
  },

  /**
   * GET api/users/{user_id}
   */
  async getUserById(userId: string): Promise<User> {
    const data = await apiClient.get<any>(`/users/${userId}/`);
    return transformBackendUser(data);
  },

  /**
   * POST api/users/ -> create user
   * Schema:
   *  username: str
   *  password: str
   *  role: User.Role = User.Role.LABOUR
   *  first_name: str = ""
   *  last_name: str = ""
   *  email: Optional[str] = None
   *  phone_number: Optional[str] = None
   *  gender_code: Optional[str] = None
   *  profile_picture: Optional[str] = None
   */
  async createUser(payload: UserCreatePayload): Promise<User> {
    const body: Record<string, any> = {
      username: payload.username.trim(),
      password: payload.password,
      role: payload.role || 'LABOUR',
      first_name: payload.first_name || '',
      last_name: payload.last_name || ''
    };

    if (payload.email) body.email = payload.email.trim();
    if (payload.phone_number) body.phone_number = payload.phone_number.trim();
    if (payload.gender_code) body.gender_code = payload.gender_code;
    if (payload.profile_picture) body.profile_picture = payload.profile_picture;

    const res = await apiClient.post<any>('/users/', body);
    return transformBackendUser(res);
  },

  /**
   * PATCH api/users/{user_id} -> update user
   * Schema:
   *  role: Optional[str] = None
   *  first_name: Optional[str] = None
   *  last_name: Optional[str] = None
   *  email: Optional[str] = None
   *  phone_number: Optional[str] = None
   *  gender_code: Optional[str] = None
   *  profile_picture: Optional[str] = None
   */
  async updateUser(userId: string, payload: UserUpdatePayload): Promise<User> {
    const body: Record<string, any> = {};

    if (payload.role !== undefined) body.role = payload.role;
    if (payload.first_name !== undefined) body.first_name = payload.first_name;
    if (payload.last_name !== undefined) body.last_name = payload.last_name;
    if (payload.email !== undefined) body.email = payload.email;
    if (payload.phone_number !== undefined) body.phone_number = payload.phone_number;
    if (payload.gender_code !== undefined) body.gender_code = payload.gender_code;
    if (payload.profile_picture !== undefined) body.profile_picture = payload.profile_picture;

    const res = await apiClient.patch<any>(`/users/${userId}/`, body);
    return transformBackendUser(res);
  },

  /**
   * POST api/users/{user_id}/password/ -> Change User Password
   * Schema:
   * {
   *   "new_password": "password"
   * }
   */
  async changePassword(userId: string, newPassword: string): Promise<any> {
    const payload = { new_password: newPassword };
    try {
      return await apiClient.post<any>(`/users/${userId}/password/`, payload);
    } catch (err: any) {
      // If 405 Method Not Allowed, fallback to PATCH or PUT
      if (err.status === 405) {
        try {
          return await apiClient.patch<any>(`/users/${userId}/password/`, payload);
        } catch {
          return await apiClient.put<any>(`/users/${userId}/password/`, payload);
        }
      }
      throw err;
    }
  }
};
