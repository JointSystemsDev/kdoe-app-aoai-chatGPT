import copy
import json
import os
import logging
import uuid
import httpx
import asyncio
from typing import List, Optional, Any, Tuple
from typing import Dict, Union
from quart import (
    Blueprint,
    Quart,
    jsonify,
    make_response,
    request,
    send_from_directory,
    render_template,
    current_app,
)

from backend.services.TableEnvironmentService import TableEnvironmentService

from openai import AsyncAzureOpenAI
from azure.identity.aio import (
    DefaultAzureCredential,
    get_bearer_token_provider
)
from backend.auth.auth_utils import get_authenticated_user_details
from backend.security.ms_defender_utils import get_msdefender_user_json
from backend.history.cosmosdbservice import CosmosConversationClient
from backend.settings import (
    app_settings,
    MINIMUM_SUPPORTED_AZURE_OPENAI_PREVIEW_API_VERSION
)
from backend.utils import (
    format_as_ndjson,
    format_stream_response,
    format_non_streaming_response,
    convert_to_pf_format,
    format_pf_non_streaming_response,
)

# Initialize the environment service
async def init_environment_service():
    env_service = None
    try:
        if app_settings.azure_storage.connection_string:
            logging.debug("Initializing TableEnvironmentService")
            env_service = TableEnvironmentService()
            logging.debug("Initializing table")
            await env_service.init_table()
            logging.debug("Table initialization complete")
        else:
            logging.warning("Azure Storage not configured for environments. Check your .env file and AZURE_STORAGE_CONNECTION_STRING setting.")
    except Exception as e:
        logging.exception("Failed to initialize environment service")
        raise e
    return env_service

class Environment:
    def __init__(self, id: str, name: str, settings: dict):
        self.id = id
        self.name = name
        self.settings = settings
bp = Blueprint("routes", __name__, static_folder="static", template_folder="static")

cosmos_db_ready = asyncio.Event()


def create_app():
    app = Quart(__name__)
    app.register_blueprint(bp)
    app.config["TEMPLATES_AUTO_RELOAD"] = True
    
    @app.before_serving
    async def init():
        try:
            app.cosmos_conversation_client = await init_cosmosdb_client()
            app.environment_service = await init_environment_service()
            cosmos_db_ready.set()
        except Exception as e:
            logging.exception("Failed to initialize CosmosDB client")
            app.cosmos_conversation_client = None
            app.environment_service = None
            raise e
    
    return app


@bp.route("/")
async def index():
    return await render_template(
        "index.html",
        title=app_settings.ui.title,
        favicon=app_settings.ui.favicon
    )


@bp.route("/favicon.ico")
async def favicon():
    return await bp.send_static_file("favicon.ico")


@bp.route("/assets/<path:path>")
async def assets(path):
    return await send_from_directory("static/assets", path)


@bp.route("/api/environments", methods=["GET"])
async def get_environments():
    """Get list of available environments"""
    try:
        if not current_app.environment_service:
            raise Exception("Environment service not configured")

        authenticated_user = get_authenticated_user_details(request.headers)
        user_id = authenticated_user["user_principal_id"]
        
        environments = await current_app.environment_service.get_environments(user_id)
        
        # Format the response
        formatted_environments = [{
            "id": env["id"],
            "name": env["name"]
        } for env in environments]
        
        return jsonify(formatted_environments)
    except Exception as e:
        logging.exception("Error fetching environments")
        return jsonify({"error": str(e)}), 500


@bp.route("/frontend_settings", methods=["GET"])
async def get_frontend_settings():
    """Get frontend settings, optionally for a specific environment"""
    try:
        env_id = request.args.get("env")
        authenticated_user = get_authenticated_user_details(request.headers)
        user_id = authenticated_user["user_principal_id"]
        
        # Get base settings
        settings = frontend_settings

        # If environment is specified, get environment settings
        if env_id and current_app.environment_service:
            environments = await current_app.environment_service.get_environments(user_id)
            matching_env = next((env for env in environments if env["id"] == env_id), None)
            
            if matching_env and "settings" in matching_env:
                settings["ui"] = matching_env["settings"]
        
        return jsonify(settings), 200
    except Exception as e:
        logging.exception("Exception in /frontend_settings")
        return jsonify({"error": str(e)}), 500
    

