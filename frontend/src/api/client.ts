/// <reference types="vite/client" />
import axios from 'axios';

const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== 'undefined') {
    // If accessed through Nginx (port 3000 or production port 80):
    // Use relative '/api' so it works identically on localhost, LAN IP (e.g. 192.168.x.x), or domain
    if (window.location.port === '3000' || window.location.port === '80' || !window.location.port) {
      return '/api';
    }
    // Fallback for standalone vite dev server (port 5173):
    return `http://${window.location.hostname}:8000/api`;
  }
  return 'http://localhost:8000/api';
};

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  const userId = localStorage.getItem('user_id');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (userId) {
    config.headers['X-User-Id'] = userId;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('user_data');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
