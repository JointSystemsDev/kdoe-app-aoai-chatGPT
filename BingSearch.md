# Bing Search Integration

## Overview

This document describes the implementation of Bing search functionality in the Azure OpenAI chatbot application. The integration allows the AI to perform web searches when it determines that current information would enhance the response quality.

## Technical Implementation

### Architecture

The Bing search integration follows a function calling approach where:
1. OpenAI determines when a web search is needed based on system prompt guidance
2. The AI calls a `bing_web_search` function with a search query
3. The backend executes the Bing search and formats results
4. A second OpenAI call is made with the search results to generate the final response

### Key Components

#### Backend Components

1. **BingSearchService** (`backend/services/bing_search.py`)
   - Handles Bing API communication
   - Formats search results for AI consumption
   - Implements error handling and timeouts

2. **Settings Extension** (`backend/settings.py`)
   - Adds `_BingSearchSettings` class with configuration options
   - Integrates with existing environment configuration system

3. **Function Call Handler** (`app.py`)
   - Processes OpenAI function calls
   - Manages the two-step conversation flow
   - Handles streaming response with search indicators

#### Frontend Components

1. **Configuration Interface** (`frontend/src/components/Environment/ConfigurationModal.tsx`)
   - Adds Bing search configuration section
   - Includes toggles, API key input, and prompt customization
   - Validates configuration inputs

2. **Search Indicator** (`frontend/src/components/common/SearchIndicator.tsx`)
   - Displays animated "Searching Bing..." message
   - Supports internationalization
   - Non-intrusive UI element

3. **Translation Support** (`frontend/src/translations/`)
   - Adds search-related translations for multiple languages
   - Supports localized search status messages

### Configuration Options

Each environment can be configured with the following Bing search settings:

- **Enabled**: Toggle to enable/disable Bing search
- **API Key**: Bing Search API subscription key
- **Endpoint**: Bing Search API endpoint (default: https://api.bing.microsoft.com/v7.0/search)
- **Max Results**: Number of search results to retrieve (1-10)
- **Additional Prompt**: Text prepended to search results when presenting to AI
- **Enhanced System Prompt**: Instructions added to system message about when to use search

### Flow Description

1. **User Query**: User submits a question through the chat interface
2. **AI Analysis**: OpenAI analyzes the query with enhanced system prompt
3. **Search Decision**: AI decides whether web search would improve the response
4. **Function Call**: If search is needed, AI calls `bing_web_search` function
5. **Search Execution**: Backend executes Bing search and formats results
6. **Search Indicator**: Frontend displays "Searching Bing..." message
7. **Enhanced Response**: AI generates final response using search results
8. **Result Display**: User receives response with current web information

### Error Handling

- API key validation before making requests
- Timeout handling for Bing API calls (10 seconds)
- Graceful degradation when search fails
- Logging of search operations and errors
- Rate limit handling

### Security Considerations

- API keys stored securely in environment configuration
- Search queries sanitized to prevent injection
- Results filtered and formatted before AI consumption
- User access controlled through existing permission system

## User Perspective

### Configuration

Administrators and power users can configure Bing search through the environment configuration interface:

1. Navigate to Configuration page
2. Select or create an environment
3. Scroll to "Bing Search Configuration" section
4. Enable Bing search and provide API key
5. Customize search behavior and prompts as needed
6. Save configuration

### Usage

Once enabled, Bing search works automatically:

- No special commands required from users
- AI automatically determines when search is beneficial
- Search activity indicated by subtle "Searching Bing..." message
- Results seamlessly integrated into AI responses
- Source URLs provided when search results are used

### When Search is Triggered

The AI will typically use Bing search for:

- Recent events and current news
- Latest information not in training data
- Current prices, stock values, weather
- Recent product releases or announcements
- Time-sensitive factual queries
- Verification of rapidly changing information

### User Experience

- Transparent operation - users see when search is happening
- Minimal delay - search operations are optimized for speed
- Enhanced responses - current information improves answer quality
- Source attribution - URLs provided for search-based information
- Multilingual support - search indicators translated to user's language

## Dependencies

### Backend Dependencies
- `aiohttp`: For async HTTP requests to Bing API
- `json`: For parsing API responses
- `logging`: For operation tracking

### Frontend Dependencies
- `@fluentui/react`: For UI components
- `react-hook-form`: For configuration form handling
- `yup`: For configuration validation

## Environment Variables

The following environment variables can be used for default Bing search configuration:

- `BING_SEARCH_ENABLED`: Default enable state (true/false)
- `BING_SEARCH_API_KEY`: Default API key
- `BING_SEARCH_ENDPOINT`: API endpoint URL
- `BING_SEARCH_MAX_RESULTS`: Default maximum results (1-10)
- `BING_SEARCH_ADDITIONAL_PROMPT`: Default additional prompt text
- `BING_SEARCH_ENHANCED_SYSTEM_PROMPT`: Default system prompt enhancement

## API Requirements

To use Bing search functionality:

1. Subscribe to Bing Search API through Azure Cognitive Services
2. Obtain API key from Azure portal
3. Configure API key in environment settings
4. Ensure network connectivity to api.bing.microsoft.com

## Performance Considerations

- Search operations add 1-3 seconds to response time
- Bing API has rate limits based on subscription tier
- Search results cached briefly to avoid duplicate calls
- Streaming responses show search progress to users
- Timeout handling prevents hanging requests

## Monitoring and Logging

All search operations are logged with:
- Search query executed
- Number of results returned
- Response time
- Any errors encountered
- User and environment context

This enables monitoring of search usage and performance optimization.
