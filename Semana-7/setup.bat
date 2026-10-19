@echo off
REM ============================================
REM  Script de creacion de estructura - Semana 07
REM ============================================

REM --- 1. Crear carpetas ---
mkdir src\components 2>nul
mkdir src\contexts   2>nul
mkdir src\hooks      2>nul
mkdir docs           2>nul

REM ============================================
REM  2. .eslintrc.cjs
REM ============================================
(
echo module.exports = {
echo   env: { browser: true, es2021: true, node: true },
echo   extends: [
echo     'eslint:recommended',
echo     'plugin:react/recommended',
echo     'plugin:react-hooks/recommended'
echo   ],
echo   parserOptions: {
echo     ecmaVersion: 'latest',
echo     sourceType: 'module',
echo     ecmaFeatures: { jsx: true }
echo   },
echo   plugins: ['react', 'react-hooks'],
echo   settings: { react: { version: 'detect' } },
echo   rules: {
echo     'react/react-in-jsx-scope': 'off',
echo     'react/prop-types': 'off',
echo     'react-hooks/rules-of-hooks': 'error',
echo     'react-hooks/exhaustive-deps': 'warn'
echo   }
echo }
) > .eslintrc.cjs

REM ============================================
REM  3. src\hooks\useTasksReducer.js
REM ============================================
(
echo export const TASK_ACTIONS = {
echo   ADD: 'ADD',
echo   REMOVE: 'REMOVE',
echo   TOGGLE: 'TOGGLE',
echo   FILTER: 'FILTER',
echo   SORT: 'SORT',
echo   SET_ALL: 'SET_ALL'
echo }
echo.
echo export const initialState = {
echo   items: [],
echo   filter: 'all',
echo   sort: 'asc'
echo }
echo.
echo export function tasksReducer(state, action) {
echo   switch (action.type) {
echo     case TASK_ACTIONS.ADD:
echo       return {
echo         ...state,
echo         items: [
echo           ...state.items,
echo           {
echo             id: crypto.randomUUID(),
echo             title: action.payload,
echo             completed: false,
echo             createdAt: Date.now()
echo           }
echo         ]
echo       }
echo     case TASK_ACTIONS.REMOVE:
echo       return {
echo         ...state,
echo         items: state.items.filter(t =^> t.id !== action.payload)
echo       }
echo     case TASK_ACTIONS.TOGGLE:
echo       return {
echo         ...state,
echo         items: state.items.map(t =^>
echo           t.id === action.payload ? { ...t, completed: !t.completed } : t
echo         )
echo       }
echo     case TASK_ACTIONS.FILTER:
echo       return { ...state, filter: action.payload }
echo     case TASK_ACTIONS.SORT:
echo       return { ...state, sort: action.payload }
echo     case TASK_ACTIONS.SET_ALL:
echo       return { ...state, ...action.payload }
echo     default:
echo       return state
echo   }
echo }
) > src\hooks\useTasksReducer.js

REM ============================================
REM  4. src\hooks\useLocalStorage.js
REM ============================================
(
echo import { useState, useEffect } from 'react'
echo.
echo export const useLocalStorage = (key, defaultValue) =^> {
echo   const [value, setValue] = useState(() =^> {
echo     try {
echo       const item = window.localStorage.getItem(key)
echo       return item ? JSON.parse(item) : defaultValue
echo     } catch (error) {
echo       console.warn('Error leyendo localStorage[' + key + ']', error)
echo       return defaultValue
echo     }
echo   })
echo.
echo   useEffect(() =^> {
echo     try {
echo       window.localStorage.setItem(key, JSON.stringify(value))
echo     } catch (error) {
echo       console.warn('Error guardando localStorage[' + key + ']', error)
echo     }
echo   }, [key, value])
echo.
echo   return [value, setValue]
echo }
) > src\hooks\useLocalStorage.js

REM ============================================
REM  5. src\hooks\useDebounce.js
REM ============================================
(
echo import { useState, useEffect } from 'react'
echo.
echo export const useDebounce = (value, delay = 300) =^> {
echo   const [debounced, setDebounced] = useState(value)
echo.
echo   useEffect(() =^> {
echo     const timer = setTimeout(() =^> setDebounced(value), delay)
echo     return () =^> clearTimeout(timer)
echo   }, [value, delay])
echo.
echo   return debounced
echo }
) > src\hooks\useDebounce.js