# Debug settings
DEBUG = os.environ.get("DEBUG", "false")
if DEBUG.lower() == "true":
    logging.basicConfig(level=logging.DEBUG)

USER_AGENT = "GitHubSampleWebApp/AsyncAzureOpenAI/1.0.0"


# Frontend Settings via Environment Variables
frontend_settings = {
    "auth_enabled": app_settings.base_settings.auth_enabled,
    "feedback_enabled": (
        app_settings.chat_history and
        app_settings.chat_history.enable_feedback
    ),
    "ui": {
        "title": app_settings.ui.title,
        "logo": app_settings.ui.logo,
        "chat_logo": app_settings.ui.chat_logo or app_settings.ui.logo,
        "chat_title": app_settings.ui.chat_title,
        "chat_description": app_settings.ui.chat_description,
        "show_share_button": app_settings.ui.show_share_button,
        "show_chat_history_button": app_settings.ui.show_chat_history_button,
        # JS specific
        "enable_image_chat": app_settings.ui.enable_image_chat,
        "language": app_settings.ui.language,
        "additional_header_logo": app_settings.ui.additional_header_logo,
        "help_link_title": app_settings.ui.help_link_title,
        "help_link_url": app_settings.ui.help_link_url,
        "limit_input_to_characters": app_settings.ui.limit_input_to_characters,
        "appinsights_instrumentationkey": app_settings.ui.appinsights_instrumentationkey,
        "enable_mode_selector": app_settings.ui.enable_mode_selector,
    },
    "sanitize_answer": app_settings.base_settings.sanitize_answer,
    "oyd_enabled": app_settings.base_settings.datasource_type,
}


# Enable Microsoft Defender for Cloud Integration
MS_DEFENDER_ENABLED = os.environ.get("MS_DEFENDER_ENABLED", "true").lower() == "true"

def build_openai_request_params(environment_id):
    """
    Builds the extra headers and query parameters for OpenAI API requests based on environment settings.
    
    Args:
        environment_settings (Dict): Environment configuration dictionary containing OpenAI settings
        
    Returns:
        Tuple[Dict[str, str], Dict[str, str]]: A tuple of (extra_headers, extra_query)
    """   
    # Initialize default headers
    extra_headers = {
        "x-ms-useragent": USER_AGENT,
        "Content-Type": "application/json"
    }
    
    # Initialize default query parameters
    default_query = {}
    
    # Add APIM subscription key if available
    if app_settings.azure_openai.apim_key:
        extra_headers.update({
            "api-key":app_settings.azure_openai.apim_key,
            "Ocp-Apim-Subscription-Key":app_settings.azure_openai.apim_key
        })
    
    # Add organization and app name to query parameters if both are available
    if app_settings.azure_openai.apim_organization and app_settings.azure_openai.apim_appname:
        default_query.update({
            "appName": app_settings.azure_openai.apim_appname,
            "organizationName": app_settings.azure_openai.apim_organization + "." + environment_id
        })
    return extra_headers, default_query

# Initialize Azure OpenAI Client
async def init_openai_client(environment_settings: Optional[Dict[str, Any]] = None):
    try:
        if not environment_settings or 'backend_settings' not in environment_settings:
            raise ValueError("Environment settings are required")

        openai_settings = environment_settings['backend_settings']['openai']
        
        # Validate API version
        if app_settings.azure_openai.preview_api_version < MINIMUM_SUPPORTED_AZURE_OPENAI_PREVIEW_API_VERSION:
            raise ValueError(
                f"Minimum supported Azure OpenAI preview API version is '{MINIMUM_SUPPORTED_AZURE_OPENAI_PREVIEW_API_VERSION}'"
            )

        # Base headers
        default_headers = {
            "x-ms-useragent": USER_AGENT,
            "Content-Type": "application/json"
        }
        
        # Configure endpoint and headers for APIM or direct OpenAI access
        if app_settings.azure_openai.apim_endpoint:
            # Use APIM-specific endpoint and headers
            endpoint = app_settings.azure_openai.apim_endpoint
        else:
            # Fallback to the direct Azure OpenAI endpoint if APIM is not configured
            endpoint = f"https://{app_settings.azure_openai.resource}.openai.azure.com/"
            default_headers["api-key"] = app_settings.azure_openai.key  # Include API key if direct access

        # Set up authentication
        aoai_api_key = app_settings.azure_openai.key
        ad_token_provider = None

        # Configure Azure AD authentication if API key is not used
        if not aoai_api_key:
            logging.info("Using Azure Entra ID authentication")
            credential = DefaultAzureCredential()
            ad_token_provider = get_bearer_token_provider(
                credential,
                "https://cognitiveservices.azure.com/.default"
            )

        # Return configured AsyncAzureOpenAI client
        return AsyncAzureOpenAI(
            api_version=app_settings.azure_openai.preview_api_version,
            api_key=aoai_api_key,
            azure_ad_token_provider=ad_token_provider,
            default_headers=default_headers,
            azure_endpoint=endpoint
        )

    except Exception as e:
        logging.exception("Failed to initialize Azure OpenAI client")
        raise


