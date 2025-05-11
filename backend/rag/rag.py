import os
import asyncio
import httpx
import time
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from rag.chains import (
    create_chat_chain,
    create_flashcard_chain,
    create_quiz_chain,
    create_medium_quiz_chain,
    create_difficult_quiz_chain,
    create_subjects_chain,
    create_transcript_summary_chain,
    create_clean_transcript_chain
)
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.runnables import Runnable
from rag.data_models import FlashCards, QuestionAndAnswer, QuestionsAndAnswers
from google.api_core.exceptions import ResourceExhausted

load_dotenv()

# Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
STABILITY_API_KEY = os.getenv("STABILITY_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable not set.")
if not STABILITY_API_KEY:
    raise ValueError("STABILITY_API_KEY environment variable not set.")

# LLM Initialization
llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",
    temperature=0,
    request_timeout=120,
    google_api_key=GEMINI_API_KEY,
)

# Stability AI Configuration
stability_api_url = "https://api.stability.ai"
stability_model = "stable-diffusion-v1-6"

# Chain Initialization
try:
    chat_chain = create_chat_chain(llm)
    summary_chain = create_transcript_summary_chain(llm)
    flashcard_chain = create_flashcard_chain(llm)
    quiz_chain = create_quiz_chain(llm)
    medium_quiz_chain = create_medium_quiz_chain(llm)
    difficult_quiz_chain = create_difficult_quiz_chain(llm)
    subjects_chain = create_subjects_chain(llm)
    response_clean_chain = create_clean_transcript_chain(llm)
except Exception as e:
    print(f"❌ Error initializing Langchain chains: {e}")
    raise RuntimeError("Failed to initialize core LLM chains.") from e

# Constants
CHUNK_SIZE = 18000
CHUNK_OVERLAP = 500
CONCURRENT_API_CALL_DELAY = 2.0  # Increased to avoid rate limits

def split_transcript(transcript: str):
    """Splits the transcript into manageable chunks."""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        length_function=len
    )
    docs = text_splitter.create_documents([transcript])
    print(f"Split transcript into {len(docs)} chunks")
    return [doc.page_content for doc in docs]

async def generate_chat_response(input_text: str) -> str:
    """Generates a response using the chat chain."""
    response = await chat_chain.ainvoke({"input": input_text})
    return response

async def split_transcript_and_collect_responses(transcript: str, chain: Runnable) -> list:
    """
    Splits transcript, invokes chain on each chunk CONCURRENTLY with DELAYS,
    and collects responses.
    """
    texts = split_transcript(transcript)
    if not texts:
        print("No chunks created from transcript")
        return []

    tasks = []
    for i, text_chunk in enumerate(texts):
        print(f"Creating task for chunk {i} (length: {len(text_chunk)})")
        task = asyncio.create_task(chain.ainvoke({"transcript": text_chunk}))
        tasks.append(task)
        if i < len(texts) - 1:
            await asyncio.sleep(CONCURRENT_API_CALL_DELAY)

    responses = await asyncio.gather(*tasks, return_exceptions=True)
    print(f"Collected {len(responses)} responses")

    processed_responses = []
    for i, response in enumerate(responses):
        if isinstance(response, Exception):
            print(f"⚠️ Error processing chunk {i} for chain {chain.config.get('run_name', 'UnknownChain')}: {response}")
            processed_responses.append(None)
        else:
            print(f"Chunk {i} response: {response}")
            processed_responses.append(response)

    return processed_responses

async def generate_transcript_summary(transcript: str) -> str:
    """Generates a summary by processing chunks and combining."""
    print(f"Generating summary for transcript of length {len(transcript)}...")
    responses = await split_transcript_and_collect_responses(transcript, summary_chain)

    valid_summaries = [r for r in responses if r is not None and isinstance(r, str)]
    print(f"Collected {len(valid_summaries)} valid summary chunks")

    if not valid_summaries:
        print("⚠️ No valid summary chunks were generated.")
        return "Could not generate summary."

    full_summary = ' '.join(valid_summaries)
    print("Cleaning combined summary...")
    try:
        output = await response_clean_chain.ainvoke({"transcript": full_summary})
        print("✅ Summary generation complete.")
        return output
    except ResourceExhausted as e:
        print(f"❌ Rate limit hit during summary cleaning: {e}")
        return f"[Uncleaned Summary due to rate limit]: {full_summary}"
    except Exception as e:
        print(f"❌ Error during summary cleaning: {e}")
        return f"[Summary cleaning failed]: {full_summary}"

