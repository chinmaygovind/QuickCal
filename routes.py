import os
import json
from datetime import datetime
from flask import Flask, request, jsonify, Blueprint
import google.generativeai as genai
from google.ai.generativelanguage_v1beta.types import content

main = Blueprint('main', __name__)

#gemini 
GENAI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GENAI_API_KEY:
    raise ValueError("GEMINI_API_KEY is not set in the environment variables.")

genai.configure(api_key=GENAI_API_KEY)

def send_prompt_to_gemini(prompt):
    """
    Sends a prompt to the Gemini API and returns the structured JSON response.
    """
    try:
        generation_config = {
            "temperature": 1,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 8192,
            "response_schema": content.Schema(
                type=content.Type.OBJECT,
                properties={
                    "title": content.Schema(type=content.Type.STRING),
                    "timestamp_start": content.Schema(type=content.Type.STRING),
                    "timestamp_end": content.Schema(type=content.Type.STRING),
                    "location": content.Schema(type=content.Type.STRING),
                    "description": content.Schema(type=content.Type.STRING),
                },
            ),
            "response_mime_type": "application/json",
        }

        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash-8b",
            generation_config=generation_config,
        )

        chat_session = model.start_chat(history=[])
        response = chat_session.send_message(prompt)

        return response.to_dict()
    except Exception as e:
        return {"error": str(e)}

@main.route("/process_text", methods=["POST"])
def process_text():
    """
    Endpoint to process the selected text from the Chrome extension.
    """
    try:
        data = request.json
        selected_text = data.get("selected_text", "")
        if not selected_text:
            return jsonify({"error": "selected_text is required"}), 400

        today = datetime.now().strftime("%B %d, %Y")
        prompt = f"""
        I will give you some text that I want you to parse. The text should describe an event.
        Please provide a raw JSON response with the following fields:

        title: the title of the event.
        timestamp_start: a UTC timestamp of when the event starts in the format YYYYMMDDTHHMMSS. If no year is given, default to the upcoming instance of that date.
        timestamp_end: a UTC timestamp of when the event ends in the format YYYYMMDDTHHMMSS. (If not given, default to one hour after start.)
        location: the location of the event. 
        description: a short 2-3 sentence description of the event containing any pertinent information or links.

        Please parse the following text: 
        Today's date is {today}. {selected_text}
        """

        gemini_response = send_prompt_to_gemini(prompt)

        if "error" in gemini_response:
            return jsonify(gemini_response), 500

        # parse that jawn
        title = gemini_response.get("title", "Untitled Event")
        timestamp_start = gemini_response.get("timestamp_start")
        timestamp_end = gemini_response.get("timestamp_end")
        location = gemini_response.get("location", "")
        description = gemini_response.get("description", "No description provided.")

        if not timestamp_start:
            return jsonify({"error": "timestamp_start is missing from the response."}), 400

        gcal_link = (
            f"https://www.google.com/calendar/render?action=TEMPLATE&text={title}" \
            f"&dates={timestamp_start}/{timestamp_end or ''}" \
            f"&details={description}" \
            f"&location={location}"
        )

        return jsonify({
            "title": title,
            "timestamp_start": timestamp_start,
            "timestamp_end": timestamp_end,
            "location": location,
            "description": description,
            "gcal_link": gcal_link
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500