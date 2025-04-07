import re
import uvicorn
import traceback
import asyncio
import os
import uuid
import json
import base64

from dotenv import load_dotenv
from fastapi import FastAPI, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from youtube_transcript_api import YouTubeTranscriptApi
from supabase import create_client, Client
from google.api_core.exceptions import ResourceExhausted # Import the specific exception

from rag.rag import (
    generate_chat_response,
    generate_flashcards,
    generate_transcript_summary,
    generate_quiz,
    generate_subjects,
    generate_image
)
from settings import settings

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.FRONTEND_BASE_URLS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase client
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_KEY")
if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables.")
supabase: Client = create_client(supabase_url, supabase_key)


class ChatIn(BaseModel):
    query: str

class ChatOut(BaseModel):
    response: str

@app.get("/")
async def root():
    return {"message": "Hello World from EduAction Backend"}

@app.post("/api/chat/")
async def chat(input_text: str = Body(...)):
    try:
        chat_response = await generate_chat_response(input_text)
        return {"data": chat_response}
    except ResourceExhausted as e:
        print(f"❌ Rate Limit Error in /api/chat/: {e}")
        raise HTTPException(status_code=429, detail="API rate limit exceeded. Please try again shortly.")
    except Exception as e:
        error_details = traceback.format_exc()
        print(f"❌ Error in /api/chat/: {error_details}")
        raise HTTPException(status_code=500, detail=f"Server Error: {e}")


class ContentRequest(BaseModel):
    transcript: str
    user_id: str

@app.post("/api/summary/")
async def summary(request: ContentRequest):
    try:
        transcript_summary = await generate_transcript_summary(request.transcript)
        save_to_supabase(request.user_id, transcript_summary, "summary", "txt")
        return {"data": transcript_summary}
    except ResourceExhausted as e:
        print(f"❌ Rate Limit Error in /api/summary/: {e}")
        raise HTTPException(status_code=429, detail="API rate limit exceeded generating summary. Please try again shortly.")
    except Exception as e:
        error_details = traceback.format_exc()
        print(f"❌ Error in /api/summary/: {error_details}")
        raise HTTPException(status_code=500, detail=f"Server Error generating summary: {e}")

@app.post("/api/subjects/")
async def subjects(request: ContentRequest):
    try:
        subjects_list = await generate_subjects(request.transcript)
        # Subjects might already be JSON-serializable (list of strings)
        save_to_supabase(request.user_id, subjects_list, "subjects", "json")
        return {"data": subjects_list}
    except ResourceExhausted as e:
        print(f"❌ Rate Limit Error in /api/subjects/: {e}")
        raise HTTPException(status_code=429, detail="API rate limit exceeded generating subjects. Please try again shortly.")
    except Exception as e:
        error_details = traceback.format_exc()
        print(f"❌ Error in /api/subjects/: {error_details}")
        raise HTTPException(status_code=500, detail=f"Server Error generating subjects: {e}")

class YTLinkRequest(BaseModel):
    url: str
    user_id: str

@app.post("/api/yt_link/")
async def yt_link(request: YTLinkRequest):
    try:
        url = request.url
        if "&list" in url:
            url = url.split("&list")[0]
        if "?v=" not in url:
             raise ValueError("Invalid YouTube URL format. Missing '?v='.")
        video_id = url.split("?v=")[1].split("&")[0] # Handle extra params after video id

        raw_subtitles = YouTubeTranscriptApi.get_transcript(video_id)
        transcript = " ".join(re.sub(r'\n+', ' ', row['text']) for row in raw_subtitles)

        # Optionally save the raw transcript
        # save_to_supabase(request.user_id, transcript, "yt_links", "txt")
        return {"transcript": transcript}

    except Exception as e:
        print(f"❌ Error in /api/yt_link/: {e}")
        # Distinguish between transcript not found and other errors if possible
        if "No transcript found" in str(e):
             raise HTTPException(status_code=404, detail=f"Could not find transcript for video: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing YouTube link: {e}")