REM ============================================
REM  6. src\contexts\ThemeContext.jsx
REM ============================================
(
echo import { createContext, useContext, useEffect } from 'react'
echo import { useLocalStorage } from '../hooks/useLocalStorage'
echo.
echo export const ThemeContext = createContext()
echo.
echo export const ThemeProvider = ({ children }) =^> {
echo   const [theme, setTheme] = useLocalStorage('app-theme', 'light')
echo.
echo   useEffect(() =^> {
echo     document.body.classList.remove('light', 'dark')
echo     document.body.classList.add(theme)
echo     return () =^> {
echo       document.body.classList.remove(theme)
echo     }
echo   }, [theme])
echo.
echo   const toggleTheme = () =^> setTheme(prev =^> (prev === 'light' ? 'dark' : 'light'))
echo.
echo   return (
echo     ^<ThemeContext.Provider value={{ theme, toggleTheme }}^>
echo       {children}
echo     ^</ThemeContext.Provider^>
echo   )
echo }
echo.
echo export const useTheme = () =^> {
echo   const ctx = useContext(ThemeContext)
echo   if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider')
echo   return ctx
echo }
) > src\contexts\ThemeContext.jsx

REM ============================================
REM  7. src\components\TaskList.jsx
REM ============================================
(
echo import { useMemo, useCallback, useRef, useEffect } from 'react'
echo.
echo const TaskList = ({ tasks, filter, sort, search, onRemove, onToggle }) =^> {
echo   const inputRef = useRef(null)
echo.
echo   const processedTasks = useMemo(() =^> {
echo     let result = [...tasks]
echo.
echo     if (filter === 'active') result = result.filter(t =^> !t.completed)
echo     if (filter === 'completed') result = result.filter(t =^> t.completed)
echo.
echo     if (search.trim()) {
echo       result = result.filter(t =^>
echo         t.title.toLowerCase().includes(search.toLowerCase())
echo       )
echo     }
echo.
echo     result.sort((a, b) =^>
echo       sort === 'asc'
echo         ? a.title.localeCompare(b.title)
echo         : b.title.localeCompare(a.title)
echo     )
echo.
echo     return result
echo   }, [tasks, filter, sort, search])
echo.
echo   const handleRemove = useCallback((id) =^> {
echo     onRemove(id)
echo   }, [onRemove])
echo.
echo   const handleToggle = useCallback((id) =^> {
echo     onToggle(id)
echo   }, [onToggle])
echo.
echo   useEffect(() =^> {
echo     if (inputRef.current) inputRef.current.focus()
echo   }, [tasks.length])
echo.
echo   return (
echo     ^<ul className="task-list"^>
echo       {processedTasks.length === 0 ^&^& ^<li^>No hay tareas^</li^>}
echo       {processedTasks.map(task =^> (
echo         ^<li key={task.id} className={task.completed ? 'done' : ''}^>
echo           ^<input
echo             type="checkbox"
echo             checked={task.completed}
echo             onChange={() =^> handleToggle(task.id)}
echo           /^>
echo           ^<span^>{task.title}^</span^>
echo           ^<button onClick={() =^> handleRemove(task.id)}^>Eliminar^</button^>
echo         ^</li^>
echo       ))}
echo       ^<input ref={inputRef} placeholder="Buscar..." /^>
echo     ^</ul^>
echo   )
echo }
echo.
echo export default TaskList
) > src\components\TaskList.jsx

