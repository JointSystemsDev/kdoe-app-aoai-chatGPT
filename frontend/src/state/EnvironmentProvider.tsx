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

const LOCAL_STORAGE_KEY = 'selected_environment';
const DEFAULT_ENV_ID = 'default';

export const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get environment ID from URL
  const getEnvironmentFromUrl = (): string | null => {
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(hash.split('?')[1] || '');
    const envId = searchParams.get('env');
    console.log('Environment from URL:', envId);
    return envId;
  };

  // Update URL with environment
  const updateUrlWithEnvironment = (envId: string) => {
    const hash = window.location.hash;
    const [basePath, search] = hash.split('?');
    const searchParams = new URLSearchParams(search || '');
    searchParams.set('env', envId);
    const newHash = `${basePath || '#/'}?${searchParams.toString()}`;
    if (window.location.hash !== newHash) {
      console.log('Updating URL with environment:', envId);
      window.location.hash = newHash;
    }
  };

  // Initialize environments
  useEffect(() => {
    const initializeEnvironments = async () => {
      try {
        console.log('Initializing environments...');
        setIsLoading(true);
        const data = await fetchEnvironments();
        console.log('Available environments:', data);
        setEnvironments(data);
        
        // Case 1: User starts with link to environment
        const urlEnvId = getEnvironmentFromUrl();
        if (urlEnvId && data.some(env => env.id === urlEnvId)) {
          console.log('Using environment from URL:', urlEnvId);
          localStorage.setItem(LOCAL_STORAGE_KEY, urlEnvId);
          setSelectedEnvironment(urlEnvId);
          return;
        }

        // Case 2: User has stored environment (after redirect)
        const storedEnvId = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedEnvId && data.some(env => env.id === storedEnvId)) {
          console.log('Using stored environment:', storedEnvId);
          setSelectedEnvironment(storedEnvId);
          updateUrlWithEnvironment(storedEnvId);
          return;
        }

        // Default case: Use default environment
        console.log('Using default environment:', DEFAULT_ENV_ID);
        setSelectedEnvironment(DEFAULT_ENV_ID);
        localStorage.setItem(LOCAL_STORAGE_KEY, DEFAULT_ENV_ID);
        updateUrlWithEnvironment(DEFAULT_ENV_ID);

      } catch (err) {
        console.error('Error initializing environments:', err);
        setError('Failed to load environments. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeEnvironments();
  }, []);

  // Case 3: Handle dropdown changes
  const handleEnvironmentChange = (envId: string) => {
    console.log('Environment change requested:', envId);
    if (environments.some(env => env.id === envId)) {
      console.log('Setting new environment:', envId);
      localStorage.setItem(LOCAL_STORAGE_KEY, envId);
      setSelectedEnvironment(envId);
      updateUrlWithEnvironment(envId);
    } else {
      console.warn('Invalid environment requested:', envId);
    }
  };

  // Handle hash changes (for back/forward browser navigation)
  useEffect(() => {
    const handleHashChange = () => {
      const urlEnvId = getEnvironmentFromUrl();
      console.log('Hash changed, new environment from URL:', urlEnvId);
      if (urlEnvId && environments.some(env => env.id === urlEnvId)) {
        console.log('Updating environment from hash change:', urlEnvId);
        localStorage.setItem(LOCAL_STORAGE_KEY, urlEnvId);
        setSelectedEnvironment(urlEnvId);
      } else {
        console.log('Invalid or no environment in URL after hash change');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      console.log('Cleaning up hash change listener');
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [environments]);

  // Log state changes
  useEffect(() => {
    console.log('Current environment state:', {
      selectedEnvironment,
      storedEnvironment: localStorage.getItem(LOCAL_STORAGE_KEY),
      urlEnvironment: getEnvironmentFromUrl()
    });
  }, [selectedEnvironment]);

  return (
    <EnvironmentContext.Provider 
      value={{ 
        environments, 
        selectedEnvironment, 
        setSelectedEnvironment: handleEnvironmentChange,
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