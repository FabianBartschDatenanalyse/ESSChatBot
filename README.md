
# ESS Navigator: AI-Powered Data Explorer

Welcome to the ESS Navigator, an intelligent chatbot designed to make the European Social Survey (ESS) dataset accessible through natural language. Instead of writing complex SQL queries, you can simply ask questions, and the AI will analyze the data, perform statistical calculations, and provide you with clear, understandable answers.

## Core Features

- **Natural Language Queries**: Ask questions in plain English (or German), e.g., "What is the average trust in parliament per country?".
- **AI-Powered SQL Generation**: The AI automatically translates your question into a valid SQL query.
- **Context-Aware Analysis**: Using a vector database (RAG), the chatbot understands the context of your question by referencing the ESS codebook, ensuring it uses the correct variables (e.g., knowing that `trstprl` means "trust in parliament").
- **Statistical Analysis**: The bot can perform on-the-fly statistical analyses like linear regression to uncover relationships between variables.
- **Interactive & Transparent**: Every answer is accompanied by the exact SQL query used and the context retrieved from the codebook, ensuring full transparency.

## Technology Stack

- **Frontend**: Next.js, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **AI Orchestration**: Google Genkit
- **LLM Provider**: OpenAI (GPT-4o)
- **Database**: Supabase (PostgreSQL for data storage, pgvector for vector search)
- **Vector Embeddings**: OpenAI `text-embedding-3-small`

---

## Architectural Workflow

The application follows a sophisticated, multi-step process to answer user queries accurately. Here is a step-by-step breakdown of the workflow:

### Step 1: User Input & Question Reformulation

A user's journey begins in the `AskAiPanel` component.

1.  **User Question**: The user types a question into the chat interface.
2.  **API Call**: The frontend calls the main serverless function, `mainAssistant`.
3.  **Question Reformulation (`mainAssistantFlow`)**: The AI first analyzes the current question in the context of the conversation history. If it's a follow-up question (e.g., "and for Germany?"), it reformulates it into a complete, self-contained query (e.g., "What is the average trust in parliament for Germany?"). This ensures that every tool call is stateless and understandable on its own.

### Step 2: Context Retrieval (RAG)

Before generating a query, the system retrieves relevant context using a Retrieval-Augmented Generation (RAG) approach.

1.  **Vector Search (`searchCodebook`)**: The reformulated question is converted into a vector embedding. This embedding is used to search a `pgvector` database in Supabase, which contains chunked and embedded sections of the ESS codebook.
2.  **Context Injection**: The most relevant parts of the codebook (e.g., descriptions of variables like `cntry`, `agea`, `trstprl`) are retrieved. This context is crucial for the next step.

### Step 3: SQL Generation or Statistical Analysis

Based on the user's intent, the system decides whether to generate a simple SQL query or perform a more complex statistical analysis.

#### Path A: Standard SQL Query

1.  **SQL Suggestion (`suggestSqlQueryFlow`)**: The AI is prompted with the reformulated question and the retrieved codebook context. Its task is to generate a precise and valid SQL query. It follows strict rules, such as correctly quoting the table name (`"ESS1"`) and casting variables for calculations (`CAST(trstprl AS NUMERIC)`).
2.  **Query Execution (`executeQueryTool` -> `data-service`)**:
    *   The generated SQL is passed to the `executeQueryTool`.
    *   This tool calls the `executeQuery` function in `data-service.ts`, which makes a secure RPC call to the `execute_safe_query` function in the Supabase database.
    *   The database function ensures only `SELECT` statements are run, preventing any modifications to the data. It executes the query and returns the results as a JSON object.

#### Path B: Statistical Analysis

1.  **Analysis Planning (`mainAssistantFlow`)**: If the user's question implies a statistical relationship (e.g., "What is the effect of education on income?"), the AI first plans the analysis. It identifies the dependent variable (target), independent variables (features), and any necessary filters.
2.  **Statistical Tool (`statisticsTool`)**:
    *   Instead of the standard query tool, the `statisticsTool` is invoked.
    *   This tool constructs its own SQL query to fetch the raw, unfiltered data required for the analysis.
    *   It then performs the regression (e.g., Linear Regression or Random Forest) directly in the Node.js environment using libraries like `ml-regression-multivariate-linear`.

### Step 4: Final Answer Synthesis

1.  **LLM-Powered Summary**: The final data (either from the SQL query or the statistical analysis), along with the user's original question and the SQL query used, is sent back to the AI.
2.  **User-Friendly Response**: The AI synthesizes all this information into a comprehensive, easy-to-understand final answer.
3.  **Display in UI**: The `AskAiPanel` component receives the final answer, the SQL query, and the retrieved context, and displays them to the user. The details are neatly tucked away in an accordion to keep the interface clean.

This workflow ensures that the chatbot's answers are not only accurate and data-driven but also transparent and contextually aware.
