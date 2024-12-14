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
    # Class-level configuration for enabling/disabling cache
    ENABLE_CACHE = False  # Default to False since caching was causing issues
    
    def __init__(self):
        if not app_settings.azure_storage.connection_string:
            raise ValueError("Azure Storage connection string not configured")
            
        self.connection_string = app_settings.azure_storage.connection_string
        self.table_name = app_settings.azure_storage.table
        
        # Only initialize cache if enabled
        if self.ENABLE_CACHE:
            self.cache = TTLCache(maxsize=100, ttl=app_settings.azure_storage.cache_ttl)
            self.cache_lock = asyncio.Lock()

    async def init_table(self):
        """Initialize the table if it doesn't exist"""
        try:
            async with TableServiceClient.from_connection_string(self.connection_string) as table_service:
                table = await table_service.create_table_if_not_exists(self.table_name)
                return table
        except Exception as e:
            logging.error(f"Error initializing table: {str(e)}")
            raise

    async def get_environments(self, user_id: str) -> List[Dict]:
        """Get environments for a user, with both frontend and backend settings"""
        # Only check cache if enabled
        if self.ENABLE_CACHE:
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
                        'backend_settings': json.loads(entity.get('backend_settings', '{}')), 
                        'timestamp': entity._metadata['timestamp'].isoformat() 
                    }
                    # print(entity._metadata)
                    environments.append(environment)

                # Store in cache only if enabled
                if self.ENABLE_CACHE:
                    await self._set_in_cache(user_id, environments)
                    
                return environments

        except Exception as e:
            logging.error(f"Error fetching environments: {str(e)}")
            raise

    async def get_environment(self, config_id: str) -> Optional[Dict]:
        """Get a specific environment configuration"""
        try:
            async with TableServiceClient.from_connection_string(self.connection_string) as table_service:
                table_client = table_service.get_table_client(self.table_name)
                filter_query = f"RowKey eq '{config_id}'"
                entities = [entity async for entity in table_client.query_entities(filter_query)]
            
            if not entities:
                return None
                
            entity = entities[0]
            config = {
                "id": entity["RowKey"],
                "userId": entity["PartitionKey"],
                "name": entity["name"],
                "settings": json.loads(entity["settings"]),
                "backend_settings": json.loads(entity["backend_settings"]),
                'timestamp': entity._metadata['timestamp'].isoformat() 
            }

            return config
            
        except Exception as e:
            logging.exception("Failed to get environment")
            raise

    async def _get_from_cache(self, user_id: str) -> Optional[List[Dict]]:
        """Get environments from cache if available"""
        if not self.ENABLE_CACHE:
            return None
            
        async with self.cache_lock:
            cache_key = f"environments_{user_id}"
            return self.cache.get(cache_key)

    async def _set_in_cache(self, user_id: str, environments: List[Dict]):
        """Set environments in cache"""
        if not self.ENABLE_CACHE:
            return
            
        async with self.cache_lock:
            cache_key = f"environments_{user_id}"
            self.cache[cache_key] = environments

    async def _clear_cache(self, user_id: str):
        """Clear cache for a specific user"""
        if not self.ENABLE_CACHE:
            return
            
        async with self.cache_lock:
            cache_key = f"environments_{user_id}"
            self.cache.pop(cache_key, None)

    async def create_environment(self, user_id: str, environment_data: Dict) -> Dict:
        """Create a new environment configuration"""
        try:
            # Validate backend settings
            # backend_settings = BackendSettings(**environment_data['backend_settings'])
            
            # Determine partition key based on isGlobal flag and admin status
            is_admin = user_id in app_settings.base_settings.admin_users
            is_global = environment_data.get('isGlobal', False)

            # Non-admins can't create global configurations
            if is_global and not is_admin:
                raise ValueError("Only administrators can create global configurations")
            
            partition_key = '00000000-0000-0000-0000-000000000000' if is_global else user_id

            new_id = str(uuid.uuid4())
            entity = {
                "PartitionKey": partition_key,
                "RowKey": new_id,
                "name": environment_data["name"],
                "settings": json.dumps(environment_data.get("settings", {})),
                "backend_settings": json.dumps(environment_data.get("backend_settings", {}))
            }
            
            async with TableServiceClient.from_connection_string(self.connection_string) as table_service:
                table_client = table_service.get_table_client(self.table_name)
                await table_client.create_entity(entity=entity)
            
            if self.ENABLE_CACHE:
                await self._clear_cache(user_id)
            
            return {
                "id": new_id,
                "userId": user_id,
                "name": entity["name"],
                "settings": json.loads(entity["settings"]),
                "backend_settings": json.loads(entity["backend_settings"])
            }
                
        except Exception as e:
            logging.exception("Error creating environment")
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
                entity['backend_settings'] = json.dumps(environment_data.get('backend_settings', {}))
                
                await table_client.update_entity(entity=entity)
                
                if self.ENABLE_CACHE:
                    await self._clear_cache(user_id)
                
                # Return updated environment
                return {
                    'id': entity['RowKey'],
                    'userId': entity['PartitionKey'],
                    'name': entity['name'],
                    'settings': json.loads(entity['settings']),
                    'backend_settings': json.loads(entity['backend_settings'])
                }

        except Exception as e:
            logging.error(f"Error updating environment: {str(e)}")
            raise

    async def delete_environment(self, user_id: str, config_id: str) -> bool:
        """Delete an environment configuration"""
        try:
            # First verify the environment exists and belongs to this user
            env = await self.get_environment(config_id)
            if not env:
                return False
                
            if env["userId"] != user_id:
                raise ValueError("Unauthorized to delete this configuration")
            
            async with TableServiceClient.from_connection_string(self.connection_string) as table_service:
                table_client = table_service.get_table_client(self.table_name)
                await table_client.delete_entity(
                    partition_key=user_id,
                    row_key=config_id
                )

            if self.ENABLE_CACHE:
                await self._clear_cache(user_id)

            return True
                
        except Exception as e:
            logging.exception("Failed to delete environment")
            raise