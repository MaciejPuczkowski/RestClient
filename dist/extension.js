"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
const vm2_1 = require("vm2");
let globalEnvironment = {
    variables: {},
    global: {}
};
// Add output channel for logging
let outputChannel;
class HttpCodeLensProvider {
    async provideCodeLenses(document) {
        const codeLenses = [];
        const text = document.getText();
        const lines = text.split('\n');
        // Add "Run All Requests" lens at the top of the file
        const topRange = new vscode.Range(0, 0, 0, 0);
        const runAllLens = new vscode.CodeLens(topRange, {
            title: "$(play-all) Run All Requests",
            command: 'cursor.httpClient.runAllRequests',
            arguments: []
        });
        codeLenses.push(runAllLens);
        let blockStart = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('###')) {
                blockStart = i + 1;
                continue;
            }
            if (line.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE|CONNECT)\s+/)) {
                const range = new vscode.Range(i, 0, i, line.length);
                const lens = new vscode.CodeLens(range, {
                    title: "$(play) Run Request",
                    command: 'cursor.httpClient.runRequest',
                    arguments: [{ blockStart, blockEnd: findBlockEnd(lines, i) }]
                });
                codeLenses.push(lens);
            }
        }
        return codeLenses;
    }
}
function findBlockEnd(lines, startLine) {
    for (let i = startLine + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('###')) {
            return i - 1;
        }
    }
    return lines.length - 1;
}
async function loadEnvironmentConfigs() {
    const envFiles = await vscode.workspace.findFiles('**/*.env.json', '**/*.private.env.json');
    const privateEnvFiles = await vscode.workspace.findFiles('**/*.private.env.json');
    let envs = {};
    let privateEnvs = {};
    // Load .env.json files
    for (const file of envFiles) {
        try {
            const content = await vscode.workspace.fs.readFile(file);
            const config = JSON.parse(content.toString());
            envs = { ...envs, ...config };
        }
        catch (error) {
            console.error(`Error loading ${file.fsPath}:`, error);
        }
    }
    // Load .private.env.json files
    for (const file of privateEnvFiles) {
        try {
            const content = await vscode.workspace.fs.readFile(file);
            const config = JSON.parse(content.toString());
            privateEnvs = { ...privateEnvs, ...config };
        }
        catch (error) {
            console.error(`Error loading ${file.fsPath}:`, error);
        }
    }
    return { envs, privateEnvs };
}
function activate(context) {
    // Create output channel
    outputChannel = vscode.window.createOutputChannel('HTTP Client');
    context.subscriptions.push(outputChannel);
    // Register environment picker command
    let envPickerDisposable = vscode.commands.registerCommand('cursor.httpClient.switchEnvironment', async () => {
        const { envs, privateEnvs } = await loadEnvironmentConfigs();
        // Get unique environment names from both configs
        const envNames = new Set([
            ...Object.keys(envs),
            ...Object.keys(privateEnvs)
        ]);
        const selected = await vscode.window.showQuickPick([...envNames], {
            placeHolder: 'Select environment'
        });
        if (selected) {
            // Merge configurations for the selected environment
            const envConfig = envs[selected] || {};
            const privateConfig = privateEnvs[selected] || {};
            globalEnvironment.variables = {
                ...envConfig,
                ...privateConfig
            };
            vscode.window.showInformationMessage(`Switched to environment: ${selected}`);
        }
    });
    // Register HTTP request command
    let runRequestDisposable = vscode.commands.registerCommand('cursor.httpClient.runRequest', async (args) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }
        const document = editor.document;
        if (document.languageId !== 'http') {
            vscode.window.showErrorMessage('Not an HTTP file');
            return;
        }
        try {
            const request = await parseHttpRequest(document.getText(), args?.blockStart, args?.blockEnd);
            // Create client object for scripts
            const client = {
                global: {
                    get: (key) => globalEnvironment.global[key],
                    set: (key, value) => { globalEnvironment.global[key] = value; }
                },
                log: (...args) => vscode.window.showInformationMessage(args.join(' '))
            };
            // Execute pre-request script if exists
            if (request.preRequestScript) {
                await executeScript(request.preRequestScript, {
                    client,
                    request: {
                        variables: {
                            set: (key, value) => { request.variables[key] = value; }
                        }
                    }
                });
            }
            // Replace variables in URL, headers, and body
            request.url = replaceVariables(request.url, request.variables);
            request.headers = Object.fromEntries(Object.entries(request.headers).map(([k, v]) => [k, replaceVariables(v, request.variables)]));
            if (request.body) {
                request.body = replaceVariables(request.body, request.variables);
            }
            const response = await executeRequest(request);
            // Execute post-request script if exists
            if (request.postRequestScript) {
                await executeScript(request.postRequestScript, {
                    client,
                    response: {
                        body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
                        status: response.status,
                        headers: response.headers
                    }
                });
            }
            showResponse(response);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
    // Register run all requests command
    let runAllRequestsDisposable = vscode.commands.registerCommand('cursor.httpClient.runAllRequests', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }
        const document = editor.document;
        if (document.languageId !== 'http') {
            vscode.window.showErrorMessage('Not an HTTP file');
            return;
        }
        const text = document.getText();
        const lines = text.split('\n');
        const requests = [];
        let blockStart = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('###')) {
                blockStart = i + 1;
                continue;
            }
            if (line.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE|CONNECT)\s+/)) {
                requests.push({
                    blockStart,
                    blockEnd: findBlockEnd(lines, i)
                });
            }
        }
        outputChannel.appendLine('\n=== Running all requests ===\n');
        outputChannel.show(true);
        for (const [index, request] of requests.entries()) {
            try {
                outputChannel.appendLine(`\n=== Executing request ${index + 1} of ${requests.length} ===\n`);
                await vscode.commands.executeCommand('cursor.httpClient.runRequest', request);
            }
            catch (error) {
                outputChannel.appendLine(`Error in request ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
                const continueExecution = await vscode.window.showWarningMessage(`Error in request ${index + 1}. Continue with remaining requests?`, 'Yes', 'No');
                if (continueExecution !== 'Yes') {
                    break;
                }
            }
        }
        outputChannel.appendLine('\n=== Finished running all requests ===\n');
    });
    // Register CodeLens provider
    const codeLensProvider = new HttpCodeLensProvider();
    context.subscriptions.push(vscode.languages.registerCodeLensProvider({ language: 'http', scheme: 'file' }, codeLensProvider), envPickerDisposable, runRequestDisposable, runAllRequestsDisposable);
}
function replaceVariables(text, variables) {
    return text.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, key) => {
        const value = key.split('.').reduce((obj, k) => obj?.[k.trim()], {
            ...globalEnvironment.variables,
            ...variables
        });
        return value !== undefined ? String(value) : match;
    });
}
async function executeScript(script, context) {
    outputChannel.appendLine('\n=== Executing script ===');
    outputChannel.appendLine(script);
    outputChannel.appendLine('=== Script context ===');
    outputChannel.appendLine(JSON.stringify(context, null, 2));
    outputChannel.show(true);
    const vm = new vm2_1.VM({
        timeout: 1000,
        sandbox: {
            ...context,
            console: {
                log: (...args) => {
                    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
                    outputChannel.appendLine(`[Script Log] ${message}`);
                    outputChannel.show(true);
                }
            }
        }
    });
    try {
        await vm.run(script);
        outputChannel.appendLine('=== Script completed successfully ===\n');
        outputChannel.show(true);
    }
    catch (error) {
        outputChannel.appendLine(`=== Script execution error: ${error} ===\n`);
        outputChannel.show(true);
        throw error;
    }
}
async function parseHttpRequest(content, blockStart, blockEnd) {
    const lines = content.split('\n');
    const request = {
        method: 'GET',
        url: '',
        headers: {},
        variables: {}
    };
    let isBody = false;
    let bodyLines = [];
    let currentScript = [];
    let isPreRequestScript = false;
    let isPostRequestScript = false;
    // If no block range is provided, use the whole file
    const startLine = blockStart ?? 0;
    const endLine = blockEnd ?? (lines.length - 1);
    isBody = false;
    bodyLines = [];
    // Parse the selected request block
    for (let i = startLine; i <= endLine; i++) {
        const line = lines[i].trim();
        if (line === '') {
            if (!isPreRequestScript && !isPostRequestScript) {
                isBody = true;
            }
            continue;
        }
        // Handle pre-request script
        if (line === '< {%') {
            isPreRequestScript = true;
            continue;
        }
        // Handle post-request script
        if (line === '> {%') {
            isPostRequestScript = true;
            continue;
        }
        // Handle script end
        if (line === '%}') {
            if (isPreRequestScript) {
                request.preRequestScript = currentScript.join('\n');
                currentScript = [];
                isPreRequestScript = false;
            }
            else if (isPostRequestScript) {
                request.postRequestScript = currentScript.join('\n');
                currentScript = [];
                isPostRequestScript = false;
            }
            continue;
        }
        if (isPreRequestScript || isPostRequestScript) {
            currentScript.push(line);
            continue;
        }
        if (line.startsWith('#')) {
            continue;
        }
        if (!isBody) {
            if (!request.url) {
                const match = line.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE|CONNECT)\s+(.+?)(?:\s+HTTP\/[\d.]+)?$/);
                if (match) {
                    request.method = match[1];
                    request.url = replaceVariables(match[2], request.variables);
                    continue;
                }
            }
            const headerMatch = line.match(/^([^:]+):\s*(.+)$/);
            if (headerMatch) {
                const [_, name, value] = headerMatch;
                request.headers[name] = replaceVariables(value, request.variables);
            }
        }
        else {
            bodyLines.push(line);
        }
    }
    if (bodyLines.length > 0) {
        request.body = replaceVariables(bodyLines.join('\n'), request.variables);
    }
    // Replace any remaining environment variables in the URL
    if (request.url) {
        request.url = replaceVariables(request.url, request.variables);
    }
    if (!request.url) {
        throw new Error('No URL specified in the request');
    }
    return request;
}
async function executeRequest(request) {
    outputChannel.appendLine(`\n=== Executing request to ${request.url} ===`);
    outputChannel.appendLine(`Method: ${request.method}`);
    outputChannel.appendLine('Headers:');
    Object.entries(request.headers).forEach(([key, value]) => {
        outputChannel.appendLine(`  ${key}: ${value}`);
    });
    if (request.body) {
        outputChannel.appendLine('Body:');
        outputChannel.appendLine(request.body);
    }
    outputChannel.show(true);
    try {
        const response = await (0, axios_1.default)({
            method: request.method.toLowerCase(),
            url: request.url,
            headers: request.headers,
            data: request.body,
            validateStatus: () => true
        });
        outputChannel.appendLine(`\nResponse received:`);
        outputChannel.appendLine(`Status: ${response.status} ${response.statusText}`);
        outputChannel.appendLine('Headers:');
        Object.entries(response.headers).forEach(([key, value]) => {
            outputChannel.appendLine(`  ${key}: ${value}`);
        });
        outputChannel.appendLine('Body:');
        outputChannel.appendLine(typeof response.data === 'object'
            ? JSON.stringify(response.data, null, 2)
            : response.data);
        outputChannel.show(true);
        return {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data
        };
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            const errorMsg = `Request failed: ${error.message}`;
            outputChannel.appendLine(errorMsg);
            outputChannel.show(true);
            throw new Error(errorMsg);
        }
        throw error;
    }
}
function showResponse(response) {
    const panel = vscode.window.createWebviewPanel('httpResponse', 'HTTP Response', vscode.ViewColumn.Beside, {});
    const headers = Object.entries(response.headers)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
    const content = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: var(--vscode-editor-font-family); padding: 10px; }
                pre { background-color: var(--vscode-editor-background); padding: 10px; }
                .status { color: ${response.status < 400 ? 'green' : 'red'}; }
            </style>
        </head>
        <body>
            <h2>Status: <span class="status">${response.status} ${response.statusText}</span></h2>
            <h3>Headers:</h3>
            <pre>${headers}</pre>
            <h3>Body:</h3>
            <pre>${typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : response.data}</pre>
        </body>
        </html>
    `;
    panel.webview.html = content;
}
function deactivate() {
    // Clean up global state
    globalEnvironment = {
        variables: {},
        global: {}
    };
    // Dispose of any remaining disposables
    vscode.commands.executeCommand('setContext', 'cursor.httpClient.active', false);
}
//# sourceMappingURL=extension.js.map