REM ============================================
REM  8. src\App.jsx
REM ============================================
(
echo import { useReducer, useState, useCallback } from 'react'
echo import { tasksReducer, initialState, TASK_ACTIONS } from './hooks/useTasksReducer'
echo import { useDebounce } from './hooks/useDebounce'
echo import { useTheme } from './contexts/ThemeContext'
echo import TaskList from './components/TaskList'
echo import './App.css'
echo.
echo function App() {
echo   const [state, dispatch] = useReducer(tasksReducer, initialState)
echo   const [input, setInput] = useState('')
echo   const [search, setSearch] = useState('')
echo   const { theme, toggleTheme } = useTheme()
echo.
echo   const debouncedSearch = useDebounce(search, 300)
echo.
echo   const handleAdd = useCallback((e) =^> {
echo     e.preventDefault()
echo     if (!input.trim()) return
echo     dispatch({ type: TASK_ACTIONS.ADD, payload: input.trim() })
echo     setInput('')
echo   }, [input])
echo.
echo   const handleRemove = useCallback((id) =^> {
echo     dispatch({ type: TASK_ACTIONS.REMOVE, payload: id })
echo   }, [])
echo.
echo   const handleToggle = useCallback((id) =^> {
echo     dispatch({ type: TASK_ACTIONS.TOGGLE, payload: id })
echo   }, [])
echo.
echo   return (
echo     ^<div className={'app ' + theme}^>
echo       ^<header^>
echo         ^<h1^>Dashboard de Tareas^</h1^>
echo         ^<button onClick={toggleTheme}^>
echo           Tema: {theme === 'light' ? '🌙' : '☀️'}
echo         ^</button^>
echo       ^</header^>
echo.
echo       ^<form onSubmit={handleAdd}^>
echo         ^<input
echo           value={input}
echo           onChange={(e) =^> setInput(e.target.value)}
echo           placeholder="Nueva tarea..."
echo         /^>
echo         ^<button type="submit"^>Añadir^</button^>
echo       ^</form^>
echo.
echo       ^<div className="filters"^>
echo         ^<input
echo           value={search}
echo           onChange={(e) =^> setSearch(e.target.value)}
echo           placeholder="Buscar..."
echo         /^>
echo         ^<select
echo           value={state.filter}
echo           onChange={(e) =^> dispatch({ type: TASK_ACTIONS.FILTER, payload: e.target.value })}
echo         ^>
echo           ^<option value="all"^>Todas^</option^>
echo           ^<option value="active"^>Activas^</option^>
echo           ^<option value="completed"^>Completadas^</option^>
echo         ^</select^>
echo         ^<select
echo           value={state.sort}
echo           onChange={(e) =^> dispatch({ type: TASK_ACTIONS.SORT, payload: e.target.value })}
echo         ^>
echo           ^<option value="asc"^>A-Z^</option^>
echo           ^<option value="desc"^>Z-A^</option^>
echo         ^</select^>
echo       ^</div^>
echo.
echo       ^<TaskList
echo         tasks={state.items}
echo         filter={state.filter}
echo         sort={state.sort}
echo         search={debouncedSearch}
echo         onRemove={handleRemove}
echo         onToggle={handleToggle}
echo       /^>
echo     ^</div^>
echo   )
echo }
echo.
echo export default App
) > src\App.jsx

REM ============================================
REM  9. src\main.jsx
REM ============================================
(
echo import React from 'react'
echo import ReactDOM from 'react-dom/client'
echo import App from './App.jsx'
echo import { ThemeProvider } from './contexts/ThemeContext.jsx'
echo import './index.css'
echo.
echo ReactDOM.createRoot(document.getElementById('root')).render(
echo   ^<React.StrictMode^>
echo     ^<ThemeProvider^>
echo       ^<App /^>
echo     ^</ThemeProvider^>
echo   ^</React.StrictMode^>
echo )
) > src\main.jsx

REM ============================================
REM  10. src\App.css (estilos minimos)
REM ============================================
(
echo body { margin: 0; font-family: system-ui, sans-serif; transition: background 0.3s; }
echo body.light { background: #f5f5f5; color: #222; }
echo body.dark  { background: #1e1e1e; color: #eee; }
echo.
echo .app { max-width: 640px; margin: 0 auto; padding: 2rem; }
echo header { display: flex; justify-content: space-between; align-items: center; }
echo form, .filters { display: flex; gap: 0.5rem; margin: 1rem 0; }
echo input, select, button { padding: 0.5rem; border-radius: 6px; border: 1px solid #999; }
echo .task-list { list-style: none; padding: 0; }
echo .task-list li { display: flex; gap: 0.5rem; align-items: center; padding: 0.4rem 0; }
echo .task-list li.done span { text-decoration: line-through; opacity: 0.6; }
) > src\App.css

REM ============================================
REM  11. src\index.css (reset)
REM ============================================
(
echo * { box-sizing: border-box; }
echo html, body, #root { height: 100%%; }
) > src\index.css

echo.
echo ============================================
echo   ESTRUCTURA CREADA CON EXITO
echo ============================================
echo.
dir /s /b src
echo.
echo Siguiente paso:
echo   npm run dev
echo ============================================