@app.post("/api/flashcards/")
async def flashcards(request: ContentRequest):
    try:
        print("Generating flashcards...")
        flashcards_result = await generate_flashcards(request.transcript)
        print(f"Generated Flashcards Response Type: {type(flashcards_result)}")
        print(f"Generated Flashcards Response Content: {flashcards_result}")

        # Validate the structure received from generate_flashcards
        if not hasattr(flashcards_result, "flashcards") or not isinstance(flashcards_result.flashcards, list):
            print(f"❌ Unexpected flashcard response format: {flashcards_result}")
            raise ValueError("Flashcard generation returned an unexpected format.")
        if not flashcards_result.flashcards:
             print("✅ Flashcard generation returned empty list, possibly short transcript.")
             return {"questions": [], "answers": [], "images": []}

        print(f"Number of flashcards to generate images for: {len(flashcards_result.flashcards)}")
        # Generate images concurrently
        coroutine_tasks = []
        for i, flashcard in enumerate(flashcards_result.flashcards):
             if hasattr(flashcard, "image_prompt") and flashcard.image_prompt:
                 print(f"  - Task {i+1}: Generating image for prompt: '{flashcard.image_prompt[:50]}...'")
                 coroutine_tasks.append(generate_image(flashcard.image_prompt))
             else:
                 print(f"  - Task {i+1}: Skipping image generation (no prompt)")
                 # Append None or a placeholder to keep lists aligned if needed,
                 # but better to handle potential None values later
                 coroutine_tasks.append(asyncio.sleep(0, result=None)) # Non-blocking placeholder

        # Use return_exceptions=True to handle potential individual image generation failures
        image_responses = await asyncio.gather(*coroutine_tasks, return_exceptions=True)
        print("Image generation tasks complete.")

        questions = []
        answers = []
        image_urls = []
        image_save_tasks = []

        for i, (flashcard, img_response) in enumerate(zip(flashcards_result.flashcards, image_responses)):
            questions.append(flashcard.question)
            answers.append(flashcard.answer)

            public_image_url = None # Default to no image
            if isinstance(img_response, Exception):
                print(f"❌ Error generating image for flashcard {i}: {img_response}")
            elif img_response and img_response.status_code == 200:
                try:
                    # Make sure the structure is as expected
                    artifacts = img_response.json().get("artifacts")
                    if artifacts and len(artifacts) > 0 and "base64" in artifacts[0]:
                        image_b64 = artifacts[0]["base64"]
                        # Schedule image saving (don't await here to parallelize uploads)
                        image_save_tasks.append(
                            save_image_to_supabase(request.user_id, image_b64, "flashcards")
                        )
                    else:
                         print(f"⚠️ Image response for flashcard {i} missing expected data: {img_response.json()}")
                except Exception as json_e:
                     print(f"❌ Error parsing image response JSON for flashcard {i}: {json_e}")
            elif img_response: # Handle non-200 responses
                print(f"⚠️ Image generation API returned status {img_response.status_code} for flashcard {i}")
            else:
                # This case handles the asyncio.sleep placeholder if no prompt was given
                 print(f"ℹ️ No image generated for flashcard {i} (no prompt/task skipped).")

        # Wait for all image uploads to complete and get their URLs
        # Use return_exceptions=True here as well
        print(f"Attempting to save {len(image_save_tasks)} images to Supabase...")
        saved_image_results = await asyncio.gather(*image_save_tasks, return_exceptions=True)
        print("Supabase image saving tasks complete.")

        # Assign URLs based on successful saves, maintaining order relative to tasks started
        image_url_map = {} # Map original index to URL
        current_save_task_index = 0
        for i, img_response in enumerate(image_responses): # Iterate through original responses
             # Only try to get a saved URL if an image was successfully generated AND scheduled for saving
             if img_response and not isinstance(img_response, Exception) and img_response.status_code == 200:
                  # Check corresponding save result
                  if current_save_task_index < len(saved_image_results):
                      save_result = saved_image_results[current_save_task_index]
                      if isinstance(save_result, Exception):
                          print(f"❌ Error saving image from flashcard {i} to Supabase: {save_result}")
                          image_url_map[i] = None # Indicate save failure
                      elif save_result:
                           image_url_map[i] = save_result # Store the URL
                      else:
                           image_url_map[i] = None # Indicate save failure (e.g., save function returned None)
                      current_save_task_index += 1
                  else: # Should not happen if logic is correct
                       print(f"⚠️ Mismatch between generated images and save tasks at index {i}")
                       image_url_map[i] = None
             else:
                  image_url_map[i] = None # No image generated or generation failed


        # Build final list of URLs in the correct order
        image_urls = [image_url_map.get(i) for i in range(len(flashcards_result.flashcards))]

        # Save combined flashcard data (optional, depending on needs)
        # try:
        #     flashcard_data = {"questions": questions, "answers": answers, "image_urls": image_urls}
        #     save_to_supabase(request.user_id, flashcard_data, "flashcards_meta", "json")
        #     print("✅ Saved flashcard metadata to Supabase.")
        # except Exception as meta_save_e:
        #      print(f"⚠️ Failed to save flashcard metadata: {meta_save_e}")


        return {"questions": questions, "answers": answers, "images": image_urls}

    except ResourceExhausted as e:
        print(f"❌ Rate Limit Error in /api/flashcards/: {e}")
        raise HTTPException(status_code=429, detail="API rate limit exceeded generating flashcards. Please try again shortly.")
    except ValueError as ve: # Catch specific validation errors
        print(f"❌ Value Error in /api/flashcards/: {ve}")
        raise HTTPException(status_code=500, detail=f"Server Error: {ve}")
    except Exception as e:
        error_details = traceback.format_exc()
        print(f"❌ Unhandled Error in /api/flashcards/: {error_details}")
        raise HTTPException(status_code=500, detail=f"Unexpected Server Error: {e}")


