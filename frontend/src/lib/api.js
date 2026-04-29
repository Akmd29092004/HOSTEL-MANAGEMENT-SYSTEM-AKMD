import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: `${BACKEND}/api`,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("hms_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
export const API_BASE = `${BACKEND}/api`;
