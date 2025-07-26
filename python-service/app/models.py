from pydantic import BaseModel
from typing import List, Dict, Optional

class RegressionRequest(BaseModel):
    formula: str            # z.B. "trstprl ~ female + agec"
    data: Dict[str, List[float]]  # simple column‑oriented payload (or Arrow)

class RegressionResult(BaseModel):
    params: Dict[str, float]
    r_squared: float
    n: int