@app.post("/api/quiz/")
async def quiz(request: ContentRequest):
    try:
        quiz_data = await generate_quiz(request.transcript)
        # Quiz data should already be JSON-serializable list of dicts
        save_to_supabase(request.user_id, quiz_data, "quiz", "json")
        # The structure from generate_quiz should already be {"question": ..., "answers": ..., "correct_answer": ...}
        # FastAPI automatically serializes the list of Pydantic models/dicts
        return {"data": quiz_data}
    except ResourceExhausted as e:
        print(f"❌ Rate Limit Error in /api/quiz/: {e}")
        raise HTTPException(status_code=429, detail="API rate limit exceeded generating quiz. Please try again shortly.")
    except ValueError as ve: # Catch specific validation errors from generate_quiz
         print(f"❌ Value Error in /api/quiz/: {ve}")
         raise HTTPException(status_code=500, detail=f"Server Error: {ve}")
    except Exception as e:
        error_details = traceback.format_exc()
        print(f"❌ Error in /api/quiz/: {error_details}")
        raise HTTPException(status_code=500, detail=f"Server Error generating quiz: {e}")


# --- User Management (Example) ---
class UserCreateRequest(BaseModel):
     username: str

@app.post("/user/create/")
async def create_user(request: UserCreateRequest):
    try:
        data, count = supabase.table('users').insert({"username": request.username}).execute()
        # data format is typically [[{'id': ..., 'username': ...}]]
        if data and len(data) > 1 and len(data[1]) > 0:
             return {"data": data[1][0]} # Return the created user object
        else:
             raise HTTPException(status_code=500, detail="Failed to create user or parse response.")
    except Exception as e:
         print(f"❌ Error in /user/create/: {e}")
         raise HTTPException(status_code=500, detail=f"Error creating user: {e}")


# --- Supabase Helper Functions ---

# Simplified function for saving text/json
def save_to_supabase(user_id: str, data: any, bucket_subfolder: str, file_extension: str):
    """Saves text or JSON data to Supabase storage."""
    if not user_id:
        print("⚠️ Attempted to save to Supabase without user_id.")
        return None # Or raise error

    tmp_filename = f"{uuid.uuid4()}.{file_extension}"
    supabase_path = f"{user_id}/{bucket_subfolder}/{tmp_filename}"
    content_type = "application/json" if file_extension == "json" else "text/plain"

    try:
        # Convert data to bytes
        if file_extension == "json":
            file_content = json.dumps(data).encode('utf-8')
        else: # txt
            file_content = str(data).encode('utf-8')

        response = supabase.storage.from_("content").upload(
            path=supabase_path,
            file=file_content, # Upload bytes directly
            file_options={"content-type": content_type, "upsert": "false"} # Don't overwrite
        )
        print(f"✅ Successfully saved {file_extension} to Supabase: {supabase_path}")
         # response object doesn't directly contain the URL, need to construct or retrieve it if needed immediately.
        # For simplicity, just returning the response object for now.
        return response
    except Exception as e:
        print(f"❌ Failed to save {file_extension} to Supabase path {supabase_path}: {e}")
        # Decide if this should raise an exception or just return None/log
        return None