async def init_cosmosdb_client():
    cosmos_conversation_client = None
    if app_settings.chat_history:
        try:
            cosmos_endpoint = (
                f"https://{app_settings.chat_history.account}.documents.azure.com:443/"
            )

            if not app_settings.chat_history.account_key:
                async with DefaultAzureCredential() as cred:
                    credential = cred
                    
            else:
                credential = app_settings.chat_history.account_key

            cosmos_conversation_client = CosmosConversationClient(
                cosmosdb_endpoint=cosmos_endpoint,
                credential=credential,
                database_name=app_settings.chat_history.database,
                container_name=app_settings.chat_history.conversations_container,
                enable_message_feedback=app_settings.chat_history.enable_feedback,
            )
        except Exception as e:
            logging.exception("Exception in CosmosDB initialization", e)
            cosmos_conversation_client = None
            raise e
    else:
        logging.debug("CosmosDB not configured")

    return cosmos_conversation_client

async def prepare_model_args(request_body, request_headers, environment_settings):
    request_messages = request_body.get("messages", [])
    extra_headers, extra_query = build_openai_request_params(environment_settings['id'])

    messages = []
    
    if not environment_settings:
        raise ValueError(f"No environment set")

    messages = [
        {
            "role": "system",
            "content": environment_settings['backend_settings']['openai']['system_message']
        }
    ]

    for message in request_messages:
        if message:
            content = message["content"]
            # Handle array content types
            if isinstance(content, list):
                if len(content) == 2:
                    # Check if it's an image message
                    if isinstance(content[0], dict) and 'type' in content[0]:
                        if content[1].get('type') == 'document':
                            # For document types, format similarly to legacy PDF content
                            messages.append({
                                "role": message["role"],
                                "content": f"{content[0]['text']}\n\nAdditional Context:\n{content[1]['content']}"
                            })
                        else:
                            # Keep image messages as is
                            messages.append({
                                "role": message["role"],
                                "content": content
                            })
                    else:
                        # For legacy PDF content, join with separator
                        messages.append({
                            "role": message["role"],
                            "content": f"{content[0]}\n\nAdditional Context:\n{content[1]}"
                        })
                else:
                    # Invalid array format
                    raise ValueError("Invalid message format")
            else:
                # Regular string content
                messages.append({
                    "role": message["role"],
                    "content": content
                })

    # Rest of the function remains the same...
    if (MS_DEFENDER_ENABLED):
        authenticated_user_details = get_authenticated_user_details(request_headers)
        conversation_id = request_body.get("conversation_id", None)
        application_name = app_settings.ui.title
        user_json = get_msdefender_user_json(authenticated_user_details, request_headers, conversation_id, application_name)
    
    # Use environment-specific settings if available
    openai_settings = environment_settings['backend_settings']['openai']
    model_args = {
        "messages": messages,
        "temperature": openai_settings['temperature'],
        "max_tokens": openai_settings['max_tokens'],
        "top_p": openai_settings['top_p'],
        "stop": app_settings.azure_openai.stop_sequence,
        "stream": app_settings.azure_openai.stream,
        "model": app_settings.azure_openai.model,
        "user": user_json if MS_DEFENDER_ENABLED else None,
        "extra_headers": extra_headers,
        "extra_query": extra_query
    }

    azure_search_settings = environment_settings['backend_settings']['azure_search']
    if azure_search_settings['service']:
        model_args["extra_body"] = {
            "data_sources": [
                construct_datasource_payload(request, environment_settings)
            ]
        }

    return model_args

