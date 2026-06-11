// Implements the API functions for tasks
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || ''
});

export async function listTasks() {
  const res = await apiClient.get('/tareas');
  if (res.data && res.data.success && Array.isArray(res.data.data)) {
    return res.data.data;
  }
  throw new Error(res.data && res.data.error ? res.data.error : 'Error al obtener tareas');
}

export async function createTask(titulo) {
  const res = await apiClient.post('/tareas', { titulo });
  if (res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  throw new Error(res.data && res.data.error ? res.data.error : 'Error al crear tarea');
}

export async function completeTask(id) {
  const res = await apiClient.put(`/tareas/${id}/completar`);
  if (res.data && res.data.success && res.data.data) {
    return res.data.data;
  }
  throw new Error(res.data && res.data.error ? res.data.error : 'Error al completar tarea');
}

export async function deleteTask(id) {
  const res = await apiClient.delete(`/tareas/${id}`);
  if (res.data && res.data.success) {
    return true;
  }
  throw new Error(res.data && res.data.error ? res.data.error : 'Error al eliminar tarea');
}
