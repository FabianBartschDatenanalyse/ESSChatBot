from fastapi import FastAPI, HTTPException
import pandas as pd
import statsmodels.formula.api as smf
from pydantic import BaseModel
from typing import Dict, List

from .models import RegressionRequest, RegressionResult

app = FastAPI(title="Python-Statistics Service")

def _fit_ols(req: RegressionRequest) -> RegressionResult:
    try:
        df = pd.DataFrame(req.data)
        if df.empty:
            raise ValueError("Input data is empty.")
        
        # Ensure all columns in the formula exist in the dataframe
        all_vars = [req.formula.split('~')[0].strip()] + [v.strip() for v in req.formula.split('~')[1].split('+')]
        missing_cols = [v for v in all_vars if v not in df.columns]
        if missing_cols:
            raise ValueError(f"Missing columns in data: {', '.join(missing_cols)}")
            
        model = smf.ols(req.formula, data=df).fit()
        
        return RegressionResult(
            params=model.params.to_dict(),
            r_squared=float(model.rsquared),
            n=int(model.nobs)
        )
    except Exception as e:
        # Raise exceptions that will be caught by the calling endpoint
        raise e

@app.post("/ols", response_model=RegressionResult)
async def ols(req: RegressionRequest):
    try:
        return _fit_ols(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/regress", response_model=RegressionResult)
async def regress(req: RegressionRequest):
    """Alias for /ols to support legacy calls."""
    try:
        return _fit_ols(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "ok"}
