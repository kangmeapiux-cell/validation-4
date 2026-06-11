import React from 'react';

/**
 * TaskItem component — renders a single task row.
 *
 * @param {{
 *   task: Task,
 *   onComplete: (id: string) => void,
 *   onDelete: (id: string) => void,
 *   isDeleting: boolean
 * }} props
 */
function TaskItem({ task, onComplete, onDelete, isDeleting }) {
  return (
    <li className={`task-item${task.completada ? ' task-item--completed' : ''}${isDeleting ? ' task-item--deleting' : ''}`}>
      <label className="task-item__label">
        <input
          className="task-item__checkbox"
          type="checkbox"
          checked={task.completada}
          onChange={() => onComplete(task.id)}
          disabled={task.completada || isDeleting}
          aria-label={`Marcar como completada: ${task.titulo}`}
        />
        <span className={`task-item__title${task.completada ? ' completed' : ''}`}>
          {task.titulo}
        </span>
      </label>
      <button
        className="task-item__delete-btn"
        type="button"
        onClick={() => onDelete(task.id)}
        disabled={isDeleting}
        aria-label={`Eliminar tarea: ${task.titulo}`}
        aria-busy={isDeleting}
      >
        {isDeleting ? 'Eliminando...' : 'Eliminar'}
      </button>
    </li>
  );
}

export default TaskItem;
