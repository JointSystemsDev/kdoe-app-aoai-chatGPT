import React, {
  createContext,
  ReactNode,
  useEffect,
  useReducer,
  useRef
} from 'react'

import {
  ChatHistoryLoadingState,
  Conversation,
  CosmosDBHealth,
  CosmosDBStatus,
  Feedback,
  FrontendSettings,
  frontendSettings,
  getUserInfo,
  historyEnsure,
  historyList
} from '../api'

import { appStateReducer } from './AppReducer'
import { useEnvironment } from './EnvironmentProvider'
import { initializeUserInfo, AppUserInfo } from '../utils/authUtils';

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
  userInfo: AppUserInfo | null;
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
  | { type: 'SET_USER_INFO'; payload: AppState['userInfo'] }

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
  userInfo: null
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
  const userIdLogged = useRef(false);  // Use ref to track if we've logged the ID

  useEffect(() => {
    debugger;
    const getUserDetails = async () => {
      try {
        const userInfo = await getUserInfo();
        if (userInfo.length > 0 && !userIdLogged.current) {
          console.log('Current user ID (for admin configuration):', userInfo[0].user_id);
          userIdLogged.current = true;
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
      }
    };

    getUserDetails();
  }, []); 

  useEffect(() => {
    // Check for cosmosdb config and fetch initial data here
    const fetchChatHistory = async (offset = 0): Promise<Conversation[] | null> => {
      // Convert null to undefined for the API call
      const envId = selectedEnvironment || undefined;
      
      const result = await historyList(offset, envId)
        .then(response => {
          if (response) {
            dispatch({ type: 'FETCH_CHAT_HISTORY', payload: response })
          } else {
            dispatch({ type: 'FETCH_CHAT_HISTORY', payload: null })
          }
          return response
        })
        .catch(_err => {
          dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Fail })
          dispatch({ type: 'FETCH_CHAT_HISTORY', payload: null })
          console.error('There was an issue fetching your data.')
          return null
        })
      return result
    }
    const getHistoryEnsure = async () => {
      dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Loading })
      historyEnsure()
        .then(response => {
          if (response?.cosmosDB) {
            fetchChatHistory()
              .then(res => {
                if (res) {
                  dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Success })
                  dispatch({ type: 'SET_COSMOSDB_STATUS', payload: response })
                } else {
                  dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Fail })
                  dispatch({
                    type: 'SET_COSMOSDB_STATUS',
                    payload: { cosmosDB: false, status: CosmosDBStatus.NotWorking }
                  })
                }
              })
              .catch(_err => {
                dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Fail })
                dispatch({
                  type: 'SET_COSMOSDB_STATUS',
                  payload: { cosmosDB: false, status: CosmosDBStatus.NotWorking }
                })
              })
          } else {
            dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Fail })
            dispatch({ type: 'SET_COSMOSDB_STATUS', payload: response })
          }
        })
        .catch(_err => {
          dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Fail })
          dispatch({ type: 'SET_COSMOSDB_STATUS', payload: { cosmosDB: false, status: CosmosDBStatus.NotConfigured } })
        })
    }
    getHistoryEnsure()
  }, [selectedEnvironment])

  useEffect(() => {
    const initUser = async () => {
      try {
        const userInfoList = await getUserInfo();
        const userInfo = await initializeUserInfo(userInfoList);
        dispatch({ type: 'SET_USER_INFO', payload: userInfo });
      } catch (error) {
        console.error('Error initializing user:', error);
        dispatch({ type: 'SET_USER_INFO', payload: null });
      }
    };

    initUser();
  }, []);

  // Effect for handling environment changes
  useEffect(() => {
    // Clear current chat when environment changes
    dispatch({ type: 'RESET_CHAT_STATE' });
    
    // Fetch new frontend settings for the selected environment
    const getFrontendSettings = async () => {
      frontendSettings(selectedEnvironment ?? undefined)
        .then(response => {
          dispatch({ type: 'FETCH_FRONTEND_SETTINGS', payload: response as FrontendSettings })
        })
        .catch(_err => {
          console.error('There was an issue fetching your data.')
        })
    }
    getFrontendSettings()
  }, [selectedEnvironment])

  return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>
}