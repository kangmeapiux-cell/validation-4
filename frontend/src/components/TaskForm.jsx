import React, { useState } from 'react';

/**
 * TaskForm component — controlled form for creating a new task.
 *
 * @param {{ onSubmit: (titulo: string) => Promise<void>, loading: boolean }} props
 */
function TaskForm({ onSubmit, loading }) {
  const [titulo, setTitulo] = useState('');
  const [inputError, setInputError] = useState('');

  /**
   * Handles form submission:
   * 1. Prevents default browser submit.
   * 2. Validates that titulo is non-empty after trimming.
   * 3. Calls onSubmit(titulo) and clears the input on success.
   *
   * @param {React.FormEvent<HTMLFormElement>} e
   */
  async function handleSubmit(e) {
    e.preventDefault();

    const trimmed = titulo.trim();

    if (!trimmed) {
      setInputError('El título no puede estar vacío');
      return;
    }

    setInputError('');

    try {
      await onSubmit(trimmed);
      setTitulo('');
    } catch {
      // Errors from onSubmit are handled by the useTasks hook (global error state).
      // We intentionally do NOT clear the input so the user can retry.
    }
  }

  /**
   * Clears the inline validation error as soon as the user starts typing again.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e
   */
  function handleChange(e) {
    setTitulo(e.target.value);
    if (inputError) {
      setInputError('');
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit} noValidate>
      <div className="task-form__field">
        <input
          className={`task-form__input${inputError ? ' task-form__input--error' : ''}`}
          type="text"
          value={titulo}
          onChange={handleChange}
          placeholder="Nueva tarea…"
          aria-label="Título de la tarea"
          aria-describedby={inputError ? 'task-form-error' : undefined}
          disabled={loading}
          maxLength={200}
        />
        <button
          className="task-form__button"
          type="submit"
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? 'Agregando…' : 'Agregar'}
        </button>
      </div>
      {inputError && (
        <p
          id="task-form-error"
          className="task-form__error"
          role="alert"
          aria-live="polite"
        >
          {inputError}
        </p>
      )}
    </form>
  );
}

export default TaskForm;
