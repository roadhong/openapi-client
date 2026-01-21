# OpenAPI Client

A web-based client tool for testing and exploring APIs based on OpenAPI specifications.

## Features

### 📋 API Exploration
- Load and parse OpenAPI specifications (JSON/YAML)
- Display API endpoint list (grouped by controller)
- View API details (Summary, Description, Callbacks)

### 🚀 API Testing
- Create and send HTTP requests
- Configure Path Parameters, Query Parameters, and Headers
- Edit Request Body (JSON5 support)
- Support for various Content-Types
- Real-time response viewing

### 🔐 Authentication Management
- **API Key**: Support for Header, Query, and Cookie locations
- **HTTP Basic**: Username/Password authentication
- **Bearer Token**: JWT and other Bearer tokens
- **OAuth2**: Authorization Code, Client Credentials, and more
- **OpenID Connect**: ID Token-based authentication
- Global authentication settings and per-API authentication configuration

### ⚙️ Advanced Features
- Server URL management and switching
- Global header configuration
- Request/Response history
- Schema viewer (Request/Response schemas)
- Dark mode support
- Responsive design (desktop/mobile)

## Tech Stack

- **Framework**: React 19, TypeScript
- **Build Tool**: Vite
- **State Management**: MobX
- **Styling**: Tailwind CSS
- **Code Editor**: CodeMirror
- **HTTP Client**: Axios
- **OpenAPI**: openapi-types

## Getting Started

### Prerequisites

- Node.js 18 or higher
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install
```

### Development Server

```bash
pnpm dev
```

Once the development server starts, open `http://localhost:5173` in your browser.

### Build

```bash
# Production build
pnpm build

# Preview build output
pnpm preview
```

## Usage

### 1. Load OpenAPI Specification

1. Click the **Add** button in the header
2. Enter the URL or file of the OpenAPI specification
3. Once loaded, the API list will be displayed

### 2. Select and Test API

1. Select the API to test from the left panel
2. Configure request parameters in the middle panel:
   - Path Parameters
   - Query Parameters
   - Headers
   - Request Body
3. Click the **Send** button to send the request
4. View the response in the right panel

### 3. Configure Authentication

1. Click the **Authorize** button in the header
2. Select the authentication method and enter the required information
3. The configured authentication will be automatically applied to all requests

### 4. Server Management

1. Click the **Servers** button in the header
2. Select from the server list defined in the OpenAPI specification, or
3. Add a custom server URL

## Project Structure

```
openapi-client/
├── src/
│   ├── components/          # React components
│   │   ├── dialogs/
│   │   │   ├── HeaderDialog.tsx
│   │   │   ├── GlobalAuthorizeDialog.tsx
│   │   │   ├── ServersDialog.tsx
│   │   │   ├── SourceDialog.tsx
│   │   │   └── InfoDialog.tsx
│   │   ├── sections/
│   │   │   ├── ApiListSection.tsx
│   │   │   ├── RequestSection.tsx
│   │   │   └── ResponseSection.tsx
│   │   ├── layout/
│   │   │   └── Header.tsx
│   │   ├── ui/
│   │   │   ├── MethodBadge.tsx
│   │   │   ├── SchemaViewer.tsx
│   │   │   └── Toast.tsx
│   │   └── ...
│   ├── store/               # MobX stores
│   │   ├── api/
│   │   │   └── ApiStore.ts
│   │   └── toast/
│   │       └── ToastStore.ts
│   ├── types.ts             # TypeScript type definitions
│   ├── App.tsx              # Main app component
│   └── main.tsx             # Entry point
├── public/                  # Static files
├── index.html
├── package.json
├── vite.config.ts
└── tailwind.config.cjs
```

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Production build
- `pnpm preview` - Preview build output
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Auto-fix ESLint issues
- `pnpm format` - Format code with Prettier
- `pnpm format:check` - Check code formatting with Prettier

## License

This project is licensed under the MIT License.
