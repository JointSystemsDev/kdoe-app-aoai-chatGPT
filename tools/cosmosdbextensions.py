import os
from azure.cosmos import CosmosClient, PartitionKey
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from the .env file in the parent directory
env_path = Path('..') / '.env'  # Define path to the .env file
load_dotenv(dotenv_path=env_path)  # Load the .env file from the parent directory

# Retrieve values from the environment variables
cosmos_account_name = os.getenv('AZURE_COSMOSDB_ACCOUNT')
cosmos_db_endpoint = f"https://{cosmos_account_name}.documents.azure.com:443/"
key = os.getenv('AZURE_COSMOSDB_ACCOUNT_KEY')
database_name = os.getenv('AZURE_COSMOSDB_DATABASE')
container_name = "environments"

# Initialize the Cosmos client
client = CosmosClient(cosmos_db_endpoint, key)

# Create a database if not exists
database = client.create_database_if_not_exists(id=database_name)

# Define indexing policy with mandatory root "/" path and specific paths for id and userId
indexing_policy = {
    'indexingMode': 'consistent',
    'automatic': True,
    'includedPaths': [
        {'path': '/*'},      # This ensures that all fields are indexed by default
        {'path': '/userId/?'} # Index on 'userId' for queries
    ]
}

# Create a container with the partition key on /userId
partition_key = PartitionKey(path="/userId")

container = database.create_container_if_not_exists(
    id=container_name, 
    partition_key=partition_key,
    indexing_policy=indexing_policy,  # Apply the indexing policy
    offer_throughput=400
)

print(f"Container '{container_name}' created with /userId as partition key and indexed on /id, /userId, and all fields.")
