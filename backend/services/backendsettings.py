from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator, validator
from typing import Optional, Self

class OpenAISettings(BaseModel):
    model_config = ConfigDict(
        protected_namespaces=()  # Disable protected namespace checking
    )
    resource: str
    # model: str
    # key: str
    # deployment_name: str = Field(..., description="The deployment name of the model")  # Changed from model_name
    temperature: float = 0.7
    top_p: float = 0.95
    max_tokens: int = 1000
    system_message: str
    # preview_api_version: str
    embedding_name: Optional[str] = None
    embedding_endpoint: Optional[str] = None
    embedding_key: Optional[str] = None

class SearchSettings(BaseModel):
    top_k: int = 5
    strictness: int = 3
    enable_in_domain: bool = True
    datasource_type: str = None # "AzureCognitiveSearch"

    @field_validator("top_k")
    def validate_top_k(cls, v):
        if v < 1:
            raise ValueError("top_k must be at least 1")
        return v

class AzureSearchSettings(BaseModel):
    service: str
    index: str
    key: str
    query_type: str = "vectorSimpleHybrid"
    semantic_search_config: str = ""
    index_is_prechunked: bool = True
    top_k: int = 5
    enable_in_domain: bool = False
    content_columns: str = "chunk"
    filename_column: str = "id"
    title_column: str = "title"
    url_column: Optional[str] = None
    vector_columns: str = "text_vector"
    permitted_groups_column: Optional[str] = None
    strictness: int = 3

    @field_validator("query_type")
    def validate_query_type(cls, v):
        if v not in ["vectorSimpleHybrid", "anotherType"]:
            raise ValueError("query_type must be 'vectorSimpleHybrid' or 'anotherType'")
        return v    

class BackendSettings(BaseModel):
    openai: OpenAISettings
    search: SearchSettings
    azure_search: AzureSearchSettings