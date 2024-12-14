from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator, validator
from typing import Optional

class OpenAISettings(BaseModel):
    # Remove resource requirement since it's not used in your config
    resource: Optional[str] = None
    temperature: float = 0.7
    top_p: float = 0.95
    max_tokens: int = 1000
    system_message: str
    embedding_name: Optional[str] = None
    embedding_endpoint: Optional[str] = None
    embedding_key: Optional[str] = None

class SearchSettings(BaseModel):
    top_k: int = 5
    strictness: int = 3
    enable_in_domain: bool = True
    datasource_type: Optional[str] = None  # Make optional since it can be None

class AzureSearchSettings(BaseModel):
    service: Optional[str] = None          # Make fields optional
    index: Optional[str] = None
    key: Optional[str] = None
    query_type: str = "vectorSimpleHybrid"
    semantic_search_config: Optional[str] = None
    index_is_prechunked: bool = False
    top_k: int = 5
    enable_in_domain: bool = False
    content_columns: Optional[str] = None
    filename_column: Optional[str] = None
    title_column: Optional[str] = None
    url_column: Optional[str] = None
    vector_columns: Optional[str] = None
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