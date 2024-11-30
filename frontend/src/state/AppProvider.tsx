import React, {
  createContext,
  ReactNode,
  useEffect,
  useReducer,
} from 'react'

import {
  ChatHistoryLoadingState,
  Conversation,
  CosmosDBHealth,
  CosmosDBStatus,
  Feedback,
  FrontendSettings,
  frontendSettings,
  historyEnsure,
  historyList
} from '../api'

import { appStateReducer } from './AppReducer'
import { useEnvironment } from './EnvironmentProvider'

export interface AppState {
  isChatHistoryOpen: boolean
  chatHistoryLoadingState: ChatHistoryLoadingState
  isCosmosDBAvailable: CosmosDBHealth
  chatHistory: Conversation[] | null
  filteredChatHistory: Conversation[] | null
  currentChat: Conversation | null
  frontendSettings: FrontendSettings | null
  feedbackState: { [answerId: string]: Feedback.Neutral | Feedback.Positive | Feedback.Negative }
  isLoading: boolean;
  answerExecResult: { [answerId: string]: [] }
}

export type Action =
  | { type: 'TOGGLE_CHAT_HISTORY' }
  | { type: 'SET_COSMOSDB_STATUS'; payload: CosmosDBHealth }
  | { type: 'UPDATE_CHAT_HISTORY_LOADING_STATE'; payload: ChatHistoryLoadingState }
  | { type: 'UPDATE_CURRENT_CHAT'; payload: Conversation | null }
  | { type: 'UPDATE_FILTERED_CHAT_HISTORY'; payload: Conversation[] | null }
  | { type: 'UPDATE_CHAT_HISTORY'; payload: Conversation }
  | { type: 'UPDATE_CHAT_TITLE'; payload: Conversation }
  | { type: 'DELETE_CHAT_ENTRY'; payload: string }
  | { type: 'DELETE_CHAT_HISTORY' }
  | { type: 'DELETE_CURRENT_CHAT_MESSAGES'; payload: string }
  | { type: 'FETCH_CHAT_HISTORY'; payload: Conversation[] | null }
  | { type: 'FETCH_FRONTEND_SETTINGS'; payload: FrontendSettings | null }
  | {
    type: 'SET_FEEDBACK_STATE'
    payload: { answerId: string; feedback: Feedback.Positive | Feedback.Negative | Feedback.Neutral }
  }
  | { type: 'GET_FEEDBACK_STATE'; payload: string }
  | { type: 'SET_ANSWER_EXEC_RESULT'; payload: { answerId: string, exec_result: [] } }
  | { type: 'RESET_CHAT_STATE' }

const initialState: AppState = {
  isChatHistoryOpen: false,
  chatHistoryLoadingState: ChatHistoryLoadingState.Loading,
  chatHistory: null,
  filteredChatHistory: null,
  currentChat: null,
  isCosmosDBAvailable: {
    cosmosDB: false,
    status: CosmosDBStatus.NotConfigured
  },
  frontendSettings: null,
  feedbackState: {},
  isLoading: true,
  answerExecResult: {},
}

export const AppStateContext = createContext<
  | {
    state: AppState
    dispatch: React.Dispatch<Action>
  }
  | undefined
>(undefined)

type AppStateProviderProps = {
  children: ReactNode
}

export const AppStateProvider: React.FC<AppStateProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appStateReducer, initialState);
  const { selectedEnvironment } = useEnvironment();

    // Only handle CosmosDB initialization
    useEffect(() => {
      const initializeCosmosDB = async () => {
        try {
          const response = await historyEnsure();
          dispatch({ type: 'SET_COSMOSDB_STATUS', payload: response });
        } catch (_err) {
          dispatch({ type: 'SET_COSMOSDB_STATUS', payload: { cosmosDB: false, status: CosmosDBStatus.NotConfigured } });
        }
      };
  
      initializeCosmosDB();
    }, []); // Only run on mount

  // Handle environment changes and chat history loading
  useEffect(() => {
    const loadEnvironmentData = async () => {
      if (!selectedEnvironment) {
        // If no environment is selected, reset state and don't load any history
        dispatch({ type: 'RESET_CHAT_STATE' });
        return;
      }

      // Set loading state
      dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Loading });

      try {
        // Load chat history for the selected environment
        const response = await historyList(0, selectedEnvironment);
        if (response) {
          dispatch({ type: 'FETCH_CHAT_HISTORY', payload: response });
          dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Success });
        } else {
          dispatch({ type: 'FETCH_CHAT_HISTORY', payload: null });
          dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Fail });
        }

        // Load frontend settings
        const settingsResponse = await frontendSettings(selectedEnvironment);
        dispatch({ type: 'FETCH_FRONTEND_SETTINGS', payload: settingsResponse as FrontendSettings });

      } catch (err) {
        console.error('Error loading environment data:', err);
        dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Fail });
        dispatch({ type: 'FETCH_CHAT_HISTORY', payload: null });
      }
    };

    // Reset state before loading new environment data
    dispatch({ type: 'RESET_CHAT_STATE' });
    loadEnvironmentData();

  }, [selectedEnvironment]);

  return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>
};