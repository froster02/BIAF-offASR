import uuid
import threading
import time

class JobManager:
    def __init__(self):
        self.jobs = {}
        self.lock = threading.Lock()

    def create_job(self, task_type):
        job_id = str(uuid.uuid4())
        with self.lock:
            self.jobs[job_id] = {
                "id": job_id,
                "type": task_type,
                "status": "pending",
                "progress": 0,
                "result": None,
                "error": None,
                "created_at": time.time()
            }
        return job_id

    def update_job(self, job_id, status=None, progress=None, result=None, error=None):
        with self.lock:
            if job_id in self.jobs:
                if status: self.jobs[job_id]["status"] = status
                if progress is not None: self.jobs[job_id]["progress"] = progress
                if result: self.jobs[job_id]["result"] = result
                if error: self.jobs[job_id]["error"] = error

    def get_job(self, job_id):
        with self.lock:
            return self.jobs.get(job_id)

    def cleanup_old_jobs(self, max_age=3600):
        now = time.time()
        with self.lock:
            to_delete = [jid for jid, j in self.jobs.items() if now - j["created_at"] > max_age]
            for jid in to_delete:
                del self.jobs[jid]

job_manager = JobManager()