# Helper function to construct datasource payload based on environment settings
def construct_datasource_payload(request, environment_settings):
    search_settings = environment_settings['backend_settings']['azure_search']
    openai_settings = environment_settings['backend_settings']['openai']
    
    # Prepare the embedding dependency - simpler structure now
    embedding_dependency = {
        "type": "deployment_name",
        "deployment_name": openai_settings.get('embedding_name', "text-embedding-ada-002")
    }

    return {
        "type": "azure_search",
        "parameters": {
            "allow_partial_result": False,
            "authentication": {
                "type": "api_key",
                "key": search_settings['key']
            },
            "embedding_dependency": embedding_dependency,
            "endpoint": f"https://{search_settings['service']}.search.windows.net",
            "fields_mapping": {
                "content_fields": [search_settings['content_columns']],
                "title_field": search_settings['title_column'],
                "url_field": search_settings.get('url_column'),
                "filepath_field": search_settings['filename_column'],
                "vector_fields": [search_settings['vector_columns']]
            },
            "in_scope": search_settings['enable_in_domain'],
            "include_contexts": [
                "citations",
                "intent"
            ],
            "index_name": search_settings['index'],
            "query_type": search_settings['query_type'].lower(),
            "role_information": openai_settings['system_message'],
            "semantic_configuration": search_settings['semantic_search_config'],
            "strictness": search_settings['strictness'],
            "top_n_documents": search_settings['top_k']
        }
    }

async def promptflow_request(request):
    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {app_settings.promptflow.api_key}",
        }
        # Adding timeout for scenarios where response takes longer to come back
        logging.debug(f"Setting timeout to {app_settings.promptflow.response_timeout}")
        async with httpx.AsyncClient(
            timeout=float(app_settings.promptflow.response_timeout)
        ) as client:
            pf_formatted_obj = convert_to_pf_format(
                request,
                app_settings.promptflow.request_field_name,
                app_settings.promptflow.response_field_name
            )
            # NOTE: This only support question and chat_history parameters
            # If you need to add more parameters, you need to modify the request body
            response = await client.post(
                app_settings.promptflow.endpoint,
                json={
                    app_settings.promptflow.request_field_name: pf_formatted_obj[-1]["inputs"][app_settings.promptflow.request_field_name],
                    "chat_history": pf_formatted_obj[:-1],
                },
                headers=headers,
            )
        resp = response.json()
        resp["id"] = request["messages"][-1]["id"]
        return resp
    except Exception as e:
        logging.error(f"An error occurred while making promptflow_request: {e}")



async def send_chat_request(request_body, request_headers):
    filtered_messages = []
    messages = request_body.get("messages", [])
    for message in messages:
        if message.get("role") != 'tool':
            filtered_messages.append(message)
            
    request_body['messages'] = filtered_messages

    # Get environment settings
    environment_id = request_body.get("environment_id")
    environment_settings = None
    
    if environment_id and current_app.environment_service:
        # Get authenticated user
        authenticated_user = get_authenticated_user_details(request_headers)
        user_id = authenticated_user["user_principal_id"]
        
        # Get environments for user
        environments = await current_app.environment_service.get_environments(user_id)
        environment_settings = next((env for env in environments if env["id"] == environment_id), None)

    model_args = await prepare_model_args(request_body, request_headers, environment_settings)

    try:
        azure_openai_client = await init_openai_client(environment_settings)
        
        
        raw_response = await azure_openai_client.chat.completions.with_raw_response.create(**model_args)
        response = raw_response.parse()
        apim_request_id = raw_response.headers.get("apim-request-id") 
    except Exception as e:
        logging.exception("Exception in send_chat_request")
        raise e

    return response, apim_request_id


async def complete_chat_request(request_body, request_headers):
    if app_settings.base_settings.use_promptflow:
        response = await promptflow_request(request_body)
        history_metadata = request_body.get("history_metadata", {})
        return format_pf_non_streaming_response(
            response,
            history_metadata,
            app_settings.promptflow.response_field_name,
            app_settings.promptflow.citations_field_name
        )
    else:
        response, apim_request_id = await send_chat_request(request_body, request_headers)
        history_metadata = request_body.get("history_metadata", {})
        return format_non_streaming_response(response, history_metadata, apim_request_id)


async def stream_chat_request(request_body, request_headers):
    response, apim_request_id = await send_chat_request(request_body, request_headers)
    history_metadata = request_body.get("history_metadata", {})
    
    async def generate():
        async for completionChunk in response:
            yield format_stream_response(completionChunk, history_metadata, apim_request_id)

    return generate()