# Specific async function for saving images and returning public URL
async def save_image_to_supabase(user_id: str, image_base64: str, bucket_subfolder: str) -> str | None:
    """Saves a base64 encoded image to Supabase storage and returns the public URL."""
    if not user_id:
        print("⚠️ Attempted to save image to Supabase without user_id.")
        return None

    tmp_filename = f"{uuid.uuid4()}.png"
    supabase_path = f"{user_id}/{bucket_subfolder}/{tmp_filename}"
    content_type = "image/png"

    try:
        image_bytes = base64.b64decode(image_base64)

        # Supabase Python client's upload isn't natively async, run in thread pool
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
             None, # Use default executor
             lambda: supabase.storage.from_("content").upload(
                path=supabase_path,
                file=image_bytes,
                file_options={"content-type": content_type, "upsert": "false"}
            )
        )

        # After successful upload, get the public URL
        public_url = supabase.storage.from_("content").get_public_url(supabase_path)
        print(f"✅ Successfully saved image to Supabase: {public_url}")
        return public_url

    except Exception as e:
        print(f"❌ Failed to save image to Supabase path {supabase_path}: {e}")
        return None


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000)) # Use PORT env var if available (for deployment)
    uvicorn.run(app, host="0.0.0.0", port=port)



# import re
# import uvicorn
# from dotenv import load_dotenv
# from fastapi import FastAPI, Body
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel
# from youtube_transcript_api import YouTubeTranscriptApi
# from rag.rag import (
#     generate_chat_response,
#     generate_flashcards,
#     generate_transcript_summary,
#     generate_quiz,
#     generate_subjects,
#     generate_image
# )
# from settings import settings
# import asyncio
# import os
# from supabase import create_client
# import uuid
# import json
# import base64

# load_dotenv()

# app = FastAPI()


# app.add_middleware(
#     CORSMiddleware,
#     # allow_origins=["http://localhost:3000"],
#     allow_origins=settings.FRONTEND_BASE_URLS,
#     allow_credentials=True,
#     # allow_methods=["*"],
#     allow_methods=["*"],  # Match Express.js config
#     allow_headers=["*"],
# )

# supabase = create_client(supabase_url=os.environ.get("SUPABASE_URL"), supabase_key=os.environ.get("SUPABASE_KEY"))


# class ChatIn(BaseModel):
#     query: str

# class ChatOut(BaseModel):
#     response: str


# @app.get("/")
# async def root():
#     return {"message": "Hello World"}


# @app.post("/api/chat/")
# async def chat(input_text: str = Body(...)):
#     chat_response = generate_chat_response(input_text)
#     return {"data": chat_response}


# # @app.post("/api/summary/")
# # async def summary(transcript: str = Body(...), user_id: str = Body(...)):
# #     transcript_summary = await generate_transcript_summary(transcript)
# #     save_to_supabase(user_id, transcript_summary, "summary", "txt")
# #     return {"data": transcript_summary}

# class SummaryRequest(BaseModel):
#     transcript: str
#     user_id: str

# @app.post("/api/summary/")
# async def summary(request: SummaryRequest):
#     transcript_summary = await generate_transcript_summary(request.transcript)
#     save_to_supabase(request.user_id, transcript_summary, "summary", "txt")
#     return {"data": transcript_summary}

# # @app.post("/api/summary/")
# # async def summary(transcript: str = Body(...), user_id: str = Body(...)):
# #     print(f"Received transcript: {transcript}")
# #     print(f"Received user_id: {user_id}")

# #     transcript_summary = await generate_transcript_summary(transcript)
# #     save_to_supabase(user_id, transcript_summary, "summary", "txt")
# #     return {"data": transcript_summary}



# @app.post("/api/subjects/")
# async def subjects(transcript: str = Body(...), user_id: str = Body(...)):
#     subjects = await generate_subjects(transcript)
#     save_to_supabase(user_id, subjects, "subjects", "json")
#     return {"data": subjects}


# @app.post("/api/yt_link/")
# async def yt_link(url: str = Body(...), user_id: str = Body(...)):
#     try:
#         if "&list" in url:
#             url = url.split("&list")[0]
#         video_id = url.split("?v=")[1]
#         raw_subtitles = YouTubeTranscriptApi.get_transcript(video_id)
#         transcript = " ".join(re.sub(r'\n+', ' ', row['text']) for row in raw_subtitles)

