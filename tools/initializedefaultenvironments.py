import asyncio
from azure.data.tables.aio import TableServiceClient
import json
import os
from datetime import datetime

async def init_default_environments():
    connection_string = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
    table_name = os.getenv('AZURE_STORAGE_TABLE')
    
    default_environments = [
        {
            'PartitionKey': '00000000-0000-0000-0000-000000000000',  # Common environment
            'RowKey': 'default',
            'name': 'Default Environment',
            'settings': json.dumps({
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
            })
        },
        # Add more default environments here
    ]

    async with TableServiceClient.from_connection_string(connection_string) as table_service:
        # Create table if it doesn't exist
        await table_service.create_table_if_not_exists(table_name)
        table_client = table_service.get_table_client(table_name)
        
        # Add default environments
        for environment in default_environments:
            try:
                await table_client.create_entity(entity=environment)
                print(f"Created environment: {environment['name']}")
            except Exception as e:
                print(f"Error creating environment {environment['name']}: {str(e)}")

if __name__ == "__main__":
    asyncio.run(init_default_environments())