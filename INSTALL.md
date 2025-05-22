# Installing the HTTP Client Extension for Cursor

## Prerequisites

- Node.js (v14 or later)
- npm (comes with Node.js)
- Cursor IDE

## Installation Steps

1. **Clone or Download the Extension**
   ```bash
   git clone <your-repository-url>
   cd HttpExt
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build the Extension**
   ```bash
   npm run compile
   ```

4. **Install in Cursor**

   ### Windows
   1. Navigate to your Cursor extensions directory:
      ```
      %USERPROFILE%\.cursor\extensions
      ```
   2. Create a directory for the extension:
      ```
      mkdir cursor-http-client
      ```
   3. Copy the following files/directories to the new directory:
      - `dist/`
      - `syntaxes/`
      - `package.json`
      - `language-configuration.json`

   ### macOS/Linux
   1. Navigate to your Cursor extensions directory:
      ```
      ~/.cursor/extensions
      ```
   2. Create a directory for the extension:
      ```
      mkdir cursor-http-client
      ```
   3. Copy the following files/directories to the new directory:
      - `dist/`
      - `syntaxes/`
      - `package.json`
      - `language-configuration.json`

5. **Restart Cursor**
   - Close and reopen Cursor to load the extension

## Verifying Installation

1. Open Cursor
2. Create a new file with `.http` extension
3. You should see syntax highlighting for HTTP requests
4. Press `F1` or `Ctrl+Shift+P` and type "HTTP Client"
5. You should see the following commands:
   - "Run HTTP Request"
   - "HTTP Client: Switch Environment"

## Setting Up Environment Variables

1. Create a new file named `dev.env.json` in your project:
   ```json
   {
       "Host": "https://api.example.com",
       "AuthToken": "your-auth-token"
   }
   ```

2. Switch to your environment:
   - Press `F1` or `Ctrl+Shift+P`
   - Type "HTTP Client: Switch Environment"
   - Select your environment file

## Troubleshooting

### Extension Not Loading
- Make sure all required files are copied to the correct location
- Check Cursor's extension directory path
- Verify file permissions
- Restart Cursor

### Syntax Highlighting Not Working
- Verify the file has `.http` or `.rest` extension
- Check if language configuration files are properly copied
- Restart Cursor

### Environment Variables Not Working
- Ensure environment file has `.env.json` extension
- Verify JSON syntax in environment file
- Switch environment using the command palette

## Support

If you encounter any issues:
1. Check the error message in Cursor's output panel
2. Verify all installation steps were completed
3. Check file permissions in the extensions directory
4. Try reinstalling the extension

## Updating the Extension

1. Pull the latest changes
2. Run `npm install` to update dependencies
3. Run `npm run compile` to rebuild
4. Copy the updated files to your Cursor extensions directory
5. Restart Cursor 