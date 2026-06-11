import { useState, useEffect, useCallback } from 'react';
import {
  listTasks as apiListTasks,
  createTask as apiCreateTask,
  completeTask as apiCompleteTask,
  deleteTask as apiDeleteTask,
} from '../api/tasksApi';

/**
 * Custom hook for managing tasks state and API interactions.
 * @returns {{ tasks: Task[], loading: boolean, error: string|null, createTask: Function, completeTask: Function, deleteTask: Function, deletingId: string|null }}
 */
export default function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTasks() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiListTasks();
        if (!cancelled) {
          setTasks(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Error al cargar las tareas');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchTasks();

    return () => {
      cancelled = true;
    };
  }, []);

  const createTask = useCallback(async (titulo) => {
    const trimmed = typeof titulo === 'string' ? titulo.trim() : '';
    if (!trimmed) {
      setError('El título de la tarea no puede estar vacío');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const newTask = await apiCreateTask(trimmed);
      setTasks((prev) => [newTask, ...prev]);
    } catch (err) {
      setError(err.message || 'Error al crear la tarea');
    } finally {
      setLoading(false);
    }
  }, []);

  const completeTask = useCallback(async (id) => {
    setError(null);
    try {
      const updatedTask = await apiCompleteTask(id);
      setTasks((prev) =>
        prev.map((task) => (task.id === id ? updatedTask : task))
      );
    } catch (err) {
      setError(err.message || 'Error al completar la tarea');
    }
  }, []);

  const deleteTask = useCallback(async (id) => {
    setDeletingId(id);
    setError(null);
    try {
      await apiDeleteTask(id);
      setTasks((prev) => prev.filter((task) => task.id !== id));
    } catch (err) {
      setError(err.message || 'Error al eliminar la tarea');
    } finally {
      setDeletingId(null);
    }
  }, []);

  return {
    tasks,
    loading,
    error,
    createTask,
    completeTask,
    deleteTask,
    deletingId,
  };
}
