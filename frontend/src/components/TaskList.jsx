import React from 'react';
import TaskItem from './TaskItem';

/**
 * TaskList component — renders the list of tasks.
 *
 * @param {{ tasks: Task[], onComplete: (id: string) => void, onDelete: (id: string) => void, deletingId: string|null }} props
 */
function TaskList({ tasks, onComplete, onDelete, deletingId }) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return (
      <div className="task-list task-list--empty">
        <p>No hay tareas.</p>
      </div>
    );
  }

  return (
    <ul className="task-list" aria-label="Lista de tareas">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onComplete={onComplete}
          onDelete={onDelete}
          isDeleting={deletingId === task.id}
        />
      ))}
    </ul>
  );
}

export default TaskList;
