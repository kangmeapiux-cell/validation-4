import React from 'react';
import useTasks from './hooks/useTasks';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';
import ErrorBanner from './components/ErrorBanner';

function App() {
  const { tasks, loading, error, createTask, completeTask, deleteTask, deletingId } = useTasks();

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Lista de Tareas</h1>
      </header>
      <main className="app-main">
        <ErrorBanner error={error} />
        <TaskForm onSubmit={createTask} loading={loading} />
        {loading && tasks.length === 0 ? (
          <div className="loading-spinner">
            <span className="spinner" aria-label="Cargando tareas"></span>
            <p>Cargando tareas...</p>
          </div>
        ) : (
          <TaskList
            tasks={tasks}
            onComplete={completeTask}
            onDelete={deleteTask}
            deletingId={deletingId}
          />
        )}
      </main>
    </div>
  );
}

export default App;
