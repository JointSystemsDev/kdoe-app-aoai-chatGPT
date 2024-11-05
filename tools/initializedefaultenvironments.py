import asyncio
from backend.services.TableEnvironmentService import TableEnvironmentService

async def create_default_environment():
    service = TableEnvironmentService()
    await service.init_table()
    
    default_environment = {
        'name': 'Default Environment',
        'settings': {
            'title': 'Contoso Default',
            'chat_title': 'Start chatting',
            'chat_description': 'This is the default environment',
            'logo': None,
            'chat_logo': None,
            'show_share_button': True,
            'show_chat_history_button': True,
            'enable_image_chat': False,
            'language': 'en',
            'additional_header_logo': None,
            'help_link_title': None,
            'help_link_url': None,
            'limit_input_to_characters': 5000,
            'enable_mode_selector': True
        },
        'backend_settings': {
            'openai': {
                'resource': 'your-resource',
                'model': 'your-model',
                'key': 'your-key',
                'deployment_name': 'your-model-name',
                'temperature': 0.7,
                'top_p': 0.95,
                'max_tokens': 1000,
                'system_message': 'your-system-message',
                'preview_api_version': 'your-api-version',
                'embedding_name': 'text-embedding-ada-002',
                'embedding_endpoint': 'your-endpoint',
                'embedding_key': 'your-key'
            },
            'search': {
                'top_k': 5,
                'strictness': 3,
                'enable_in_domain': True,
                'datasource_type': 'AzureCognitiveSearch'
            },
            'azure_search': {
                'service': 'jointsystemai-aisearch-free',
                'index': 'confluence1',
                'key': 'your-key',
                'query_type': 'vectorSimpleHybrid',
                'semantic_search_config': '',
                'index_is_prechunked': True,
                'top_k': 5,
                'enable_in_domain': False,
                'content_columns': 'chunk',
                'filename_column': 'id',
                'title_column': 'title',
                'vector_columns': 'text_vector'
            }
        }
    }
    
    # Create default environment (common to all users)
    await service.create_environment('00000000-0000-0000-0000-000000000000', default_environment)
    print("Default environment created successfully")

if __name__ == "__main__":
    asyncio.run(create_default_environment())