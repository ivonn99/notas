import { http } from './http.js'

export const profileApi = {
  getMe: () => http('/api/profile/me'),
  changePassword: (currentPassword, newPassword) =>
    http('/api/profile/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
}
