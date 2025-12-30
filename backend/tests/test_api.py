#!/usr/bin/env python3
"""
Test script for the /geoNLI/eval endpoint.
"""

import requests
import json
import sys

# API endpoint
API_URL = "http://localhost:8000/geoNLI/eval"

# Test payload
test_payload = {
    "input_image": {
        "image_id": "sample1.png",
        "image_url": "https://bit.ly/4ouV45l",
        "metadata": {
            "width": 512,
            "height": 512,
            "spatial_resolution_m": 1.57
        }
    },
    "queries": {
        "caption_query": {
            "instruction": "Generate a detailed caption describing all visible elements in the satellite image, including object types, counts, relative locations, and overall scene context."
        },
        "grounding_query": {
            "instruction": "Locate and return oriented bounding boxes for the aircrafts seen in the image."
        },
        "attribute_query": {
            "binary": {
                "instruction": "Is there any digit present in the bottom right corner of the scene?"
            },
            "numeric": {
                "instruction": "How many storage tanks are present in the scene?"
            },
            "semantic": {
                "instruction": "What is the color of the digit painted on the landing strip?"
            }
        }
    }
}


def validate_response_format(result: dict) -> tuple[bool, list[str]]:
    """
    Validate that the response matches the expected format.
    Returns (is_valid, list of errors).
    """
    errors = []
    
    # Check top-level structure
    if "input_image" not in result:
        errors.append("Missing 'input_image' in response")
    else:
        input_image = result["input_image"]
        if "image_id" not in input_image:
            errors.append("Missing 'input_image.image_id'")
        if "image_url" not in input_image:
            errors.append("Missing 'input_image.image_url'")
        if "metadata" not in input_image:
            errors.append("Missing 'input_image.metadata'")
        else:
            metadata = input_image["metadata"]
            for field in ["width", "height", "spatial_resolution_m"]:
                if field not in metadata:
                    errors.append(f"Missing 'input_image.metadata.{field}'")
    
    if "queries" not in result:
        errors.append("Missing 'queries' in response")
        return len(errors) == 0, errors
    
    queries = result["queries"]
    
    # Validate caption_query
    if "caption_query" in queries:
        cq = queries["caption_query"]
        if "instruction" not in cq:
            errors.append("Missing 'queries.caption_query.instruction'")
        if "response" not in cq:
            errors.append("Missing 'queries.caption_query.response'")
        elif not isinstance(cq["response"], str):
            errors.append(f"'queries.caption_query.response' should be string, got {type(cq['response']).__name__}")
    
    # Validate grounding_query
    if "grounding_query" in queries:
        gq = queries["grounding_query"]
        if "instruction" not in gq:
            errors.append("Missing 'queries.grounding_query.instruction'")
        if "response" not in gq:
            errors.append("Missing 'queries.grounding_query.response'")
        elif not isinstance(gq["response"], list):
            errors.append(f"'queries.grounding_query.response' should be list, got {type(gq['response']).__name__}")
        else:
            for idx, obj in enumerate(gq["response"]):
                if not isinstance(obj, dict):
                    errors.append(f"'queries.grounding_query.response[{idx}]' should be dict")
                    continue
                if "object-id" not in obj:
                    errors.append(f"Missing 'object-id' in grounding response[{idx}]")
                if "obbox" not in obj:
                    errors.append(f"Missing 'obbox' in grounding response[{idx}]")
                elif not isinstance(obj["obbox"], list):
                    errors.append(f"'obbox' in grounding response[{idx}] should be list")
    
    # Validate attribute_query
    if "attribute_query" in queries:
        aq = queries["attribute_query"]
        
        # Binary
        if "binary" in aq:
            binary = aq["binary"]
            if "instruction" not in binary:
                errors.append("Missing 'queries.attribute_query.binary.instruction'")
            if "response" not in binary:
                errors.append("Missing 'queries.attribute_query.binary.response'")
            elif not isinstance(binary["response"], str):
                errors.append(f"'queries.attribute_query.binary.response' should be string, got {type(binary['response']).__name__}")
            elif binary["response"] not in ["Yes", "No"]:
                errors.append(f"'queries.attribute_query.binary.response' should be 'Yes' or 'No', got '{binary['response']}'")
        
        # Numeric
        if "numeric" in aq:
            numeric = aq["numeric"]
            if "instruction" not in numeric:
                errors.append("Missing 'queries.attribute_query.numeric.instruction'")
            if "response" not in numeric:
                errors.append("Missing 'queries.attribute_query.numeric.response'")
            elif not isinstance(numeric["response"], (int, float)):
                errors.append(f"'queries.attribute_query.numeric.response' should be number, got {type(numeric['response']).__name__}")
        
        # Semantic
        if "semantic" in aq:
            semantic = aq["semantic"]
            if "instruction" not in semantic:
                errors.append("Missing 'queries.attribute_query.semantic.instruction'")
            if "response" not in semantic:
                errors.append("Missing 'queries.attribute_query.semantic.response'")
            elif not isinstance(semantic["response"], str):
                errors.append(f"'queries.attribute_query.semantic.response' should be string, got {type(semantic['response']).__name__}")
    
    return len(errors) == 0, errors


