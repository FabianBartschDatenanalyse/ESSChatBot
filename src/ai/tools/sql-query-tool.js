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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeQueryTool = void 0;
/**
 * @fileOverview A Genkit tool for generating and executing SQL queries.
 *
 * This file defines the `executeQueryTool`, which allows an AI agent to
 * query a database. The tool takes a natural language query, converts
 * it to SQL, executes it, and returns the result.
 */
var genkit_1 = require("@/ai/genkit");
var data_service_1 = require("@/lib/data-service");
var genkit_2 = require("genkit");
var suggest_sql_query_1 = require("../flows/suggest-sql-query");
var vector_search_1 = require("@/lib/vector-search");
var MessageSchema = genkit_2.z.object({
    role: genkit_2.z.enum(['user', 'assistant', 'tool']),
    content: genkit_2.z.string(),
});
var toolInputSchema = genkit_2.z.object({
    nlQuestion: genkit_2.z.string().describe('A natural language question that can be answered with a SQL query.'),
    history: genkit_2.z.array(MessageSchema).optional().describe("The conversation history."),
});
var toolOutputSchema = genkit_2.z.object({
    // Always include these fields for downstream visibility
    sqlQuery: genkit_2.z.string().default(''),
    injectedSql: genkit_2.z.string().default(''),
    retrievedContext: genkit_2.z.string().default(''),
    data: genkit_2.z.any().optional(),
    error: genkit_2.z.string().optional(),
});
exports.executeQueryTool = genkit_1.ai.defineTool({
    name: 'executeQueryTool',
    description: 'Use this tool to query the database to answer user questions about the data. Takes a natural language question and optional conversation history as input.',
    inputSchema: toolInputSchema,
    outputSchema: toolOutputSchema,
}, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var sqlQuery, injectedSql, retrievedContext, searchResults, q, looksLikeFamiliarity, contextLower, contextHasExplicitFamiliarity, hint, sqlQuestion, suggestion, suggestionError_1, errorMsg, placeholderColumns, placeholderSelectList, missingCodes, bestEffort, result, e_1, errorMsg;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                sqlQuery = '';
                injectedSql = '';
                retrievedContext = '';
                console.log('[executeQueryTool] Received input:', JSON.stringify(input, null, 2));
                _b.label = 1;
            case 1:
                _b.trys.push([1, 8, , 9]);
                return [4 /*yield*/, (0, vector_search_1.searchCodebook)(input.nlQuestion, 5)];
            case 2:
                searchResults = _b.sent();
                retrievedContext = searchResults
                    .map(function (result, idx) {
                    var _a, _b;
                    console.log("[executeQueryTool] Vector match #".concat(idx + 1, " (sim=").concat((_a = result.similarity) !== null && _a !== void 0 ? _a : 'n/a', "):"), (_b = result.content) === null || _b === void 0 ? void 0 : _b.slice(0, 200));
                    return "- ".concat(result.content);
                })
                    .join('\n');
                console.log("[executeQueryTool] Retrieved context from vector DB (length=".concat(retrievedContext.length, ")."));
                q = input.nlQuestion.toLowerCase();
                looksLikeFamiliarity = q.includes('vertraut') || q.includes('vertrautheit') || q.includes('familiar');
                contextLower = retrievedContext.toLowerCase();
                contextHasExplicitFamiliarity = contextLower.includes('stfknw') || contextLower.includes('familiar');
                hint = looksLikeFamiliarity && !contextHasExplicitFamiliarity
                    ? '\n\nNote: If no explicit "familiarity" variable is present in the codebook context, use "trstprl" (trust in parliament) as the proxy measure and aggregate by "cntry".'
                    : '';
                sqlQuestion = "".concat(input.nlQuestion).concat(hint);
                console.log('[executeQueryTool] NL question after heuristic hint:', sqlQuestion);
                suggestion = void 0;
                _b.label = 3;
            case 3:
                _b.trys.push([3, 5, , 6]);
                console.log('[executeQueryTool] Calling suggestSqlQuery...');
                return [4 /*yield*/, (0, suggest_sql_query_1.suggestSqlQuery)({
                        question: sqlQuestion,
                        codebook: retrievedContext,
                        history: input.history,
                    })];
            case 4:
                suggestion = _b.sent();
                console.log('[executeQueryTool] suggestSqlQuery output:', suggestion);
                sqlQuery = suggestion.sqlQuery;
                injectedSql = sqlQuery || injectedSql;
                return [3 /*break*/, 6];
            case 5:
                suggestionError_1 = _b.sent();
                errorMsg = "\u274C Failed to generate SQL query. Error: ".concat(suggestionError_1.message || 'Unknown error');
                console.error('[executeQueryTool]', errorMsg, suggestionError_1);
                // Return required fields with deterministic SQL carrier
                return [2 /*return*/, { error: errorMsg, sqlQuery: sqlQuery || '', injectedSql: injectedSql || '', retrievedContext: retrievedContext || '' }];
            case 6:
                if (!sqlQuery || sqlQuery.trim() === '') {
                    placeholderColumns = (function () {
                        // Try to heuristically extract candidate column names from retrievedContext:
                        // Very simple heuristic: grab words that look like variable tokens (letters, digits, underscore) commonly used as column names.
                        var matches = (retrievedContext.match(/\b[a-zA-Z_][a-zA-Z0-9_]{1,30}\b/g) || [])
                            // Filter out obvious non-column words and duplicates
                            .filter(function (w) { return !['the', 'and', 'or', 'for', 'is', 'are', 'of', 'to', 'in', 'by', 'with', 'as', 'on', 'at', 'be', 'an', 'a', 'this', 'that', 'these', 'those', 'from', 'not', 'no', 'yes', 'it', 'its', 'if', 'then', 'else', 'when', 'where', 'which', 'was', 'were', 'has', 'have', 'had', 'can', 'could', 'should', 'would', 'may', 'might', 'will', 'shall', 'data', 'variable', 'codebook', 'column', 'columns', 'table', 'ess1', 'ESS1'].includes(w.toLowerCase()); })
                            .slice(0, 6);
                        // Ensure essential likely columns show up if present in context
                        var prioritized = ['cntry', 'trstprl', 'agea', 'gndr'].filter(function (c) { return retrievedContext.toLowerCase().includes(c); });
                        var combined = Array.from(new Set(__spreadArray(__spreadArray([], prioritized, true), matches, true)));
                        return combined.length > 0 ? combined : ['cntry', 'trstprl'];
                    })();
                    placeholderSelectList = placeholderColumns.map(function (c) { return "CAST(".concat(c, " AS NUMERIC) AS ").concat(c); }).join(', ');
                    missingCodes = "'77','88','99'";
                    bestEffort = "SELECT ".concat(placeholderSelectList, "\nFROM \"ESS1\"\nWHERE ").concat(placeholderColumns[0], " NOT IN (").concat(missingCodes, ")\n-- TODO: Adjust selected columns based on the codebook context above.\n-- TODO: Add proper WHERE filters to exclude missing/invalid values for each aggregated column.\n-- TODO: Add GROUP BY (e.g., cntry) or aggregations (e.g., AVG(CAST(trstprl AS NUMERIC))) as needed to answer: ").concat(JSON.stringify(input.nlQuestion), "\n-- Context excerpt used to infer columns:\n-- ").concat(retrievedContext.slice(0, 400).replace(/\n/g, ' '));
                    console.warn('[executeQueryTool] AI returned empty SQL; providing best-effort template instead.');
                    sqlQuery = bestEffort;
                    injectedSql = sqlQuery;
                }
                console.log("[executeQueryTool] Generated SQL: ".concat(sqlQuery));
                injectedSql = sqlQuery || injectedSql;
                console.log('[executeQueryTool] FINAL SQL QUERY:', "\n".concat(sqlQuery));
                // Step 3: Execute SQL
                console.log('[executeQueryTool] Executing SQL via data-service.executeQuery...');
                return [4 /*yield*/, (0, data_service_1.executeQuery)(sqlQuery)];
            case 7:
                result = _b.sent();
                console.log('[executeQueryTool] executeQuery result meta:', { hasData: !!result.data, hasError: !!result.error, rows: (_a = result.data) === null || _a === void 0 ? void 0 : _a.length });
                if (result.error) {
                    console.error('[executeQueryTool] Query execution failed:', result.error, { sql: sqlQuery });
                    return [2 /*return*/, { error: "\u274C Query execution failed: ".concat(result.error), sqlQuery: sqlQuery || '', injectedSql: injectedSql || '', retrievedContext: retrievedContext || '' }];
                }
                if (result.data) {
                    if (result.data.length > 0) {
                        console.log("[executeQueryTool] Query returned ".concat(result.data.length, " rows. Example row:"), result.data[0]);
                        // Always include sqlQuery/injectedSql and retrievedContext so the UI/LLM can display them.
                        return [2 /*return*/, { data: result.data, sqlQuery: sqlQuery || '', injectedSql: injectedSql || '', retrievedContext: retrievedContext || '' }];
                    }
                    else {
                        console.warn('[executeQueryTool] SQL executed successfully, but no data was returned.', { sql: sqlQuery });
                        return [2 /*return*/, { data: [], sqlQuery: sqlQuery || '', injectedSql: injectedSql || '', retrievedContext: retrievedContext || '' }];
                    }
                }
                console.error('[executeQueryTool] No data or error returned from executeQuery. This indicates an unexpected response.');
                return [2 /*return*/, { error: 'No data or error returned from executeQuery', sqlQuery: sqlQuery || '', injectedSql: injectedSql || '', retrievedContext: retrievedContext || '' }];
            case 8:
                e_1 = _b.sent();
                errorMsg = "\uD83D\uDCA5 Unexpected error in executeQueryTool: ".concat(e_1.message || 'Unknown error');
                console.error('[executeQueryTool]', errorMsg, e_1);
                // Ensure fields are present in error path too.
                return [2 /*return*/, { error: errorMsg, sqlQuery: sqlQuery || '', injectedSql: injectedSql || '', retrievedContext: retrievedContext || '' }];
            case 9: return [2 /*return*/];
        }
    });
}); });
// ... (existing code in sql-query-tool.ts) ...
// Add this at the end of the file for testing
if (require.main === module) {
    function testExecuteQueryTool() {
        return __awaiter(this, void 0, void 0, function () {
            var testInput, result, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        testInput = {
                            nlQuestion: "What is the average age of participants?", // Replace with a sample question
                            codebook: "...", // Provide relevant codebook context if needed
                            // Add other necessary input parameters based on the tool's definition
                        };
                        console.log("Running executeQueryTool with test input:", testInput);
                        return [4 /*yield*/, (0, exports.executeQueryTool)(testInput)];
                    case 1:
                        result = _a.sent();
                        console.log("Test result:", result);
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        console.error("Error during test execution:", error_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
    testExecuteQueryTool();
}
