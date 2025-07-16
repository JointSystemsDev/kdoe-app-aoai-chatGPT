import React, { useEffect } from 'react';
import {
  Modal,
  IconButton,
  Stack,
  TextField,
  Toggle,
  PrimaryButton,
  DefaultButton,
  SpinnerSize,
  Spinner,
  IModalStyles,
  mergeStyles,
} from '@fluentui/react';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import styles from './ConfigurationModal.module.css';

const modalStyles: IModalStyles = {
  root: { minWidth: '800px' },
  main: {
    minWidth: '800px !important',
    maxWidth: '1200px !important',
    width: '90vw !important',
  },
  scrollableContent: {
    padding: '24px',
  },
  layer: undefined,
  keyboardMoveIconContainer: undefined,
  keyboardMoveIcon: undefined
};

const headerClass = mergeStyles({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px 24px',
  borderBottom: '1px solid #edebe9',
});

// Updated validation schema based on the provided JSON
const configSchema = yup.object({
  id: yup.string().optional(),
  name: yup.string().required('Name is required'),
  isGlobal: yup.boolean(),
  userId: yup.string().optional(),
  settings: yup.object({
    title: yup.string().required('Title is required'),
    chat_title: yup.string().required('Chat title is required'),
    chat_description: yup.string().required('Chat description is required'),
    logo: yup.string().nullable(),
    chat_logo: yup.string().nullable(),
    favicon: yup.string().nullable(),
    show_share_button: yup.boolean().default(false),
    show_chat_history_button: yup.boolean().default(true),
    enable_image_chat: yup.boolean().default(false),
    enable_mode_selector: yup.boolean().default(false),
    language: yup.string().default('en'),
    additional_header_logo: yup.string().nullable(),
    help_link_title: yup.string().nullable(),
    help_link_url: yup.string().nullable(),
    limit_input_to_characters: yup.number().default(5000)
  }),
  backend_settings: yup.object({
    openai: yup.object({
      temperature: yup.number().default(0.7),
      top_p: yup.number().default(0.95),
      max_tokens: yup.number().default(1000),
      system_message: yup.string().nullable(),
      embedding_name: yup.string().nullable(),
      embedding_endpoint: yup.string().nullable(),
      embedding_key: yup.string().nullable()
    }),
    search: yup.object({
      top_k: yup.number().default(5),
      strictness: yup.number().default(3),
      enable_in_domain: yup.boolean().default(false),
      datasource_type: yup.string().nullable()
    }),
    azure_search: yup.object({
      service: yup.string().nullable(),
      index: yup.string().nullable(),
      key: yup.string().nullable(),
      query_type: yup.string().default('vectorSimpleHybrid'),
      semantic_search_config: yup.string().nullable(),
      index_is_prechunked: yup.boolean().default(false),
      top_k: yup.number().default(5),
      enable_in_domain: yup.boolean().default(false),
      content_columns: yup.string().nullable(),
      filename_column: yup.string().nullable(),
      title_column: yup.string().nullable(),
      url_column: yup.string().nullable(),
      vector_columns: yup.string().nullable(),
      permitted_groups_column: yup.string().nullable(),
      strictness: yup.number().default(3)
    }),
    bing_search: yup.object({
      enabled: yup.boolean().default(false),
      api_key: yup.string().nullable(),
      endpoint: yup.string().default("https://api.bing.microsoft.com/v7.0/search"),
      max_results: yup.number().default(5),
      additional_prompt: yup.string().default("Use the following web search results to enhance your response:"),
      enhanced_system_prompt: yup.string().default(`You have access to web search functionality. Use the bing_web_search function when:
- The user asks about recent events, current news, or latest information
- You need up-to-date facts, prices, or data not in your training
- The query would benefit from current web information
- You're unsure about recent developments

Always provide the source URLs when using search results.`)
    })
  })
});

type ConfigFormData = yup.InferType<typeof configSchema>;

interface ConfigurationDialogProps {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'clone';
  initialData?: any;
  onDismiss: () => void;
  onSave: (data: ConfigFormData) => Promise<void>;
  isAdmin: boolean;
}

