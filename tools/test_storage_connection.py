import os
from azure.data.tables import TableServiceClient
from dotenv import load_dotenv

def test_storage_connection():
    # Load environment variables
    load_dotenv()
    
    # Get connection string
    connection_string = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
    print(f"Connection string exists: {bool(connection_string)}")
    
    try:
        # Try to create a client
        service_client = TableServiceClient.from_connection_string(connection_string)
        print("Successfully created TableServiceClient")
        
        # List tables to verify connection
        tables = list(service_client.list_tables())
        print(f"Successfully listed tables. Found {len(tables)} tables:")
        for table in tables:
            print(f"- {table.name}")
            
        return True
    except Exception as e:
        print(f"Error connecting to Azure Storage: {str(e)}")
        return False

if __name__ == "__main__":
    test_storage_connection()