/**
 * SERVICE API FRONTEND
 * Toutes les appels vers le backend MadaBoutique
 */

import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

// Instance Axios configurée
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
});

// Injecter le token JWT dans chaque requête
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Gérer les erreurs 401 (token expiré)
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── AUTH ────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  me:       ()     => api.get('/auth/me')
};

// ─── PRODUITS ────────────────────────────────────────────────
export const productsAPI = {
  getAll:   (params) => api.get('/products', { params }),
  getById:  (id)     => api.get(`/products/${id}`)
};

// ─── COMMANDES ───────────────────────────────────────────────
export const ordersAPI = {
  create:  (data) => api.post('/orders', data),
  getAll:  ()     => api.get('/orders'),
  getById: (id)   => api.get(`/orders/${id}`)
};

// ─── PAIEMENTS ───────────────────────────────────────────────
export const paymentsAPI = {
  initiate:   (data)          => api.post('/payments/initiate', data),
  getStatus:  (transactionId) => api.get(`/payments/${transactionId}/status`)
};

// ─── FACTURES ────────────────────────────────────────────────
export const invoicesAPI = {
  download: (orderId) => `${API_URL}/invoices/${orderId}/download`,
  preview:  (orderId) => `${API_URL}/invoices/${orderId}/preview`
};

export default api;
