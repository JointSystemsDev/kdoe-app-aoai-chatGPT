import React, { createContext, useState, useEffect, useContext } from 'react';
import { fetchEnvironments } from '../api';

interface Environment {
  id: string;
  name: string;
}

interface EnvironmentContextType {
  environments: Environment[];
  selectedEnvironment: string | null;
  setSelectedEnvironment: (id: string) => void;
  isLoading: boolean;
  error: string | null;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

const INTENDED_ENV_KEY = 'intended_environment';

export const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Helper function to get environment from URL
  const getEnvironmentFromUrl = (): string | null => {
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(hash.split('?')[1] || '');
    return searchParams.get('env');
  };

  // Helper function to update URL with environment
  const updateUrlWithEnvironment = (envId: string) => {
    const hash = window.location.hash;
    const [basePath, search] = hash.split('?');
    const searchParams = new URLSearchParams(search || '');
    searchParams.set('env', envId);
    
    // Preserve the base hash path (everything before the ?)
    const newHash = `${basePath || '#/'}?${searchParams.toString()}`;
    window.location.hash = newHash;
  };

  // Store intended environment before auth redirect
  const storeIntendedEnvironment = (envId: string) => {
    sessionStorage.setItem(INTENDED_ENV_KEY, envId);
  };

  // Retrieve and clear intended environment
  const getAndClearIntendedEnvironment = (): string | null => {
    const envId = sessionStorage.getItem(INTENDED_ENV_KEY);
    sessionStorage.removeItem(INTENDED_ENV_KEY);
    return envId;
  };

  useEffect(() => {
    const initializeEnvironments = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchEnvironments();
        setEnvironments(data);
        
        if (data.length === 0) {
          setError('No environments available.');
          setIsLoading(false);
          return;
        }

        // Check for intended environment from previous auth redirect
        const intendedEnv = getAndClearIntendedEnvironment();
        if (intendedEnv && data.some(env => env.id === intendedEnv)) {
          setSelectedEnvironment(intendedEnv);
          updateUrlWithEnvironment(intendedEnv);
          setIsInitialized(true);
          setIsLoading(false);
          return;
        }

        // Check URL parameter
        const urlEnv = getEnvironmentFromUrl();
        if (urlEnv && data.some(env => env.id === urlEnv)) {
          // Store the intended environment before potential auth redirect
          storeIntendedEnvironment(urlEnv);
          setSelectedEnvironment(urlEnv);
        } else {
          // Default to first environment if no valid URL parameter
          setSelectedEnvironment(data[0].id);
          updateUrlWithEnvironment(data[0].id);
        }

        setIsInitialized(true);
      } catch (err) {
        setError('Failed to load environments. Please try again later.');
        console.error('Error loading environments:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (!isInitialized) {
      initializeEnvironments();
    }
  }, [isInitialized]);

  useEffect(() => {
    const handleHashChange = () => {
      const envId = getEnvironmentFromUrl();
      if (envId && environments.some(env => env.id === envId) && envId !== selectedEnvironment) {
        storeIntendedEnvironment(envId);
        setSelectedEnvironment(envId);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [environments, selectedEnvironment]);

  const setEnvironment = (environmentId: string) => {
    if (environments.some(env => env.id === environmentId)) {
      storeIntendedEnvironment(environmentId);
      setSelectedEnvironment(environmentId);
      updateUrlWithEnvironment(environmentId);
    }
  };

  return (
    <EnvironmentContext.Provider 
      value={{ 
        environments, 
        selectedEnvironment, 
        setSelectedEnvironment: setEnvironment,
        isLoading,
        error
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
};

export const useEnvironment = () => {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error('useEnvironment must be used within an EnvironmentProvider');
  }
  return context;
};