async def generate_flashcards(transcript: str) -> FlashCards | None:
    """
    Generates flashcards from the transcript.
    """
    print(f"Requesting flashcards generation for transcript length {len(transcript)}...")
    if flashcard_chain is None:
        raise ValueError("flashcard_chain is not initialized")

    try:
        response = await flashcard_chain.ainvoke({"transcript": transcript})
        print(f"Flashcard response: {response}")
        if response is None:
            print("⚠️ flashcard_chain.ainvoke returned None")
            return None
        if not isinstance(response, FlashCards):
            print(f"⚠️ Flashcard chain returned unexpected type: {type(response)}")
            if isinstance(response, dict) and 'flashcards' in response:
                try:
                    return FlashCards(**response)
                except Exception:
                    print("❌ Failed to parse dict into FlashCards object.")
                    return None
            return None
        return response
    except Exception as e:
        print(f"❌ Error invoking flashcard chain: {e}")
        raise

async def generate_image(prompt: str) -> httpx.Response | None:
    """Generates an image using Stability AI asynchronously."""
    print(f"  -> Calling Stability AI for prompt: '{prompt[:60]}...'")
    headers = {
        "Authorization": f"Bearer {STABILITY_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload = {
        "text_prompts": [{"text": prompt, "weight": 1.0}],
        "cfg_scale": 7,
        "height": 512,
        "width": 512,
        "samples": 1,
        "steps": 30,
    }
    timeout = httpx.Timeout(30.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.post(
                f"{stability_api_url}/v1/generation/{stability_model}/text-to-image",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            print(f"  ✅ Stability AI call successful (Status: {response.status_code})")
            return response
        except httpx.HTTPStatusError as e:
            print(f"❌ Stability AI HTTP Error: {e.response.status_code} - {e.response.text}")
            return e.response
        except httpx.RequestError as e:
            print(f"❌ Stability AI Request Error: {e}")
            return None
        except Exception as e:
            print(f"❌ Unexpected error in generate_image: {e}")
            return None

async def generate_quiz(transcript: str) -> list[dict]:
    """
    Generates quiz questions (Easy difficulty) by processing chunks concurrently with delays.
    """
    print(f"Generating easy quiz for transcript of length {len(transcript)}...")
    responses = await split_transcript_and_collect_responses(transcript, quiz_chain)

    if responses is None:
        print("⚠️ split_transcript_and_collect_responses returned None unexpectedly.")
        raise ValueError("Quiz generation failed during chunk processing.")

    flattened_list = []
    for i, response in enumerate(responses):
        if response is None or isinstance(response, Exception):
            print(f"ℹ️ Skipping quiz results from failed chunk {i}.")
            continue

        if not isinstance(response, QuestionsAndAnswers):
            print(f"⚠️ Easy quiz chain (chunk {i}) returned unexpected type: {type(response)}: {response}")
            continue
        if not hasattr(response, "question_and_answers") or not isinstance(response.question_and_answers, list):
            print(f"⚠️ Malformed easy quiz response from chunk {i}: {response}")
            continue

        for item in response.question_and_answers:
            if isinstance(item, QuestionAndAnswer):
                flattened_list.append(item.dict())
            elif isinstance(item, dict):
                if 'question' in item and 'answers' in item and 'correct_answer' in item:
                    flattened_list.append(item)
                else:
                    print(f"⚠️ Skipping malformed easy quiz item (dict) from chunk {i}: {item}")
            else:
                print(f"⚠️ Skipping unexpected easy quiz item type ({type(item)}) from chunk {i}: {item}")

    print(f"✅ Easy quiz generation complete. Generated {len(flattened_list)} questions: {flattened_list}")
    return flattened_list

async def generate_medium_quiz(transcript: str) -> list[dict]:
    """
    Generates quiz questions (Medium difficulty) by processing chunks concurrently with delays.
    """
    print(f"Generating medium quiz for transcript of length {len(transcript)}...")
    responses = await split_transcript_and_collect_responses(transcript, medium_quiz_chain)

    if responses is None:
        print("⚠️ split_transcript_and_collect_responses returned None unexpectedly.")
        raise ValueError("Medium quiz generation failed during chunk processing.")

    flattened_list = []
    for i, response in enumerate(responses):
        if response is None or isinstance(response, Exception):
            print(f"ℹ️ Skipping medium quiz results from failed chunk {i}.")
            continue

        if not isinstance(response, QuestionsAndAnswers):
            print(f"⚠️ Medium quiz chain (chunk {i}) returned unexpected type: {type(response)}: {response}")
            continue
        if not hasattr(response, "question_and_answers") or not isinstance(response.question_and_answers, list):
            print(f"⚠️ Malformed medium quiz response from chunk {i}: {response}")
            continue

        for item in response.question_and_answers:
            if isinstance(item, QuestionAndAnswer):
                flattened_list.append(item.dict())
            elif isinstance(item, dict):
                if 'question' in item and 'answers' in item and 'correct_answer' in item:
                    flattened_list.append(item)
                else:
                    print(f"⚠️ Skipping malformed medium quiz item (dict) from chunk {i}: {item}")
            else:
                print(f"⚠️ Skipping unexpected medium quiz item type ({type(item)}) from chunk {i}: {item}")

    print(f"✅ Medium quiz generation complete. Generated {len(flattened_list)} questions: {flattened_list}")
    return flattened_list

async def generate_difficult_quiz(transcript: str) -> list[dict]:
    """
    Generates quiz questions (Difficult difficulty) by processing chunks concurrently with delays.
    """
    print(f"Generating difficult quiz for transcript of length {len(transcript)}...")
    responses = await split_transcript_and_collect_responses(transcript, difficult_quiz_chain)

    if responses is None:
        print("⚠️ split_transcript_and_collect_responses returned None unexpectedly.")
        raise ValueError("Difficult quiz generation failed during chunk processing.")

    flattened_list = []
    for i, response in enumerate(responses):
        if response is None or isinstance(response, Exception):
            print(f"ℹ️ Skipping difficult quiz results from failed chunk {i}.")
            continue

        if not isinstance(response, QuestionsAndAnswers):
            print(f"⚠️ Difficult quiz chain (chunk {i}) returned unexpected type: {type(response)}: {response}")
            continue
        if not hasattr(response, "question_and_answers") or not isinstance(response.question_and_answers, list):
            print(f"⚠️ Malformed difficult quiz response from chunk {i}: {response}")
            continue

        for item in response.question_and_answers:
            if isinstance(item, QuestionAndAnswer):
                flattened_list.append(item.dict())
            elif isinstance(item, dict):
                if 'question' in item and 'answers' in item and 'correct_answer' in item:
                    flattened_list.append(item)
                else:
                    print(f"⚠️ Skipping malformed difficult quiz item (dict) from chunk {i}: {item}")
            else:
                print(f"⚠️ Skipping unexpected difficult quiz item type ({type(item)}) from chunk {i}: {item}")

    print(f"✅ Difficult quiz generation complete. Generated {len(flattened_list)} questions: {flattened_list}")
    return flattened_list

async def generate_subjects(transcript: str) -> list[str]:
    """
    Generates subjects by processing chunks concurrently with delays.
    """
    print(f"Generating subjects for transcript of length {len(transcript)}...")
    responses = await split_transcript_and_collect_responses(transcript, subjects_chain)

    if responses is None:
        print("⚠️ split_transcript_and_collect_responses returned None unexpectedly.")
        raise ValueError("Subject generation failed during chunk processing.")

    flattened_list = []
    for i, response in enumerate(responses):
        if response is None or isinstance(response, Exception):
            print(f"ℹ️ Skipping subjects results from failed chunk {i}.")
            continue

        if isinstance(response, dict) and "subjects" in response and isinstance(response["subjects"], list):
            subjects_in_chunk = [str(item) for item in response["subjects"]]
            flattened_list.extend(subjects_in_chunk)
        else:
            print(f"⚠️ Malformed subjects response from chunk {i}: {response}")

    unique_subjects = list(dict.fromkeys(flattened_list))
    print(f"✅ Subject generation complete. Found {len(unique_subjects)} unique subjects: {unique_subjects}")
    return unique_subjects



# import os

# import requests
# from dotenv import load_dotenv
# from langchain_openai import ChatOpenAI

# from rag.chains import (create_chat_chain, create_flashcard_chain,
#                         create_quiz_chain, create_subjects_chain,
#                         create_transcript_summary_chain,
#                         create_clean_transcript_chain)
# from langchain_text_splitters import RecursiveCharacterTextSplitter
# import asyncio
# import os
# from langchain_core.runnables import Runnable
# from rag.data_models import QuestionAndAnswer

# load_dotenv()

# llm = ChatOpenAI(model_name="gpt-3.5-turbo-1106", temperature=0, request_timeout=20, max_retries=10)
# stability_api = "https://api.stability.ai"
# stability_model = "stable-diffusion-v1-6"

# chat_chain = create_chat_chain(llm)
# summary_chain = create_transcript_summary_chain(llm)
# flashcard_chain = create_flashcard_chain(llm)
# quiz_chain = create_quiz_chain(llm)
# subjects_chain = create_subjects_chain(llm)
# response_clean_chain = create_clean_transcript_chain(llm)

# CHUNK_SIZE = 20_000

# def split_transcript(transcript: str):
#     text_splitter = RecursiveCharacterTextSplitter(
#         # Set a really small chunk size, just to show.
#         chunk_size=CHUNK_SIZE,
#         chunk_overlap=200,
#         length_function=len,
#         is_separator_regex=False,
#     )
#     texts = text_splitter.create_documents([transcript])
#     return texts


# def generate_chat_response(input_text: str):
#     response = chat_chain.invoke({"input": input_text})
#     return response


# async def split_transcript_and_collect_responses(transcript: str, chain: Runnable):
#     texts = split_transcript(transcript)
#     tasks = [asyncio.create_task(chain.ainvoke({"transcript": text})) for text in texts]
#     responses = await asyncio.gather(*tasks)
#     return responses


# async def generate_transcript_summary(transcript: str):
#     responses = await split_transcript_and_collect_responses(transcript, summary_chain)
#     full_summary = ' '.join(responses)

#     output = response_clean_chain.invoke({"transcript": full_summary})
#     return output


# async def generate_flashcards(transcript: str):
#     response = flashcard_chain.invoke({"transcript": transcript})
#     return response


# async def generate_image(prompt, stability_api=stability_api, stability_model=stability_model):
#     response = requests.post(
#         f"{stability_api}/v1/generation/{stability_model}/text-to-image",
#         headers={
#             "Content-Type": "application/json",
#             "Accept": "application/json",
#             "Authorization": f"Bearer {os.environ.get('STABILITY_API_KEY')}"
#         },
#         json={
#             "text_prompts": [
#                 {
#                     "text": prompt,
#                     "weight" : 0.5
#                 }
#             ],
#             "cfg_scale": 7,
#             "height": 320,
#             "width": 320,
#             "samples": 1,
#         },
#     )
#     return response


# async def generate_quiz(transcript: str):
#     responses = await split_transcript_and_collect_responses(transcript, quiz_chain)
#     sublists = [response.question_and_answers for response in responses]
#     flattened_list = [QuestionAndAnswer(question=item.question, answers=item.answers, correct_answer=item.correct_answer).json() for sublist in sublists for item in sublist]
#     return flattened_list


# async def generate_subjects(transcript: str):
#     responses = await split_transcript_and_collect_responses(transcript, subjects_chain)
#     subject_lists = [response["subjects"] for response in responses]
#     flattened_list = [item for sublist in subject_lists for item in sublist]
#     return flattened_list
