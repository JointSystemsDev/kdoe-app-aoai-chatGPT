import React, { createContext, useState, useEffect, useContext } from 'react';
// import { useSearchParams } from 'react-router-dom';

interface Environment {
  id: string;
  name: string;
}

interface EnvironmentContextType {
  environments: Environment[];
  selectedEnvironment: string | null;
  setSelectedEnvironment: (id: string) => void;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export const EnvironmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState<string | null>(null);
//   const [searchParams, setSearchParams] = useSearchParams();

  // url param env
  useEffect(() => {
    fetchEnvironments();
    // const envId = searchParams.get('env');
    // if (envId) {
    //   setSelectedEnvironment(envId);
    // }
  }, []);

  const fetchEnvironments = async () => {
    const response = await fetch('/api/environments');
    const data = await response.json();
    setEnvironments(data);
    if (data.length > 0 && !selectedEnvironment) {
      setSelectedEnvironment(data[0].id);
    }
  };

  const setEnvironment = async (environmentId: string) => {
    const response = await fetch('/api/set_environment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ environment_id: environmentId }),
    });
    if (response.ok) {
    //   setSearchParams({ env: environmentId });
      setSelectedEnvironment(environmentId);
    } else {
      console.error('Failed to set environment');
    }
  };

  return (
    <EnvironmentContext.Provider 
      value={{ 
        environments, 
        selectedEnvironment, 
        setSelectedEnvironment: setEnvironment 
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