async def conversation_internal(request_body, request_headers):
    try:
        if app_settings.azure_openai.stream and not app_settings.base_settings.use_promptflow:
            result = await stream_chat_request(request_body, request_headers)
            response = await make_response(format_as_ndjson(result))
            response.timeout = None
            response.mimetype = "application/json-lines"
            return response
        else:
            result = await complete_chat_request(request_body, request_headers)
            return jsonify(result)

    except Exception as ex:
        logging.exception(ex)
        if hasattr(ex, "status_code"):
            return jsonify({"error": str(ex)}), ex.status_code
        else:
            return jsonify({"error": str(ex)}), 500


@bp.route("/conversation", methods=["POST"])
async def conversation():
    if not request.is_json:
        return jsonify({"error": "request must be json"}), 415
    
    request_json = await request.get_json()
    
    # Get environment ID from request
    environment_id = request_json.get("environment_id")
    environment_settings = None
    
    if environment_id and current_app.environment_service:
        # Get authenticated user
        authenticated_user = get_authenticated_user_details(request.headers)
        user_id = authenticated_user["user_principal_id"]
        
        # Get environments for user
        environments = await current_app.environment_service.get_environments(user_id)
        environment_settings = next((env for env in environments if env["id"] == environment_id), None)

    try:
        model_args = await prepare_model_args(request_json, request.headers, environment_settings)
        # Initialize Azure OpenAI client with environment-specific settings
        if environment_settings and 'backend_settings' in environment_settings:
            openai_settings = environment_settings['backend_settings']['openai']
            azure_openai_client = AsyncAzureOpenAI(
                api_version=app_settings.azure_openai.preview_api_version,
                azure_endpoint=f"https://{openai_settings['resource']}.openai.azure.com/",
                api_key=openai_settings['key'],
                default_headers={"x-ms-useragent": USER_AGENT}
            )
        else:
            azure_openai_client = await init_openai_client(environment_settings)

        response = await azure_openai_client.chat.completions.create(**model_args)
        
        if app_settings.azure_openai.stream and not app_settings.base_settings.use_promptflow:
            result = await stream_chat_request(model_args, request.headers)
            response = await make_response(format_as_ndjson(result))
            response.timeout = None
            response.mimetype = "application/json-lines"
            return response
        else:
            result = await complete_chat_request(model_args, request.headers)
            return jsonify(result)

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logging.exception(e)
        return jsonify({"error": str(e)}), 500


## Conversation History API ##
@bp.route("/history/generate", methods=["POST"])
async def add_conversation():
    await cosmos_db_ready.wait()
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    user_id = authenticated_user["user_principal_id"]

    request_json = await request.get_json()
    conversation_id = request_json.get("conversation_id", None)
    environment_id = request_json.get("environment_id", None)

    environment_settings = None
    if environment_id and current_app.environment_service:
        # Get authenticated user
        authenticated_user = get_authenticated_user_details(request.headers)
        user_id = authenticated_user["user_principal_id"]
        
        # Get environments for user
        environments = await current_app.environment_service.get_environments(user_id)
        environment_settings = next((env for env in environments if env["id"] == environment_id), None)

    try:
        if not current_app.cosmos_conversation_client:
            raise Exception("CosmosDB is not configured or not working")

        history_metadata = {}
        if not conversation_id:
            title = await generate_title(request_json["messages"], environment_settings)
            conversation_dict = await current_app.cosmos_conversation_client.create_conversation(
                user_id=user_id,
                title=title,
                environment_id=environment_id
            )
            conversation_id = conversation_dict["id"]
            history_metadata["title"] = title
            history_metadata["date"] = conversation_dict["createdAt"]

        ## Format the incoming message object in the "chat/completions" messages format
        ## then write it to the conversation history in cosmos
        messages = request_json["messages"]
        if len(messages) > 0 and messages[-1]["role"] == "user":
            createdMessageValue = await current_app.cosmos_conversation_client.create_message(
                uuid=str(uuid.uuid4()),
                conversation_id=conversation_id,
                user_id=user_id,
                input_message=messages[-1],
            )
            if createdMessageValue == "Conversation not found":
                raise Exception(
                    "Conversation not found for the given conversation ID: "
                    + conversation_id
                    + "."
                )
        else:
            raise Exception("No user message found")

        # Submit request to Chat Completions for response
        request_body = await request.get_json()
        history_metadata["conversation_id"] = conversation_id
        request_body["history_metadata"] = history_metadata
        return await conversation_internal(request_body, request.headers)

    except Exception as e:
        logging.exception("Exception in /history/generate")
        return jsonify({"error": str(e)}), 500