#         save_to_supabase(user_id, transcript, "yt_links", "txt")
#         return {"transcript": transcript}

#     except Exception as e:
#         print(f"Error in /api/yt_link/: {str(e)}")  # Log error
#         return {"error": str(e)}



# @app.post("/api/flashcards/")
# async def flashcards(transcript: str = Body(...), user_id: str = Body(...)):
#     flashcards = await generate_flashcards(transcript)

#     # Creating a list of coroutine objects for each flashcard prompt
#     coroutine_tasks = [generate_image(flashcard.image_prompt) for flashcard in flashcards.flashcards]

#     # Using asyncio.gather to run coroutine tasks concurrently
#     responses = await asyncio.gather(*coroutine_tasks)

#     questions = [flashcard.question for flashcard in flashcards.flashcards]
#     answers = [flashcard.answer for flashcard in flashcards.flashcards]
#     images = [response.json()["artifacts"][0]["base64"] for response in responses]

#     # Save images to supabase
#     image_urls = []
#     for image in images:
#         response = save_to_supabase(user_id, image, "flashcards", "png")
#         supabase_object_path = response.json()["Key"].split("content/")[1]
#         public_image_url = supabase.storage.get_bucket('content').get_public_url(supabase_object_path)
#         image_urls.append(public_image_url)

#     flashcard_data = {"questions": questions, "answers": answers, "image_urls": image_urls}
#     save_to_supabase(user_id, flashcard_data, "flashcards", "json")

#     return {"questions": questions, "answers": answers, "images": image_urls}


# @app.post("/api/quiz/")
# async def quiz(transcript: str = Body(...), user_id: str = Body(...)):
#     quiz = await generate_quiz(transcript)
#     save_to_supabase(user_id, quiz, "quiz", "json")
#     return {"data": quiz}


# @app.post("/user/create/")
# async def create_user(username: str = Body(...)):
#     data, _ = supabase.table('users').insert({"username": username}).execute()
#     return {"data": data}

# def save_to_supabase(user_id, data, bucket_subfolder, file_extension):
#     tmp_filename = str(uuid.uuid4()) + f".{file_extension}"
#     file_path = f"/tmp/{tmp_filename}"

#     if file_extension == "txt":
#         file_type = "text/html"
#         with open(file_path, "w") as fp:
#             fp.write(data)
#     elif file_extension == "png":
#         file_type = "image/png"
#         with open(file_path, "wb") as fp:
#             fp.write(base64.b64decode(data))
#     elif file_extension == "json":
#         file_type = "application/json"
#         with open(file_path, "w") as fp:
#             json.dump(data, fp)
#     else:
#         raise NotImplementedError

#     # ✅ Fix: Use `.from_("<bucket_name>")`
#     response = supabase.storage.from_("content").upload(
#         path=f"{user_id}/{bucket_subfolder}/{tmp_filename}",
#         file=file_path,
#         file_options={"content-type": file_type}
#     )

#     return response


# # def save_to_supabase(user_id, data, bucket_subfolder, file_extension):
# #     bucket = supabase.storage.get_bucket("content")

# #     tmp_filename = str(uuid.uuid4()) + f".{file_extension}"
# #     file_path = f"/tmp/{tmp_filename}.{file_extension}"
# #     if file_extension == "txt":
# #         file_type = "text/html"
# #         with open(file_path, "w") as fp:
# #             fp.write(data)
# #     elif file_extension == "png":
# #         file_type = "image/png"
# #         with open(file_path, "wb") as fp:
# #             fp.write(base64.b64decode(data))
# #     elif file_extension == "json":
# #         file_type = "application/json"
# #         with open(file_path, "w") as fp:
# #            json.dump(data, fp)
# #     else:
# #         raise NotImplementedError

# #     response = bucket.upload(path=f"{user_id}/{bucket_subfolder}/{tmp_filename}", file=file_path, file_options={"content-type": file_type})

# #     return response

# @app.get("/")
# async def root():
#     return {"message": "CORS is working!"}

# if __name__ == "__main__":
#     uvicorn.run(app, host="0.0.0.0", port=8000)
