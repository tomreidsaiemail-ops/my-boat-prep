# Manual probe: capture raw Gemini replies for the sparsHardware prompt to find the JSON parse failure cause (not a pytest test)
import asyncio, json, os, sys, uuid
sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
import maint_ai

PROMPT_ATTRS = "make; model; colour; weight (ALWAYS give your estimated weight of the item as a plain number in kg); cost (ALWAYS give your estimated replacement cost, bought new today, as a plain number in NZD); diameter (a plain number in mm, where it applies to the item); length (a plain number in m, where it applies to the item); spar_material (one of: Aluminium, Carbon fibre, Wood, Stainless steel, Fibreglass, Composite)"


async def one(n):
    k = "sparsHardware"
    what = f"{maint_ai.MAINT_KEYS[k]} ({maint_ai.LIST_HINTS[k]})"
    text = (f"Boat: Beneteau Oceanis 38 Sloop.\nMake the \"{k}\" maintenance list = {what}, of the gear this boat most likely has, as fitted from the factory plus common additions."
            f"\nAttributes: {PROMPT_ATTRS}"
            "\nGroup the list into a few categories (headings) with the specific items under each. At most 12 headings and 40 items. "
            "Fill every weight and cost attribute for every item with a realistic estimate for this boat's size; fill length, diameter and area where they apply "
            "with realistic figures for this boat; fill make, model, colour and the other attributes only when you are reasonably confident, using the exact option text. "
            "Valid JSON only: never put a double quote character inside a value (write inches as in, e.g. 1.5 in). "
            f'Return exactly: {{"lists": {{"{k}": [{{"heading": "...", "items": [{{"label": "...", "attrs": {{"<attribute key>": "..."}}}}]}}]}}}}')
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"probe-{uuid.uuid4()}", system_message=maint_ai.MAINT_SYSTEM).with_model("gemini", "gemini-3-flash-preview")
    out = ""
    async for ev in chat.stream_message(UserMessage(text=text)):
        if isinstance(ev, TextDelta):
            out += ev.content
        elif isinstance(ev, StreamDone):
            break
    try:
        maint_ai._json(out)
        print(n, "OK", len(out))
    except Exception as e:
        pos = int(str(e).split("char ")[-1].rstrip(")")) if "char" in str(e) else 0
        s = out[out.find("{"):]
        print(n, "FAIL", e, "CONTEXT:", repr(s[max(0, pos - 150):pos + 60]))


async def main():
    await asyncio.gather(*(one(n) for n in range(3)))

asyncio.run(main())
