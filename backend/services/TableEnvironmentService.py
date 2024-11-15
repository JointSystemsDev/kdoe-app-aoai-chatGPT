import uuid
from azure.data.tables.aio import TableServiceClient
from datetime import datetime
import json
from typing import List, Dict, Optional
import logging
from cachetools import TTLCache
import asyncio
from backend.services.backendsettings import BackendSettings
from backend.settings import app_settings

class TableEnvironmentService:
    def __init__(self):
        if not app_settings.azure_storage.connection_string:
            raise ValueError("Azure Storage connection string not configured")
            
        self.connection_string = app_settings.azure_storage.connection_string
        self.table_name = app_settings.azure_storage.table
        self.cache = TTLCache(maxsize=100, ttl=app_settings.azure_storage.cache_ttl)
        self.cache_lock = asyncio.Lock()

    async def init_table(self):
        """Initialize the table if it doesn't exist"""
        try:
            async with TableServiceClient.from_connection_string(self.connection_string) as table_service:
                # Await the create_table_if_not_exists coroutine
                table = await table_service.create_table_if_not_exists(self.table_name)
                return table
        except Exception as e:
            logging.error(f"Error initializing table: {str(e)}")
            raise

    async def get_environments(self, user_id: str) -> List[Dict]:
        """Get environments for a user, with both frontend and backend settings"""
        # Try cache first
        cached_environments = await self._get_from_cache(user_id)
        if cached_environments is not None:
            return cached_environments

        try:
            async with TableServiceClient.from_connection_string(self.connection_string) as table_service:
                table_client = table_service.get_table_client(self.table_name)
                
                environments = []
                common_filter = "PartitionKey eq '00000000-0000-0000-0000-000000000000'"
                user_filter = f"PartitionKey eq '{user_id}'"
                combined_filter = f"({common_filter}) or ({user_filter})"
                
                async for entity in table_client.query_entities(combined_filter):
                    environment = {
                        'id': entity['RowKey'],
                        'userId': entity['PartitionKey'],
                        'name': entity['name'],
                        'settings': json.loads(entity['settings']),
                        'backend_settings': json.loads(entity.get('backend_settings', '{}'))
                    }
                    environments.append(environment)

                # Store in cache
                await self._set_in_cache(user_id, environments)
                return environments

        except Exception as e:
            logging.error(f"Error fetching environments: {str(e)}")
            raise

    async def _get_from_cache(self, user_id: str) -> Optional[List[Dict]]:
        """Get environments from cache if available"""
        async with self.cache_lock:
            cache_key = f"environments_{user_id}"
            return self.cache.get(cache_key)

    async def _set_in_cache(self, user_id: str, environments: List[Dict]):
        """Set environments in cache"""
        async with self.cache_lock:
            cache_key = f"environments_{user_id}"
            self.cache[cache_key] = environments

    async def _clear_cache(self, user_id: str):
        """Clear cache for a specific user"""
        async with self.cache_lock:
            cache_key = f"environments_{user_id}"
            self.cache.pop(cache_key, None)

    async def create_environment(self, user_id: str, environment_data: Dict) -> Dict:
        """Create a new environment with both frontend and backend settings"""
        try:
            async with TableServiceClient.from_connection_string(self.connection_string) as table_service:
                table_client = table_service.get_table_client(self.table_name)
                
                # Validate backend settings if provided
                if 'backend_settings' in environment_data:
                    backend_settings = BackendSettings(**environment_data['backend_settings'])
                    backend_settings_json = backend_settings.model_dump_json()
                else:
                    backend_settings_json = "{}"

                # Prepare entity
                entity = {
                    'PartitionKey': user_id,
                    'RowKey': environment_data.get('id', str(uuid.uuid4())),
                    'name': environment_data['name'],
                    'settings': json.dumps(environment_data['settings']),  # Frontend settings
                    'backend_settings': backend_settings_json  # Backend settings
                }
                
                await table_client.create_entity(entity=entity)
                await self._clear_cache(user_id)
                
                return {
                    'id': entity['RowKey'],
                    'userId': entity['PartitionKey'],
                    'name': entity['name'],
                    'settings': environment_data['settings'],
                    'backend_settings': json.loads(backend_settings_json)
                }

        except Exception as e:
            logging.error(f"Error creating environment: {str(e)}")
            raise

    async def update_environment(self, user_id: str, environment_id: str, environment_data: Dict) -> Optional[Dict]:
        """Update an existing environment"""
        try:
            async with TableServiceClient.from_connection_string(self.connection_string) as table_service:
                table_client = table_service.get_table_client(self.table_name)
                
                # Get existing entity
                try:
                    entity = await table_client.get_entity(user_id, environment_id)
                except:
                    return None
                
                # Update entity
                entity['name'] = environment_data.get('name', entity['name'])
                entity['settings'] = json.dumps(environment_data.get('settings', json.loads(entity['settings'])))
                
                await table_client.update_entity(entity=entity)
                
                # Clear cache to force refresh
                await self._clear_cache(user_id)
                
                # Return updated environment
                return {
                    'id': entity['RowKey'],
                    'userId': entity['PartitionKey'],
                    'name': entity['name'],
                    'settings': json.loads(entity['settings']),
                }

        except Exception as e:
            logging.error(f"Error updating environment: {str(e)}")
            raise

    async def delete_environment(self, user_id: str, environment_id: str) -> bool:
        """Delete an environment"""
        try:
            async with TableServiceClient.from_connection_string(self.connection_string) as table_service:
                table_client = table_service.get_table_client(self.table_name)
                
                await table_client.delete_entity(user_id, environment_id)
                
                # Clear cache to force refresh
                await self._clear_cache(user_id)
                
                return True

        except Exception as e:
            logging.error(f"Error deleting environment: {str(e)}")
            return False