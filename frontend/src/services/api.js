import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Authentication APIs
export const authAPI = {
  register: (userData) => api.post('/api/auth/register', userData),
  login: (credentials) => api.post('/api/auth/login', credentials),
  verify: () => api.get('/api/auth/verify')
};

// Chat APIs
export const chatAPI = {
  getUsers: () => api.get('/api/chat/users'),
  getDirectMessages: (userId, limit = 50) => 
    api.get(`/api/chat/direct-messages/${userId}`, { params: { limit } }),
  getGroups: () => api.get('/api/chat/groups'),
  createGroup: (groupData) => api.post('/api/chat/groups', groupData),
  getGroupMessages: (groupId, limit = 50) => 
    api.get(`/api/chat/group-messages/${groupId}`, { params: { limit } }),
  getGroupMembers: (groupId) => api.get(`/api/chat/group-members/${groupId}`)
};

export default api;