import axios from "axios";

const BASE = "http://localhost:5163/api";
const AI = "http://localhost:8000";

export const api = {
  // Events
  getEvents: () => axios.get(`${BASE}/events`),

  // Ticketing
  purchase: (data: {
    userId: number;
    ticketTypeId: number;
    quantity: number;
    idempotencyKey: string;
  }) => axios.post(`${BASE}/ticketing/purchase`, data),

  getStock: (ticketTypeId: number) =>
    axios.get(`${BASE}/ticketing/stock/${ticketTypeId}`),
  payOrder: (orderId: number) =>
    axios.post(`${BASE}/ticketing/pay/${orderId}`),
  getUserOrders: (userId: number) =>
    axios.get(`${BASE}/ticketing/orders/user/${userId}`),

  // Admin
  getAuditQueue: (userId: number) =>
    axios.get(`${BASE}/admin/audit-queue`, { params: { userId } }),
  resolveAudit: (userId: number, id: number) =>
    axios.put(`${BASE}/admin/audit-queue/${id}/resolve`, {}, { params: { userId } }),
  blockUser: (userId: number, targetUserId: number, reason: string) =>
    axios.post(`${BASE}/admin/blacklist/${targetUserId}`,
      JSON.stringify(reason), {
        params: { userId },
        headers: { "Content-Type": "application/json" }
      }),
  getBlacklist: (userId: number) =>
    axios.get(`${BASE}/admin/blacklist`, { params: { userId } }),
  getMe: (userId: number) => axios.get(`/api/auth/me/${userId}`),

  // Order Dashboard
  getDashboard: (userId: number) =>
    axios.get(`${BASE}/admin/dashboard`, { params: { userId } }),
  getOrders: (userId: number, status?: string, page?: number) =>
    axios.get(`${BASE}/admin/orders`, { params: { userId, status, page } }),
  updateOrderStatus: (id: number, status: string) =>
    axios.put(`${BASE}/admin/orders/${id}/status`, JSON.stringify(status), {
        headers: { "Content-Type": "application/json" },
    }),
  getInventory: (userId: number) =>
    axios.get(`${BASE}/admin/inventory`, { params: { userId } }),
  adjustStock: (userId: number, ticketTypeId: number, newStock: number) =>
    axios.put(`${BASE}/admin/inventory/${ticketTypeId}/adjust`,
      newStock, {
        params: { userId },
        headers: { "Content-Type": "application/json" }
      }),

  // AI
  chat: (data: { userId: number; message: string; history: any[] }) =>
    axios.post(`${AI}/agent/chat`, data),

  // login & register
  login: (username: string, password: string) =>
    axios.post(`${BASE}/auth/login`, { username, password }),
  register: (username: string, email: string, password: string) =>
    axios.post(`${BASE}/auth/register`, { username, email, password }),
};