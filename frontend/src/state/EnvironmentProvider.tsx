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
const DEFAULT_ENV_ID = 'default';

export const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    
    const newHash = `${basePath || '#/'}?${searchParams.toString()}`;
    if (window.location.hash !== newHash) {
      window.location.hash = newHash;
    }
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

  const isValidEnvironment = (envId: string): boolean => {
    return envId === DEFAULT_ENV_ID || environments.some(env => env.id === envId);
  };

  // Initial load of environments and environment selection
  useEffect(() => {
    const initializeEnvironments = async () => {
      try {
        setIsLoading(true);
        const data = await fetchEnvironments();
        setEnvironments(data);
        
        // Check for intended environment from previous auth redirect
        const intendedEnv = getAndClearIntendedEnvironment();
        if (intendedEnv && (intendedEnv === DEFAULT_ENV_ID || data.some(env => env.id === intendedEnv))) {
          setSelectedEnvironment(intendedEnv);
          updateUrlWithEnvironment(intendedEnv);
          return;
        }

        // If no intended environment, check URL
        const urlEnv = getEnvironmentFromUrl();
        if (urlEnv && (urlEnv === DEFAULT_ENV_ID || data.some(env => env.id === urlEnv))) {
          storeIntendedEnvironment(urlEnv); // Store for potential auth redirect
          setSelectedEnvironment(urlEnv);
        } else {
          setSelectedEnvironment(DEFAULT_ENV_ID);
          updateUrlWithEnvironment(DEFAULT_ENV_ID);
        }
      } catch (err) {
        setError('Failed to load environments. Please try again later.');
        console.error('Error loading environments:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeEnvironments();
  }, []); // Only run on mount

  // Handle hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const envId = getEnvironmentFromUrl();
      
      if (envId && isValidEnvironment(envId)) {
        storeIntendedEnvironment(envId); // Store for potential auth redirect
        setSelectedEnvironment(envId);
      } else if (!envId) {
        storeIntendedEnvironment(DEFAULT_ENV_ID);
        setSelectedEnvironment(DEFAULT_ENV_ID);
        updateUrlWithEnvironment(DEFAULT_ENV_ID);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [environments]); // Only recreate when environments change

  const setEnvironment = (environmentId: string) => {
    if (isValidEnvironment(environmentId)) {
      storeIntendedEnvironment(environmentId); // Store for potential auth redirect
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