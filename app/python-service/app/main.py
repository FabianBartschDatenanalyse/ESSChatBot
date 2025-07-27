from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, List
import pandas as pd
import statsmodels.formula.api as smf

app = FastAPI(title="Python-Statistics Service")

class RegressionRequest(BaseModel):
    formula: str               # z.B. "trstprl ~ female + agec"
    data: Dict[str, List[float]]  # spaltenorientiert: {"trstprl":[...], "female":[...], "agec":[...]}

@app.get("/health")
def health():
    return {"status": "ok"}

def _fit_ols(req: RegressionRequest):
    df = pd.DataFrame(req.data)
    model = smf.ols(req.formula, data=df).fit()
    return {
        "params": model.params.to_dict(),
        "stderr": model.bse.to_dict(),
        "tvalues": model.tvalues.to_dict(),
        "pvalues": model.pvalues.to_dict(),
        "r_squared": float(model.rsquared),
        "n": int(model.nobs)
    }

@app.post("/ols")
def ols(req: RegressionRequest):
    try:
        return _fit_ols(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Alias, falls dein Webcode /regress aufruft:
@app.post("/regress")
def regress(req: RegressionRequest):
    return ols(req)
