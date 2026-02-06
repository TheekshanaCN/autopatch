from pydantic import BaseModel, HttpUrl, Field
from typing import Optional, Literal


class CreateJobRequest(BaseModel):
    repo_url: HttpUrl = Field(..., description="Public GitHub repo URL")


class CreateJobResponse(BaseModel):
    job_id: str


class JobStatusResponse(BaseModel):
    job_id: str
    state: Literal["PENDING", "RUNNING", "SUCCESS", "FAILED"]
    step: str
    message: Optional[str] = None
