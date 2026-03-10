import openai
import json
import os

client = openai.OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY")
)

print("Testing OpenAI web search with gpt-5-mini...")
print("=" * 60)

try:
    response = client.responses.create(
        model="gpt-5-mini",
        input=[
            {
                "role": "developer",
                "content": [{"type": "input_text", "text": "You are a market research analyst. Search the web for information and return a brief JSON summary."}],
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": "Search the web for information about the chiral molecules analytical tools market size and key players. Return a brief JSON with summary, competitors array, and marketSize."}],
            },
        ],
        tools=[
            {
                "type": "web_search_preview",
                "search_context_size": "high",
                "user_location": {
                    "type": "approximate",
                    "country": "FI",
                },
            }
        ],
        text={"format": {"type": "text"}},
        store=False,
    )

    print("SUCCESS! Response received.")
    print(f"Output type: {type(response)}")
    
    # Extract text
    if hasattr(response, 'output') and response.output:
        for item in response.output:
            if hasattr(item, 'type') and item.type == 'message' and hasattr(item, 'content'):
                for c in item.content:
                    if hasattr(c, 'type') and c.type == 'output_text':
                        print(f"\nResponse text (first 500 chars):\n{c.text[:500]}")
    
    if hasattr(response, 'output_text') and response.output_text:
        print(f"\noutput_text (first 500 chars):\n{response.output_text[:500]}")

except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
