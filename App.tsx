import React, { useState, useCallback, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import TrainingScreen from './components/TrainingScreen';
import ResultsScreen from './components/ResultsScreen';
import ExaminerSetupScreen from './components/ExaminerSetupScreen';
import AdminDashboard from './components/AdminDashboard';
import Dashboard from './components/Dashboard';
import Toast from './components/Toast';
import ThemeSwitcher from './components/ThemeSwitcher';
import type { UserResult, TrainingImage, User, Role, TrainingAttempt, AppBackup } from './types';
import { View } from './types';

type Theme = 'light' | 'dark' | 'system';

const API_BASE_URL = 'http://localhost:3001';

const App: React.FC = () => {
  const [view, setView] = useState<View>(View.Login);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [results, setResults] = useState<UserResult[]>([]);
  const [trainingData, setTrainingData] = useState<TrainingImage[]>([]);
  const [allAttempts, setAllAttempts] = useState<TrainingAttempt[]>([]);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'system');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const root = window.document.documentElement;
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    root.classList.toggle('dark', isDark);
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  // Also listen for system changes
  useEffect(() => {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
          if (localStorage.getItem('theme') === 'system' || !localStorage.getItem('theme')) {
              document.documentElement.classList.toggle('dark', mediaQuery.matches);
          }
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Load all data from the backend on initial render
  const loadInitialData = useCallback(async () => {
      setIsLoading(true);
      try {
          const response = await fetch(`${API_BASE_URL}/api/data`);
          if (!response.ok) throw new Error('Failed to fetch data from server.');
          const data = await response.json();
          setUsers(data.users);
          setTrainingData(data.trainingData);
          setAllAttempts(data.allAttempts);
      } catch (error) {
          console.error("Failed to load initial data:", error);
          showToast(error instanceof Error ? error.message : 'Could not connect to the server.', 'error');
      } finally {
          setIsLoading(false);
      }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);


  const showToast = useCallback((text: string, type: 'success' | 'error') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const handleLogin = useCallback(async (username: string, password: string): Promise<boolean> => {
    setLoginError(null);
    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Invalid username or password.');
        }
        const user = await response.json();
        setCurrentUser(user);
        setView(View.Dashboard);
        return true;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown login error occurred.';
        setLoginError(errorMessage);
        return false;
    }
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    setView(View.Login);
  }, []);

  const handleTrainingComplete = useCallback(async (finalResults: UserResult[]) => {
    if (!currentUser) return;

    const totalItems = finalResults.reduce((sum, result) => sum + result.items.length, 0);
    const correctItems = finalResults.reduce((sum, result) => sum + result.items.filter(item => item.isCorrect).length, 0);
    const totalTime = finalResults.reduce((sum, result) => sum + result.timeTaken, 0);
    const accuracy = totalItems > 0 ? parseFloat(((correctItems / totalItems) * 100).toFixed(1)) : 0.0;
    
    const newAttempt: Omit<TrainingAttempt, 'id'> = {
      username: currentUser.username,
      timestamp: Date.now(),
      results: finalResults,
      totalTime,
      totalItems,
      correctItems,
      accuracy,
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/attempts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newAttempt),
        });
        if (!response.ok) throw new Error('Failed to save training attempt.');
        const savedAttempt = await response.json();
        setAllAttempts(prev => [...prev, savedAttempt]);
        setResults(finalResults);
        setView(View.Results);
    } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not save results.', 'error');
    }
  }, [currentUser, showToast]);

  const handleSaveTrainingData = useCallback(async (data: TrainingImage[]) => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/training-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to save training data.');
        setTrainingData(data); // Optimistic update
        showToast('Training data saved successfully!', 'success');
    } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to save data.', 'error');
    }
  }, [showToast]);
  
  const handleSaveUsers = useCallback(async (updatedUsers: User[]) => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedUsers),
        });
        if (!response.ok) throw new Error('Failed to save user data.');
        const savedUsers = await response.json();
        setUsers(savedUsers);
      } catch (error) {
          showToast(error instanceof Error ? error.message : 'Failed to save user data.', 'error');
      }
  }, [showToast]);

  const handleBackToDashboard = useCallback(() => {
    setView(View.Dashboard);
  }, []);

  const handleRestartTraining = useCallback(() => {
    setResults([]);
    setView(View.Dashboard);
  }, []);

  const handleExportData = useCallback(async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/export`);
        if (!response.ok) throw new Error('Failed to fetch export data.');
        const backupData: AppBackup = await response.json();
        
        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `edms-fdf-training-backup-${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Data exported successfully!', 'success');
    } catch (error) {
        showToast(error instanceof Error ? error.message : 'An unexpected error occurred during export.', 'error');
    }
  }, [showToast]);

  const handleImportData = useCallback(async (jsonString: string) => {
      try {
          const data: AppBackup = JSON.parse(jsonString);
          if (!data || !Array.isArray(data.users) || !Array.isArray(data.trainingData) || !Array.isArray(data.attempts)) {
              throw new Error('Invalid backup file structure.');
          }

          const response = await fetch(`${API_BASE_URL}/api/import`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
          });

          if (!response.ok) throw new Error('Failed to import data on the server.');
          
          showToast('Data imported successfully! Reloading application...', 'success');
          // Reload data from server to reflect changes
          setTimeout(loadInitialData, 1500);

      } catch (error) {
          showToast(error instanceof Error ? error.message : 'Failed to import data. The file might be corrupted.', 'error');
      }
  }, [showToast, loadInitialData]);

  const renderView = () => {
    if (isLoading) {
        return (
            <div className="text-center p-10">
                <h2 className="text-xl text-gray-600 dark:text-gray-400">Loading Application Data...</h2>
            </div>
        );
    }

    if (!currentUser) {
        return <LoginScreen onLogin={handleLogin} error={loginError} />;
    }

    switch (view) {
      case View.Dashboard:
        return <Dashboard user={currentUser} setView={setView} onExportData={handleExportData} onImportData={handleImportData} />;
      case View.AdminDashboard:
        return <AdminDashboard currentUser={currentUser} users={users} onSave={handleSaveUsers} onBack={handleBackToDashboard} showToast={showToast} />;
      case View.ExaminerSetup:
        return <ExaminerSetupScreen initialData={trainingData} onSave={handleSaveTrainingData} onBack={handleBackToDashboard} showToast={showToast} />;
      case View.Training:
        return <TrainingScreen trainingData={trainingData} onComplete={handleTrainingComplete} onQuit={handleBackToDashboard} />;
      case View.Results:
        const userAttempts = allAttempts.filter(attempt => attempt.username === currentUser.username);
        return <ResultsScreen 
            username={currentUser.username} 
            results={results} 
            trainingData={trainingData} 
            onRestart={handleRestartTraining}
            userAttempts={userAttempts} 
        />;
      default:
        return <Dashboard user={currentUser} setView={setView} onExportData={handleExportData} onImportData={handleImportData} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300">
      <header className="bg-white dark:bg-gray-800 shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-cyan-500 dark:text-cyan-400">Support Training for EDMS-FDF</h1>
          {currentUser && (
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                User: <span className="font-semibold text-gray-800 dark:text-gray-200">{currentUser.username}</span> 
                (<span className="italic text-cyan-500 dark:text-cyan-400">{currentUser.role}</span>)
              </div>
              <ThemeSwitcher theme={theme} setTheme={setTheme} />
              <button onClick={handleLogout} className="text-sm bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-1 px-3 rounded-md transition-colors">Logout</button>
            </div>
          )}
        </div>
      </header>
      <main className="container mx-auto p-4 md:p-8">
        {renderView()}
      </main>
      {toast && <Toast message={toast.text} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default App;