def test_evaluate():
    """Test the /geoNLI/eval endpoint."""
    print("=" * 60)
    print("Testing /geoNLI/eval endpoint")
    print("=" * 60)
    print(f"\nSending request to: {API_URL}")
    print(f"\nPayload:\n{json.dumps(test_payload, indent=2)}")
    print("\n" + "-" * 60)
    
    try:
        response = requests.post(
            API_URL,
            json=test_payload,
            headers={"Content-Type": "application/json"},
            timeout=300  # 5 minute timeout for model inference
        )
        
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("\n✅ Request successful! Response:")
            print(json.dumps(result, indent=2))
            
            # Validate response format
            print("\n" + "=" * 60)
            print("RESPONSE FORMAT VALIDATION")
            print("=" * 60)
            
            is_valid, errors = validate_response_format(result)
            
            if is_valid:
                print("\n✅ Response format is valid!")
            else:
                print("\n❌ Response format validation failed:")
                for error in errors:
                    print(f"   - {error}")
            
            # Extract and display specific results
            print("\n" + "=" * 60)
            print("RESULTS SUMMARY")
            print("=" * 60)
            
            queries = result.get("queries", {})
            
            # Caption
            if "caption_query" in queries:
                caption = queries["caption_query"].get("response", "N/A")
                print(f"\n📝 Caption:\n{caption}")
            
            # Grounding
            if "grounding_query" in queries:
                grounding = queries["grounding_query"].get("response", [])
                print(f"\n📍 Grounding (OBBs): {len(grounding)} objects detected")
                for obj in grounding:
                    print(f"   - Object {obj.get('object-id')}: {obj.get('obbox')}")
            
            # Attributes
            if "attribute_query" in queries:
                attr = queries["attribute_query"]
                print("\n🔍 Attributes:")
                if "binary" in attr:
                    print(f"   - Binary: {attr['binary'].get('response', 'N/A')}")
                if "numeric" in attr:
                    print(f"   - Numeric: {attr['numeric'].get('response', 'N/A')}")
                if "semantic" in attr:
                    print(f"   - Semantic: {attr['semantic'].get('response', 'N/A')}")
            
            # Return exit code based on validation
            return 0 if is_valid else 1
                    
        else:
            print(f"\n❌ Error: {response.text}")
            return 1
            
    except requests.exceptions.ConnectionError:
        print("\n❌ Connection Error: Could not connect to the API server.")
        print("   Make sure the server is running with: python3 serve.py")
        return 1
    except requests.exceptions.Timeout:
        print("\n❌ Timeout: The request took too long to complete.")
        return 1
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return 1


if __name__ == "__main__":
    exit_code = test_evaluate()
    sys.exit(exit_code)