@bp.route("/history/update", methods=["POST"])
async def update_conversation():
    await cosmos_db_ready.wait()
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    user_id = authenticated_user["user_principal_id"]

    ## check request for conversation_id
    request_json = await request.get_json()
    conversation_id = request_json.get("conversation_id", None)

    try:
        # make sure cosmos is configured
        if not current_app.cosmos_conversation_client:
            raise Exception("CosmosDB is not configured or not working")

        # check for the conversation_id, if the conversation is not set, we will create a new one
        if not conversation_id:
            raise Exception("No conversation_id found")

        ## Format the incoming message object in the "chat/completions" messages format
        ## then write it to the conversation history in cosmos
        messages = request_json["messages"]
        if len(messages) > 0 and messages[-1]["role"] == "assistant":
            if len(messages) > 1 and messages[-2].get("role", None) == "tool":
                # write the tool message first
                await current_app.cosmos_conversation_client.create_message(
                    uuid=str(uuid.uuid4()),
                    conversation_id=conversation_id,
                    user_id=user_id,
                    input_message=messages[-2],
                )
            # write the assistant message
            await current_app.cosmos_conversation_client.create_message(
                uuid=messages[-1]["id"],
                conversation_id=conversation_id,
                user_id=user_id,
                input_message=messages[-1],
            )
        else:
            raise Exception("No bot messages found")

        # Submit request to Chat Completions for response
        response = {"success": True}
        return jsonify(response), 200

    except Exception as e:
        logging.exception("Exception in /history/update")
        return jsonify({"error": str(e)}), 500


@bp.route("/history/message_feedback", methods=["POST"])
async def update_message():
    await cosmos_db_ready.wait()
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    user_id = authenticated_user["user_principal_id"]

    ## check request for message_id
    request_json = await request.get_json()
    message_id = request_json.get("message_id", None)
    message_feedback = request_json.get("message_feedback", None)
    try:
        if not message_id:
            return jsonify({"error": "message_id is required"}), 400

        if not message_feedback:
            return jsonify({"error": "message_feedback is required"}), 400

        ## update the message in cosmos
        updated_message = await current_app.cosmos_conversation_client.update_message_feedback(
            user_id, message_id, message_feedback
        )
        if updated_message:
            return (
                jsonify(
                    {
                        "message": f"Successfully updated message with feedback {message_feedback}",
                        "message_id": message_id,
                    }
                ),
                200,
            )
        else:
            return (
                jsonify(
                    {
                        "error": f"Unable to update message {message_id}. It either does not exist or the user does not have access to it."
                    }
                ),
                404,
            )

    except Exception as e:
        logging.exception("Exception in /history/message_feedback")
        return jsonify({"error": str(e)}), 500


@bp.route("/history/delete", methods=["DELETE"])
async def delete_conversation():
    await cosmos_db_ready.wait()
    ## get the user id from the request headers
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    user_id = authenticated_user["user_principal_id"]

    ## check request for conversation_id
    request_json = await request.get_json()
    conversation_id = request_json.get("conversation_id", None)

    try:
        if not conversation_id:
            return jsonify({"error": "conversation_id is required"}), 400

        ## make sure cosmos is configured
        if not current_app.cosmos_conversation_client:
            raise Exception("CosmosDB is not configured or not working")

        ## delete the conversation messages from cosmos first
        deleted_messages = await current_app.cosmos_conversation_client.delete_messages(
            conversation_id, user_id
        )

        ## Now delete the conversation
        deleted_conversation = await current_app.cosmos_conversation_client.delete_conversation(
            user_id, conversation_id
        )

        return (
            jsonify(
                {
                    "message": "Successfully deleted conversation and messages",
                    "conversation_id": conversation_id,
                }
            ),
            200,
        )
    except Exception as e:
        logging.exception("Exception in /history/delete")
        return jsonify({"error": str(e)}), 500


