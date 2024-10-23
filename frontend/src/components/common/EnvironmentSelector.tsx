import React from 'react';
import { Dropdown, IDropdownOption } from '@fluentui/react';
import { useEnvironment } from '../../state/EnvironmentProvider';


export const EnvironmentSelector: React.FC = () => {
  const { environments, selectedEnvironment, setSelectedEnvironment } = useEnvironment();

  const handleEnvironmentChange = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
    if (option) {
      setSelectedEnvironment(option.key as string);
    }
  };

  const options: IDropdownOption[] = environments.map(env => ({
    key: env.id,
    text: env.name,
  }));

  return (
    <Dropdown
      placeholder="Select an environment"
      options={options}
      selectedKey={selectedEnvironment}
      onChange={handleEnvironmentChange}
    />
  );
};