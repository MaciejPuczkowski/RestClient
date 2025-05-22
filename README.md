# HTTP Client Extension for Cursor

This extension provides support for `.http` files in Cursor, similar to IntelliJ's HTTP Client. It allows you to create, edit, and execute HTTP requests directly from your editor.

## Features

- Syntax highlighting for HTTP requests
- Environment variables support using `{{variable}}` syntax
- Pre-request and post-request JavaScript scripts
- Global variable sharing between requests
- Support for all HTTP methods (GET, POST, PUT, DELETE, etc.)
- Response viewing in a separate panel
- Comment support using `#` for single line and `###` for multi-line comments
- Support for multiple environment configurations with public and private settings

## Usage

### Basic Request

```http
GET https://api.example.com/users
Accept: application/json
```

### Environment Configuration

The extension supports two types of environment files:
- `*.env.json` - For public configuration
- `*.private.env.json` - For sensitive data (should be added to .gitignore)

Example structure for `myconfig.env.json`:
```json
{
  "dev": {
    "ApiUrl": "https://api.example.com",
    "ServiceUrl": "https://service.example.com",
    "Region": "US"
  },
  "local": {
    "ApiUrl": "http://localhost:3000",
    "ServiceUrl": "http://localhost:8080",
    "Region": "EU"
  }
}
```

Example structure for `myconfig.private.env.json`:
```json
{
  "dev": {
    "ApiKey": "your-dev-api-key"
  },
  "local": {
    "ApiKey": "your-local-api-key"
  }
}
```

Use variables in requests:
```http
GET {{ApiUrl}}/users
Authorization: Bearer {{ApiKey}}
```

### Pre-request and Post-request Scripts

```http
### Pre-request script
< {%
    request.variables.set("timestamp", new Date().toISOString());
%}
POST {{ApiUrl}}/data
Content-Type: application/json

{
    "time": "{{timestamp}}"
}

### Post-request script
> {%
    client.log("Response received:", response.body);
    client.global.set("lastResponse", response.body);
%}
```

### Chaining Requests with Global Variables

```http
### First request - store data
GET {{ApiUrl}}/items
Accept: application/json

> {%
    const data = JSON.parse(response.body);
    client.global.set("itemId", data[0].id);
%}

### Second request - use stored data
GET {{ApiUrl}}/items/{{itemId}}
Accept: application/json
```

### Multiple Requests in One File

You can separate multiple requests using `###`:

```http
### Get all users
GET {{ApiUrl}}/users

### Get specific user
GET {{ApiUrl}}/users/123

### Create new user
POST {{ApiUrl}}/users
Content-Type: application/json

{
    "name": "John Doe",
    "email": "john@example.com"
}
```

## Running Requests

1. Open a `.http` file
2. Place your cursor inside the request you want to execute
3. Press `F1` or `Ctrl+Shift+P` and type "Run HTTP Request"
4. The response will appear in a new panel beside your editor

## Environment Management

1. Create environment files:
   - Public settings in `*.env.json` files
   - Private settings in `*.private.env.json` files
2. Press `F1` or `Ctrl+Shift+P` and type "HTTP Client: Switch Environment"
3. Select the environment you want to use (e.g., "dev" or "local")

The extension will:
1. Find all `*.env.json` and `*.private.env.json` files
2. Merge configurations from both file types for the selected environment
3. Make all variables available in your HTTP requests

## Scripting Features

### Pre-request Scripts (`< {%...%}`)
- Modify request variables before sending
- Access through `request.variables.set(key, value)`

### Post-request Scripts (`> {%...%}`)
- Process response data
- Store values for later requests
- Access response through `response.body`, `response.status`, `response.headers`

### Global Variables
- Share data between requests
- Set: `client.global.set(key, value)`
- Get: `client.global.get(key)`

### Logging
- Use `client.log(...)` to show messages in the editor

## Installation

1. Clone this repository
2. Run `npm install`
3. Build the extension with `npm run compile`
4. Copy the extension to your Cursor extensions directory

## Development

- `npm run compile` - Compile the extension
- `npm run watch` - Watch for changes and recompile
- `npm test` - Run tests 