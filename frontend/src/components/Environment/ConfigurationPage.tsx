import React, { useState, useEffect, useContext } from 'react';
import { 
  Stack, 
  DetailsList,
  IColumn,
  SelectionMode,
  CommandBar,
  ICommandBarItemProps,
  MessageBar,
  MessageBarType,
  Selection
} from '@fluentui/react';
import { useNavigate } from 'react-router-dom';
import { AppStateContext } from '../../state/AppProvider';
import { ConfigurationModal } from './ConfigurationModal';
import styles from './ConfigurationPage.module.css';

interface Configuration {
  id: string;
  name: string;
  userId: string;
  settings: any;
  backend_settings: any;
  timestamp: string;
}

export const ConfigurationPage: React.FC = () => {
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<Configuration | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | 'clone'>('create');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const appStateContext = useContext(AppStateContext);
  const navigate = useNavigate();

  // Create selection instance
  const selection = new Selection({
    onSelectionChanged: () => {
      const selectedItems = selection.getSelection() as Configuration[];
      setSelectedConfig(selectedItems[0] || null);
    },
  });

  useEffect(() => {
    if (!appStateContext?.state.userInfo?.isAdmin && !appStateContext?.state.userInfo?.isPowerUser) {
      navigate('/');
    }
  }, [appStateContext?.state.userInfo]);

  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/configurations');
      if (!response.ok) throw new Error('Failed to load configurations');
      const data = await response.json();
      setConfigurations(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const columns: IColumn[] = [
    {
      key: 'name',
      name: 'Name',
      fieldName: 'name',
      minWidth: 100,
      maxWidth: 300,
      isResizable: true,
    },
    {
      key: 'scope',
      name: 'Scope',
      minWidth: 70,
      maxWidth: 90,
      onRender: (item: Configuration) => 
        item.userId === '00000000-0000-0000-0000-000000000000' ? 'Global' : 'User'
    },
    {
      key: 'timestamp',
      name: 'Last Updated',
      minWidth: 100,
      maxWidth: 150,
      onRender: (item: Configuration) => {
        try {
          const date = new Date(item.timestamp);
          // Format the date to local string with both date and time
          return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (e) {
          console.error('Error formatting date:', e);
          return 'N/A';
        }
      }
    }
  ];

  const handleSave = async (data: any) => {
    try {

      debugger;
      const url = dialogMode === 'edit' 
        ? `/api/configurations/${selectedConfig?.id}`
        : '/api/configurations';
      
      const method = dialogMode === 'edit' ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.message || 
          `Failed to ${dialogMode} configuration. Status: ${response.status}`
        );
      }
      
      await loadConfigurations();
      setIsDialogOpen(false);
      setSelectedConfig(null);
      
      // Show success message
      setError(null);  // Clear any existing errors
    } catch (err: any) {
      console.error('Save configuration error:', err);
      setError(typeof err.message === 'string' 
        ? err.message 
        : 'An unexpected error occurred while saving the configuration'
      );
    }
  };

  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'new',
      text: 'New Configuration',
      iconProps: { iconName: 'Add' },
      onClick: () => {
        setDialogMode('create');
        setSelectedConfig(null);
        setIsDialogOpen(true);
      }
    },
    {
      key: 'edit',
      text: 'Edit',
      iconProps: { iconName: 'Edit' },
      onClick: () => {
        setDialogMode('edit');
        setIsDialogOpen(true);
      },
      disabled: !selectedConfig
    },
    {
      key: 'clone',
      text: 'Clone',
      iconProps: { iconName: 'Copy' },
      onClick: () => {
        setDialogMode('clone');
        setIsDialogOpen(true);
      },
      disabled: !selectedConfig
    },
    {
      key: 'delete',
      text: 'Delete',
      iconProps: { iconName: 'Delete' },
      onClick: () => handleDelete(),
      disabled: !selectedConfig
    }
  ];

  const handleDelete = async () => {
    if (!selectedConfig) return;
    
    if (!confirm('Are you sure you want to delete this configuration?')) return;

    try {
      const response = await fetch(`/api/configurations/${selectedConfig.id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete configuration');
      await loadConfigurations();
      setSelectedConfig(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <Stack className={styles.container}>
        <div>Loading...</div>
      </Stack>
    );
  }

  return (
    <Stack className={styles.container}>
      {error && (
        <MessageBar messageBarType={MessageBarType.error} onDismiss={() => setError(null)}>
          {error}
        </MessageBar>
      )}
      
      <CommandBar items={commandBarItems} />
      
      <DetailsList
        items={configurations}
        columns={columns}
        selectionMode={SelectionMode.single}
        selection={selection}
        setKey="configurations" // Add this to help React with reconciliation
        getKey={(item: Configuration) => item.id} // Add this to specify the unique key
      />

      <ConfigurationModal
        isOpen={isDialogOpen}
        mode={dialogMode}
        initialData={dialogMode === 'create' ? null : selectedConfig}
        onDismiss={() => {
          setIsDialogOpen(false);
          setSelectedConfig(null);
        }}
        onSave={handleSave}
        isAdmin={appStateContext?.state.userInfo?.isAdmin || false}
      />
    </Stack>
  );
};

export default ConfigurationPage;