@bp.route("/history/list", methods=["GET"])
async def list_conversations():
    await cosmos_db_ready.wait()
    offset = request.args.get("offset", 0)
    environment_id = request.args.get("env")
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    user_id = authenticated_user["user_principal_id"]

    if not current_app.cosmos_conversation_client:
        raise Exception("CosmosDB is not configured or not working")

    conversations = await current_app.cosmos_conversation_client.get_conversations(
        user_id,
        offset=offset,
        limit=25,
        environment_id=environment_id
    )
    if not isinstance(conversations, list):
        return jsonify({"error": f"No conversations for {user_id} were found"}), 404

    return jsonify(conversations), 200


@bp.route("/history/read", methods=["POST"])
async def get_conversation():
    await cosmos_db_ready.wait()
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    user_id = authenticated_user["user_principal_id"]

    ## check request for conversation_id
    request_json = await request.get_json()
    conversation_id = request_json.get("conversation_id", None)

    if not conversation_id:
        return jsonify({"error": "conversation_id is required"}), 400

    ## make sure cosmos is configured
    if not current_app.cosmos_conversation_client:
        raise Exception("CosmosDB is not configured or not working")

    ## get the conversation object and the related messages from cosmos
    conversation = await current_app.cosmos_conversation_client.get_conversation(
        user_id, conversation_id
    )
    ## return the conversation id and the messages in the bot frontend format
    if not conversation:
        return (
            jsonify(
                {
                    "error": f"Conversation {conversation_id} was not found. It either does not exist or the logged in user does not have access to it."
                }
            ),
            404,
        )

    # get the messages for the conversation from cosmos
    conversation_messages = await current_app.cosmos_conversation_client.get_messages(
        user_id, conversation_id
    )

    ## format the messages in the bot frontend format
    messages = [
        {
            "id": msg["id"],
            "role": msg["role"],
            "content": msg["content"],
            "createdAt": msg["createdAt"],
            "feedback": msg.get("feedback"),
        }
        for msg in conversation_messages
    ]

    return jsonify({"conversation_id": conversation_id, "messages": messages}), 200


@bp.route("/history/rename", methods=["POST"])
async def rename_conversation():
    await cosmos_db_ready.wait()
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    user_id = authenticated_user["user_principal_id"]

    ## check request for conversation_id
    request_json = await request.get_json()
    conversation_id = request_json.get("conversation_id", None)

    if not conversation_id:
        return jsonify({"error": "conversation_id is required"}), 400

    ## make sure cosmos is configured
    if not current_app.cosmos_conversation_client:
        raise Exception("CosmosDB is not configured or not working")

    ## get the conversation from cosmos
    conversation = await current_app.cosmos_conversation_client.get_conversation(
        user_id, conversation_id
    )
    if not conversation:
        return (
            jsonify(
                {
                    "error": f"Conversation {conversation_id} was not found. It either does not exist or the logged in user does not have access to it."
                }
            ),
            404,
        )

    ## update the title
    title = request_json.get("title", None)
    if not title:
        return jsonify({"error": "title is required"}), 400
    conversation["title"] = title
    updated_conversation = await current_app.cosmos_conversation_client.upsert_conversation(
        conversation
    )

    return jsonify(updated_conversation), 200


@bp.route("/history/delete_all", methods=["DELETE"])
async def delete_all_conversations():
    await cosmos_db_ready.wait()
    ## get the user id from the request headers
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    user_id = authenticated_user["user_principal_id"]

    # get conversations for user
    try:
        ## make sure cosmos is configured
        if not current_app.cosmos_conversation_client:
            raise Exception("CosmosDB is not configured or not working")

        conversations = await current_app.cosmos_conversation_client.get_conversations(
            user_id, offset=0, limit=None
        )
        if not conversations:
            return jsonify({"error": f"No conversations for {user_id} were found"}), 404

        # delete each conversation
        for conversation in conversations:
            ## delete the conversation messages from cosmos first
            deleted_messages = await current_app.cosmos_conversation_client.delete_messages(
                conversation["id"], user_id
            )

            ## Now delete the conversation
            deleted_conversation = await current_app.cosmos_conversation_client.delete_conversation(
                user_id, conversation["id"]
            )
        return (
            jsonify(
                {
                    "message": f"Successfully deleted conversation and messages for user {user_id}"
                }
            ),
            200,
        )

    except Exception as e:
        logging.exception("Exception in /history/delete_all")
        return jsonify({"error": str(e)}), 500