const titleClass = mergeStyles({
  margin: 0,
  fontSize: '20px',
  fontWeight: '600',
});

export const ConfigurationModal: React.FC<ConfigurationDialogProps> = ({
  isOpen,
  mode,
  initialData,
  onDismiss,
  onSave,
  isAdmin
}) => {
  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ConfigFormData>({
    resolver: yupResolver(configSchema),
    defaultValues: {
      name: '',
      isGlobal: false,
      settings: {
        title: '',
        chat_title: '',
        chat_description: '',
        show_share_button: false,
        show_chat_history_button: true,
        enable_image_chat: false,
        enable_mode_selector: false,
        language: 'en',
        limit_input_to_characters: 5000
      },
      backend_settings: {
        openai: {
          temperature: 0.7,
          top_p: 0.95,
          max_tokens: 1000,
          system_message: "You are an AI assistant that helps people find information."
        },
        search: {
          top_k: 5,
          strictness: 3,
          enable_in_domain: false
        },
        azure_search: {
          query_type: 'vectorSimpleHybrid',
          index_is_prechunked: false,
          top_k: 5,
          enable_in_domain: false,
          strictness: 3
        }
      }
    }
  });

  useEffect(() => {
    if (initialData) {
      // When editing, set isGlobal based on the userId
      const isGlobalConfig = initialData.userId === '00000000-0000-0000-0000-000000000000';
      reset({
        ...initialData,
        isGlobal: isGlobalConfig
      });
    }
  }, [initialData, reset]);

  const onSubmit = async (data: ConfigFormData) => {
    try {
      await onSave(data);
      onDismiss();
    } catch (err) {
      console.error('Error saving configuration:', err);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onDismiss={onDismiss}
      isBlocking={true}
      styles={modalStyles}
    >
      <div className={headerClass}>
        <h2 className={titleClass}>
          {mode === 'create' ? 'New' : mode === 'edit' ? 'Edit' : 'Clone'} Configuration
        </h2>
        <IconButton
          iconProps={{ iconName: 'Cancel' }}
          ariaLabel="Close modal"
          onClick={onDismiss}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        <Stack tokens={{ childrenGap: 20 }} className={styles.formContent}>
          {/* Basic Configuration Section */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Basic Configuration</h3>
            <Stack tokens={{ childrenGap: 16 }}>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <TextField
                    label="Configuration Name"
                    required
                    errorMessage={errors.name?.message}
                    {...field}
                  />
                )}
              />

              {/* Only show isGlobal toggle for admins during create/clone */}
              {isAdmin && (mode === 'create' || mode === 'clone') && (
                <Controller
                  name="isGlobal"
                  control={control}
                  render={({ field: { value, onChange } }) => (
                    <Toggle
                      label="Global Configuration"
                      checked={value}
                      onChange={(_, checked) => onChange(checked)}
                    />
                  )}
                />
              )}

              {/* Show read-only scope indicator when editing */}
              {mode === 'edit' && (
                <TextField
                  label="Scope"
                  value={initialData?.userId === '00000000-0000-0000-0000-000000000000' ? 'Global' : 'Personal'}
                  disabled={true}
                  readOnly
                />
              )}
            </Stack>
          </div>

          {/* Frontend Settings Section */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Frontend Settings</h3>
            <Stack tokens={{ childrenGap: 16 }}>
              <Controller
                name="settings.title"
                control={control}
                render={({ field }) => (
                  <TextField
                    label="Title"
                    required
                    errorMessage={errors.settings?.title?.message}
                    {...field}
                  />
                )}
              />
              
              <Controller
                name="settings.chat_title"
                control={control}
                render={({ field }) => (
                  <TextField
                    label="Chat Title"
                    required
                    errorMessage={errors.settings?.chat_title?.message}
                    {...field}
                  />
                )}
              />

              <Controller
                name="settings.chat_description"
                control={control}
                render={({ field }) => (
                  <TextField
                    label="Chat Description"
                    required
                    multiline
                    rows={3}
                    errorMessage={errors.settings?.chat_description?.message}
                    {...field}
                  />
                )}
              />

              <Stack horizontal tokens={{ childrenGap: 16 }}>
                <Stack.Item grow={1}>
                  <Controller
                    name="settings.logo"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label="Logo URL"
                        value={field.value || ''} 
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  />
                </Stack.Item>
                <Stack.Item grow={1}>
                  <Controller
                    name="settings.chat_logo"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label="Chat Logo URL"
                        value={field.value || ''} 
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  />
                </Stack.Item>
              </Stack>

              <Controller
                name="settings.favicon"
                control={control}
                render={({ field }) => (
                  <TextField
                    label="Favicon URL"
                     value={field.value || ''} 
                     onChange={field.onChange}
                     onBlur={field.onBlur}
                  />
                )}
              />

              <Stack horizontal tokens={{ childrenGap: 16 }}>
                <Stack.Item grow={1}>
                  <Controller
                    name="settings.show_share_button"
                    control={control}
                    render={({ field: { value, onChange } }) => (
                      <Toggle
                        label="Show Share Button"
                        checked={value}
                        onChange={(_, checked) => onChange(checked)}
                      />
                    )}
                  />
                </Stack.Item>
                <Stack.Item grow={1}>
                  <Controller
                    name="settings.show_chat_history_button"
                    control={control}
                    render={({ field: { value, onChange } }) => (
                      <Toggle
                        label="Show Chat History Button"
                        checked={value}
                        onChange={(_, checked) => onChange(checked)}
                      />
                    )}
                  />
                </Stack.Item>
              </Stack>

              <Stack horizontal tokens={{ childrenGap: 16 }}>
                <Stack.Item grow={1}>
                  <Controller
                    name="settings.enable_image_chat"
                    control={control}
                    render={({ field: { value, onChange } }) => (
                      <Toggle
                        label="Enable Image Chat"
                        checked={value}
                        onChange={(_, checked) => onChange(checked)}
                      />
                    )}
                  />
                </Stack.Item>
                <Stack.Item grow={1}>
                  <Controller
                    name="settings.enable_mode_selector"
                    control={control}
                    render={({ field: { value, onChange } }) => (
                      <Toggle
                        label="Enable Mode Selector"
                        checked={value}
                        onChange={(_, checked) => onChange(checked)}
                      />
                    )}
                  />
                </Stack.Item>
              </Stack>

              <Controller
                name="settings.language"
                control={control}
                render={({ field }) => (
                  <TextField
                    label="Language"
                    placeholder="en"
                    {...field}
                  />
                )}
              />

              <Controller
                name="settings.limit_input_to_characters"
                control={control}
                render={({ field: { onChange, value, ...rest } }) => (
                  <TextField
                    label="Character Limit"
                    type="number"
                    value={value?.toString()}
                    onChange={(_, newValue) => onChange(newValue ? parseInt(newValue) : undefined)}
                    {...rest}
                  />
                )}
              />
            </Stack>
          </div>

          {/* Backend Settings Section */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Backend Settings</h3>
            
            <h4 className={styles.subsectionTitle}>OpenAI Configuration</h4>
            <Stack tokens={{ childrenGap: 16 }}>
              <Controller
                name="backend_settings.openai.system_message"
                control={control}
                render={({ field }) => (
                  <TextField
                    label="System Message"
                    multiline
                    rows={3}
                    value={field.value || ''} 
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />

              <Stack horizontal tokens={{ childrenGap: 16 }}>
                <Stack.Item grow={1}>
                  <Controller
                    name="backend_settings.openai.temperature"
                    control={control}
                    render={({ field: { onChange, value, ...rest } }) => (
                      <TextField
                        label="Temperature"
                        type="number"
                        min={0}
                        max={1}
                        step={0.1}
                        value={value?.toString()}
                        onChange={(_, newValue) => onChange(newValue ? parseFloat(newValue) : undefined)}
                        {...rest}
                      />
                    )}
                  />
                </Stack.Item>
                <Stack.Item grow={1}>
                  <Controller
                    name="backend_settings.openai.top_p"
                    control={control}
                    render={({ field: { onChange, value, ...rest } }) => (
                      <TextField
                        label="Top P"
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        value={value?.toString()}
                        onChange={(_, newValue) => onChange(newValue ? parseFloat(newValue) : undefined)}
                        {...rest}
                      />
                    )}
                  />
                </Stack.Item>
              </Stack>

              <Controller
                name="backend_settings.openai.max_tokens"
                control={control}
                render={({ field: { onChange, value, ...rest } }) => (
                  <TextField
                    label="Max Tokens"
                    type="number"
                    value={value?.toString()}
                    onChange={(_, newValue) => onChange(newValue ? parseInt(newValue) : undefined)}
                    {...rest}
                  />
                )}
              />
            </Stack>

            <h4 className={styles.subsectionTitle}>Search Configuration</h4>
            <Stack tokens={{ childrenGap: 16 }}>
              <Stack horizontal tokens={{ childrenGap: 16 }}>
                <Stack.Item grow={1}>
                  <Controller
                    name="backend_settings.search.top_k"
                    control={control}
                    render={({ field: { onChange, value, ...rest } }) => (
                      <TextField
                        label="Top K"
                        type="number"
                        value={value?.toString()}
                        onChange={(_, newValue) => onChange(newValue ? parseInt(newValue) : undefined)}
                        {...rest}
                      />
                    )}
                  />
                </Stack.Item>
                <Stack.Item grow={1}>
                  <Controller
                    name="backend_settings.search.strictness"
                    control={control}
                    render={({ field: { onChange, value, ...rest } }) => (<TextField
                      label="Strictness"
                      type="number"
                      value={value?.toString()}
                      onChange={(_, newValue) => onChange(newValue ? parseInt(newValue) : undefined)}
                      {...rest}
                    />
                  )}
                />
              </Stack.Item>
            </Stack>

            <Controller
              name="backend_settings.search.enable_in_domain"
              control={control}
              render={({ field: { value, onChange } }) => (
                <Toggle
                  label="Enable In Domain"
                  checked={value}
                  onChange={(_, checked) => onChange(checked)}
                />
              )}
            />
          </Stack>

          <h4 className={styles.subsectionTitle}>Azure Search Configuration</h4>
          <Stack tokens={{ childrenGap: 16 }}>
            <Stack horizontal tokens={{ childrenGap: 16 }}>
              <Stack.Item grow={1}>
                <Controller
                  name="backend_settings.azure_search.service"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label="Service Name"
                      value={field.value || ''} 
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              </Stack.Item>
              <Stack.Item grow={1}>
                <Controller
                  name="backend_settings.azure_search.index"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label="Index Name"
                      value={field.value || ''} 
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              </Stack.Item>
            </Stack>

            <Controller
              name="backend_settings.azure_search.key"
              control={control}
              render={({ field }) => (
                <TextField
                  label="API Key"
                  value={field.value || ''} 
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />

          <Controller
              name="backend_settings.azure_search.query_type"
              control={control}
              render={({ field }) => (
                <TextField
                  label="Query Type"
                  defaultValue="vectorSimpleHybrid"
                  {...field}
                />
              )}
            />

            <Stack horizontal tokens={{ childrenGap: 16 }}>
              <Stack.Item grow={1}>
                <Controller
                  name="backend_settings.azure_search.top_k"
                  control={control}
                  render={({ field: { onChange, value, ...rest } }) => (
                    <TextField
                      label="Top K"
                      type="number"
                      value={value?.toString()}
                      onChange={(_, newValue) => onChange(newValue ? parseInt(newValue) : undefined)}
                      {...rest}
                    />
                  )}
                />
              </Stack.Item>
              <Stack.Item grow={1}>
                <Controller
                  name="backend_settings.azure_search.strictness"
                  control={control}
                  render={({ field: { onChange, value, ...rest } }) => (
                    <TextField
                      label="Strictness"
                      type="number"
                      value={value?.toString()}
                      onChange={(_, newValue) => onChange(newValue ? parseInt(newValue) : undefined)}
                      {...rest}
                    />
                  )}
                />
              </Stack.Item>

            <Controller
              name="backend_settings.azure_search.index_is_prechunked"
              control={control}
              render={({ field: { value, onChange } }) => (
                <Toggle
                  label="Index is Pre-chunked"
                  checked={value}
                  onChange={(_, checked) => onChange(checked)}
                />
              )}
            />

            <Controller
              name="backend_settings.azure_search.enable_in_domain"
              control={control}
              render={({ field: { value, onChange } }) => (
                <Toggle
                  label="Enable In Domain"
                  checked={value}
                  onChange={(_, checked) => onChange(checked)}
                />
              )}
            />

            <Controller
                name="backend_settings.azure_search.content_columns"
                control={control}
                render={({ field }) => (
                  <TextField
                    label="Content Columns"
                    value={field.value || ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </Stack>
            
            <Stack horizontal tokens={{ childrenGap: 16 }}>
              <Controller
                name="backend_settings.azure_search.filename_column"
                control={control}
                render={({ field }) => (
                  <TextField
                    label="Filename Column"
                    value={field.value || ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />

              <Controller
                name="backend_settings.azure_search.title_column"
                control={control}
                render={({ field }) => (
                  <TextField
                    label="Title Column"
                    value={field.value || ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />

              <Controller
                name="backend_settings.azure_search.url_column"
                control={control}
                render={({ field }) => (
                  <TextField
                    label="URL Column"
                    value={field.value || ''}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />

              <Controller
                name="backend_settings.azure_search.vector_columns"
                control={control}
                render={({ field }) => (
                  <TextField
                    label="Vector Columns"
                    value={field.value || ''} 
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />

              <Controller
                name="backend_settings.azure_search.permitted_groups_column"
                control={control}
                render={({ field }) => (
                  <TextField
                    label="Permitted Groups Column"
                    value={field.value || ''} 
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </Stack>
          </Stack>

          <h4 className={styles.subsectionTitle}>Bing Search Configuration</h4>
          <Stack tokens={{ childrenGap: 16 }}>
            <Controller
              name="backend_settings.bing_search.enabled"
              control={control}
              render={({ field: { value, onChange } }) => (
                <Toggle
                  label="Enable Bing Search"
                  checked={value}
                  onChange={(_, checked) => onChange(checked)}
                />
              )}
            />

            <Controller
              name="backend_settings.bing_search.api_key"
              control={control}
              render={({ field }) => (
                <TextField
                  label="Bing API Key"
                  type="password"
                  value={field.value || ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />

            <Stack horizontal tokens={{ childrenGap: 16 }}>
              <Stack.Item grow={1}>
                <Controller
                  name="backend_settings.bing_search.max_results"
                  control={control}
                  render={({ field: { onChange, value, ...rest } }) => (
                    <TextField
                      label="Max Results"
                      type="number"
                      min={1}
                      max={10}
                      value={value?.toString()}
                      onChange={(_, newValue) => onChange(newValue ? parseInt(newValue) : 5)}
                      {...rest}
                    />
                  )}
                />
              </Stack.Item>
              <Stack.Item grow={1}>
                <Controller
                  name="backend_settings.bing_search.endpoint"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label="Bing Endpoint"
                      value={field.value || ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              </Stack.Item>
            </Stack>

            <Controller
              name="backend_settings.bing_search.additional_prompt"
              control={control}
              render={({ field }) => (
                <TextField
                  label="Additional Prompt (for search results)"
                  multiline
                  rows={2}
                  description="This text will be prepended to search results when presenting them to the AI"
                  value={field.value || ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />

            <Controller
              name="backend_settings.bing_search.enhanced_system_prompt"
              control={control}
              render={({ field }) => (
                <TextField
                  label="Enhanced System Prompt"
                  multiline
                  rows={6}
                  description="This will be appended to the system message to guide the AI on when to use search"
                  value={field.value || ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Stack>
        </div>

        {isSubmitting && (
          <Spinner size={SpinnerSize.large} label="Saving configuration..." />
        )}

        <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 10 }}>
          <DefaultButton onClick={onDismiss} text="Cancel" />
          <PrimaryButton type="submit" text="Save" disabled={isSubmitting} />
        </Stack>
      </Stack>
    </form>
  </Modal>
);
};
