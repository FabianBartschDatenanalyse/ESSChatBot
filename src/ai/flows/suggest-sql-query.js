'use server';
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.suggestSqlQuery = suggestSqlQuery;
/**
 * @fileOverview An AI agent that suggests SQL queries based on a natural language question.
 *
 * - suggestSqlQuery - A function that suggests SQL queries.
 * - SuggestSqlQueryInput - The input type for the suggestSqlQuery function.
 * - SuggestSqlQueryOutput - The return type for the suggestSqlQuery function.
 */
var genkit_1 = require("@/ai/genkit");
var genkit_2 = require("genkit");
var MessageSchema = genkit_2.z.object({
    role: genkit_2.z.enum(['user', 'assistant', 'tool']),
    content: genkit_2.z.string(),
});
var SuggestSqlQueryInputSchema = genkit_2.z.object({
    question: genkit_2.z.string().describe('The natural language question to generate a SQL query for.'),
    codebook: genkit_2.z.string().describe('Relevant context from the database codebook to use to construct the query.'),
    history: genkit_2.z.array(MessageSchema).optional().describe("The conversation history."),
});
var SuggestSqlQueryOutputSchema = genkit_2.z.object({
    sqlQuery: genkit_2.z.string().describe('The suggested SQL query based on the question. Should be an empty string if no valid query can be generated.'),
});
function suggestSqlQuery(input) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, suggestSqlQueryFlow(input)];
        });
    });
}
var prompt = genkit_1.ai.definePrompt({
    name: 'suggestSqlQueryPrompt',
    input: { schema: SuggestSqlQueryInputSchema },
    output: { schema: SuggestSqlQueryOutputSchema },
    model: 'openai/gpt-4o',
    prompt: "You are an expert SQL query writer. Your task is to generate a valid SQL query based on a user's question, conversation history, and relevant context from a database codebook.\n\n  Carefully analyze the user's question, the history, and the provided context to construct an accurate query.\n\n  **CRITICAL RULES:**\n  1.  **Table Name:** The ONLY table you can query is \"ESS1\". This table name MUST ALWAYS be enclosed in double quotes (e.g., `FROM \"ESS1\"`).\n  2.  **Column Names:** You MUST use the exact column names as they appear in the codebook context. Pay close attention to abbreviations (e.g., 'cntry' for country, 'trstprl' for trust in parliament). DO NOT use intuitive but incorrect names like 'country'. Column names should NOT be quoted.\n  3.  **Casting:** When performing mathematical operations (like AVG, SUM, etc.) on a column, you MUST cast it to a numeric type (e.g., `CAST(trstprl AS NUMERIC)`).\n  4.  **No Semicolon:** The generated SQL query MUST NOT end with a semicolon.\n  5.  **Filtering Missing Values:** When aggregating data (e.g., with AVG, COUNT), you MUST exclude rows with missing or invalid data. The codebook specifies missing values with codes like 77, 88, and 99. These are stored as TEXT, so you MUST compare them as strings. Always include a `WHERE` clause to filter these out (e.g., `WHERE trstprl NOT IN ('77', '88', '99')`).\n  6.  **Empty Query Fallback:** If you cannot determine a valid SQL query from the request, you MUST return an empty string for the 'sqlQuery' field.\n\n  **Conversation History (for context on follow-up questions):**\n  {{#if history}}\n    {{#each history}}\n      **{{role}}**: {{content}}\n    {{/each}}\n  {{else}}\n    No history.\n  {{/if}}\n\n  **User's Current Question (this is the question you need to turn into SQL):**\n  {{{question}}}\n\n  **Relevant Codebook Context:**\n  ```\n  {{{codebook}}}\n  ```\n\n  Based on all the above, generate the SQL query.",
});
var suggestSqlQueryFlow = genkit_1.ai.defineFlow({
    name: 'suggestSqlQueryFlow',
    inputSchema: SuggestSqlQueryInputSchema,
    outputSchema: SuggestSqlQueryOutputSchema,
}, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var output;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('[suggestSqlQueryFlow] Received input:', JSON.stringify(input, null, 2));
                return [4 /*yield*/, prompt(input)];
            case 1:
                output = (_a.sent()).output;
                console.log('[suggestSqlQueryFlow] LLM output:', JSON.stringify(output, null, 2));
                return [2 /*return*/, output];
        }
    });
}); });
