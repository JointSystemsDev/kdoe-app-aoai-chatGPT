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
    
    // Preserve the base hash path (everything before the ?)
    const newHash = `${basePath || '#/'}?${searchParams.toString()}`;
    window.location.hash = newHash;
  };

  useEffect(() => {
    loadEnvironments();

    // Listen for hash changes
    const handleHashChange = () => {
      const envId = getEnvironmentFromUrl();
      if (envId && environments.some(env => env.id === envId) && envId !== selectedEnvironment) {
        setSelectedEnvironment(envId);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const loadEnvironments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchEnvironments();

      // Move environment with id "default" to the first position if it exists
      const defaultEnvIndex = data.findIndex(env => env.id === "default");
      if (defaultEnvIndex !== -1) {
        const [defaultEnv] = data.splice(defaultEnvIndex, 1);
        data.unshift(defaultEnv); // Add it to the start of the array
      }

      setEnvironments(data);

      // Check URL parameter first
      const envId = getEnvironmentFromUrl();
      if (envId && data.some(env => env.id === envId)) {
        setSelectedEnvironment(envId);
      } else if (data.length > 0 && !selectedEnvironment) {
        // If no valid URL parameter, set default environment
        setSelectedEnvironment(data[0].id);
        // Update URL with default environment
        updateUrlWithEnvironment(data[0].id);
      }
    } catch (err) {
      setError('Failed to load environments. Please try again later.');
      console.error('Error loading environments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const setEnvironment = (environmentId: string) => {
    setSelectedEnvironment(environmentId);
    // Update URL when environment changes
    updateUrlWithEnvironment(environmentId);
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