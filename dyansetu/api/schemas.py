from pydantic import BaseModel


class TranslateTextRequest(BaseModel):
    text: str
    src_lang: str = "auto"
    tgt_lang: str = "Hindi"


class TranslateTextResponse(BaseModel):
    translated_text: str
    detected_src_lang: str


class DetectLanguageRequest(BaseModel):
    text: str


class DetectLanguageResponse(BaseModel):
    language: str
