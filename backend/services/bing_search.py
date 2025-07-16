import aiohttp
import json
import logging
from typing import Dict, List, Optional

class BingSearchService:
    def __init__(self, api_key: str, endpoint: str):
        self.api_key = api_key
        self.endpoint = endpoint
        
    async def search(self, query: str, max_results: int = 5) -> Dict:
        """Execute Bing search and return formatted results"""
        headers = {
            'Ocp-Apim-Subscription-Key': self.api_key,
            'Content-Type': 'application/json'
        }
        
        params = {
            'q': query,
            'count': max_results,
            'responseFilter': 'webPages',
            'textFormat': 'HTML'
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    self.endpoint,
                    headers=headers,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._format_results(data)
                    else:
                        logging.error(f"Bing search failed: {response.status}")
                        return {"error": f"Search failed with status {response.status}"}
                        
        except Exception as e:
            logging.exception("Error during Bing search")
            return {"error": str(e)}
    
    def _format_results(self, data: Dict) -> Dict:
        """Format Bing search results for consumption"""
        if 'webPages' not in data or 'value' not in data['webPages']:
            return {"results": []}
            
        results = []
        for item in data['webPages']['value']:
            results.append({
                'title': item.get('name', ''),
                'url': item.get('url', ''),
                'snippet': item.get('snippet', ''),
                'displayUrl': item.get('displayUrl', '')
            })
            
        return {"results": results}