@bp.route("/history/clear", methods=["POST"])
async def clear_messages():
    await cosmos_db_ready.wait()
    ## get the user id from the request headers
    authenticated_user = get_authenticated_user_details(request_headers=request.headers)
    user_id = authenticated_user["user_principal_id"]

    ## check request for conversation_id
    request_json = await request.get_json()
    conversation_id = request_json.get("conversation_id", None)

    try:
        if not conversation_id:
            return jsonify({"error": "conversation_id is required"}), 400

        ## make sure cosmos is configured
        if not current_app.cosmos_conversation_client:
            raise Exception("CosmosDB is not configured or not working")

        ## delete the conversation messages from cosmos
        deleted_messages = await current_app.cosmos_conversation_client.delete_messages(
            conversation_id, user_id
        )

        return (
            jsonify(
                {
                    "message": "Successfully deleted messages in conversation",
                    "conversation_id": conversation_id,
                }
            ),
            200,
        )
    except Exception as e:
        logging.exception("Exception in /history/clear_messages")
        return jsonify({"error": str(e)}), 500


@bp.route("/history/ensure", methods=["GET"])
async def ensure_cosmos():
    await cosmos_db_ready.wait()
    if not app_settings.chat_history:
        return jsonify({"error": "CosmosDB is not configured"}), 404

    try:
        success, err = await current_app.cosmos_conversation_client.ensure()
        if not current_app.cosmos_conversation_client or not success:
            if err:
                return jsonify({"error": err}), 422
            return jsonify({"error": "CosmosDB is not configured or not working"}), 500

        return jsonify({"message": "CosmosDB is configured and working"}), 200
    except Exception as e:
        logging.exception("Exception in /history/ensure")
        cosmos_exception = str(e)
        if "Invalid credentials" in cosmos_exception:
            return jsonify({"error": cosmos_exception}), 401
        elif "Invalid CosmosDB database name" in cosmos_exception:
            return (
                jsonify(
                    {
                        "error": f"{cosmos_exception} {app_settings.chat_history.database} for account {app_settings.chat_history.account}"
                    }
                ),
                422,
            )
        elif "Invalid CosmosDB container name" in cosmos_exception:
            return (
                jsonify(
                    {
                        "error": f"{cosmos_exception}: {app_settings.chat_history.conversations_container}"
                    }
                ),
                422,
            )
        else:
            return jsonify({"error": "CosmosDB is not working"}), 500


async def generate_title(conversation_messages, environment_settings) -> str:
    ## make sure the messages are sorted by _ts descending
    title_prompt = "Summarize the conversation so far into a 4-word or less title. Do not use any quotation marks or punctuation. Do not include any other commentary or description. Use the original language of the conversation."

    # Process messages to handle array content types
    processed_messages = []
    for msg in conversation_messages:
        processed_msg = {"role": msg["role"]}
        
        content = msg["content"]
        # Handle array content types
        if isinstance(content, list):
            if len(content) == 2:
                if isinstance(content[0], dict) and 'type' in content[0]:
                    # For image messages, use the text content
                    processed_msg["content"] = content[0]["text"]
                else:
                    # For PDF content, use the first message
                    processed_msg["content"] = content[0]
            else:
                # Invalid array format
                processed_msg["content"] = "Invalid message format"
        else:
            # Regular string content
            processed_msg["content"] = content
            
        processed_messages.append(processed_msg)

    # Add the title prompt
    processed_messages.append({"role": "user", "content": title_prompt})

    try:
        azure_openai_client = await init_openai_client(environment_settings)
        extra_headers, extra_query = build_openai_request_params(environment_settings['id'])
        response = await azure_openai_client.chat.completions.create(
            model=app_settings.azure_openai.model,
            messages=processed_messages,
            temperature=1,
            max_tokens=64,
            extra_headers=extra_headers,
            extra_query=extra_query
        )

        title = response.choices[0].message.content
        return title
    except Exception as e:
        logging.exception("Exception while generating title")
        # Return a default title or first few words of the last message
        last_message = processed_messages[-2] if len(processed_messages) > 1 else None
        if last_message:
            # Take first few words of the last user message
            words = last_message["content"].split()[:4]
            return " ".join(words)
        return "New Conversation"


app = create_app()
