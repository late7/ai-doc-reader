# AI-Powered Document Analysis Platform

A Web-based Document analysis platform with AnythingLLM integration for AI-powered document content and financial analysis.

## Features

### Core Features
- **Workspace Management**: Connect to AnythingLLM workspaces for document analysis with persistent selection
- **Document Upload**: Upload pitch decks, business plans, and financial documents
- **AI-Powered Analysis**: Generate insights using customizable question templates
- **Doc Summaries**: Automated Data summaries
- **Custom Questions**: Configurable analysis prompts for different evaluation criteria
- **Financial Analysis**: AI-powered financial data extraction and analysis with OpenAI integration
- **PDF Export**: Generate comprehensive analysis reports

### Admin Features
- **Question Management**: Create, edit, and organize analysis questions
- **Prompt Configuration**: Customize AI prompts for different analysis types
- **Category Organization**: Group questions by analysis categories (Market, Financial, etc.)
- **System Configuration**: Admin-only controls for feature toggles (Finance module enable/disable)
- **Configuration Templates**: Template-based config system for easy deployment and updates

### Technical Features
- **Configurable Logging**: Environment-based log level control (debug, info, warn, error, none)
- **Template Config System**: Automatic config initialization from templates for new deployments
- **Workspace Persistence**: Remembers selected workspace across page navigation
- **OpenAI Integration**: Advanced financial analysis using GPT models

## Architecture

- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **Backend**: Next.js API routes with file system operations
- **AI Integration**: AnythingLLM REST API for document analysis
- **Financial Analysis**: OpenAI GPT integration for advanced financial data extraction
- **Configuration**: JSON-based question and prompt management with template system
- **Logging**: Centralized logging system with environment-controlled log levels
- **Export**: Text-based report generation (extensible to PDF)
- **Persistence**: localStorage for workspace selection, file system for configuration

## Setup

### Prerequisites
- Node.js 18+ 
- AnythingLLM instance running on localhost:3001
- Valid AnythingLLM API key

### Environment Configuration

Create `.env.local` file with:

```bash
# AnythingLLM Configuration (Generate API key in AnythingLLM admin -> dev section)
ANYTHINGLLM_ENDPOINT=http://localhost:3001
ANYTHINGLLM_KEY=your-api-key-here

# OpenAI Configuration (used for Financial analysis)
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini

# Logging Configuration
# Options: debug, info, warn, error, none
NEXT_PUBLIC_LOG_LEVEL=info

# Optional: Mock Data for development
USE_MOCK_DATA=false
```

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables (copy `.env.local.example` to `.env.local` and fill in your values)

3. Start development server:
```bash
npm run dev
```

The development server will automatically initialize configuration files from templates on startup.

### Build for Production

```bash
npm run build
npm start
```

## Usage

3. Open http://localhost:3000

### Getting Started
0. **Login to system**

1. **Access the Dashboard**: Navigate to `/dashboard`
2. **Select Workspace**: Choose an AnythingLLM workspace from the dropdown (selection persists across sessions)
3. **Upload Documents**: Drag and drop or select files for analysis
4. **Generate Summary**: Click "Generate Summary" for Document overview
5. **Run Analysis**: Execute individual questions for detailed insights
6. **Financial Analysis**: Access financial data extraction and analysis (if enabled by admin)
7. **Add Notes**: Supplement AI analysis with additional observations
8. **Export Report**: Generate downloadable analysis report

### Admin Panel

1. **Access Admin**: Navigate to `/admin`
2. **Manage Questions**: Add, edit, or delete analysis questions
3. **Configure Prompts**: Customize global prompt templates
4. **Organize Categories**: Group questions by analysis type
5. **System Settings**: Toggle features like Finance module on/off (admin-only controls)
6. **Save Changes**: Apply configuration updates

### Finance Analysis

The platform includes advanced financial analysis capabilities:

- **AI-Powered Extraction**: Automatic extraction of financial data from documents
- **OpenAI Integration**: Uses GPT models for complex financial analysis
- **Structured Data**: Extracts revenue, investments, expenses, funding, and projections
- **Admin Control**: Finance features can be enabled/disabled system-wide by administrators
- **Configurable Prompts**: Customizable financial analysis prompts

### Question Categories

- **Market**: TAM, competitive landscape, positioning
- **Business**: Revenue model, growth strategy, scalability
- **Team**: Founder experience, key personnel, expertise
- **Financial**: Projections, funding requirements, metrics
- **Risk**: Challenges, mitigation strategies, obstacles
- **Technology**: IP, tech stack, differentiation, barriers

## API Endpoints

### Core Analysis
- `GET /api/workspaces` - List AnythingLLM workspaces
- `POST /api/workspaces` - Create new workspace
- `POST /api/upload` - Upload documents to workspace
- `POST /api/analyze` - Run analysis questions
- `POST /api/finance` - Extract financial data from documents

### Configuration Management
- `GET /api/questions` - Get question configuration
- `PUT /api/questions` - Update question configuration
- `GET /api/categories` - Get category configuration
- `PUT /api/categories` - Update category configuration
- `GET /api/global-prompts` - Get global prompt configuration
- `PUT /api/global-prompts` - Update global prompt configuration
- `GET /api/formatting-prompt` - Get formatting prompt configuration
- `PUT /api/formatting-prompt` - Update formatting prompt configuration

### System Management
- `GET /api/system` - Get system configuration (finance toggle, etc.)
- `PUT /api/system` - Update system configuration
- `POST /api/login` - User authentication
- `POST /api/logout` - User logout

### Document Management
- `GET /api/documents/download` - Download processed documents
- `POST /api/upload-notes` - Upload additional notes/documents

## Configuration

The application uses a template-based configuration system for easy deployment and updates.

### Template System

Configuration files are automatically initialized from templates on first run:
- `src/config/template_*.json` - Template files with default configurations
- `src/config/*.json` - Active configuration files (created automatically)
- Template files are ignored by git, active configs are tracked

### Configuration Files

- `questions.json` - Analysis questions and categories
- `categoryPrompts.json` - Category-specific prompts
- `globalPrompts.json` - Global prompt templates
- `formattingPrompt.json` - Report formatting templates
- `financePrompt.json` - Financial analysis prompts
- `system.json` - System-wide settings (finance toggle, etc.)

### Example Configuration

Questions configuration (`src/config/questions.json`):

```json
{
  "questions": [
    {
      "id": "q1",
      "question": "What is the market opportunity?",
      "category": "Market"
    }
  ]
}
```

System configuration (`src/config/system.json`):
```json
{
  "financeEnabled": true
}
```

## Development

### Project Structure
```
src/
├── app/                 # Next.js App Router pages
│   ├── admin/          # Admin panel with system configuration
│   ├── dashboard/      # Main analysis dashboard
│   ├── finance/        # Financial analysis page
│   ├── login/          # Authentication page
│   └── api/            # API routes
├── components/          # React components
│   ├── FinanceAnalyzer.tsx     # Financial analysis component
│   ├── OpenAIFinanceAnalyzer.tsx # OpenAI-powered finance analysis
│   ├── WorkspaceSelector.tsx   # Workspace selection with persistence
│   └── ...
├── config/             # Configuration files
│   ├── *.json          # Active configuration files
│   └── template_*.json # Configuration templates
├── lib/                # Utilities and integrations
│   ├── logger.ts       # Centralized logging system
│   ├── anythingllm.ts  # AnythingLLM API client
│   ├── financePromptGenerator.ts # Financial prompt generation
│   └── usePersistentWorkspace.ts # Workspace persistence hook
└── types/              # TypeScript type definitions

scripts/
└── init-config.js      # Configuration initialization script

docs/                   # Additional documentation
storage/               # Document storage (ignored by git)
```

### Key Components
- `WorkspaceSelector`: AnythingLLM workspace selection with persistence
- `DocumentUploader`: File upload interface with progress tracking
- `QuestionAnalyzer`: Analysis execution and results display
- `FinanceAnalyzer`: Financial data extraction and analysis
- `OpenAIFinanceAnalyzer`: OpenAI-powered advanced financial analysis
- `AnalyzableFiguresManager`: Financial figures management
- `ApiDebugger`: API testing and debugging tools
- `AnythingLLMClient`: API integration client with logging

## Logging System

The application includes a centralized logging system with configurable log levels:

### Log Levels
- `debug`: Detailed debugging information
- `info`: General information (default)
- `warn`: Warning messages
- `error`: Error messages only
- `none`: Disable all logging

### Configuration
Set the log level in `.env.local`:
```bash
NEXT_PUBLIC_LOG_LEVEL=info
```

### Usage in Code
```typescript
import { logger } from '@/lib/logger';

logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');
```

## Security Considerations

- API keys stored in environment variables
- Server-side API calls to AnythingLLM and OpenAI
- No direct client-side API key exposure
- File upload validation and processing
- Admin-only system configuration controls
- Centralized logging for security monitoring

## Extending the Platform

### Adding New Question Types
1. Update `questions.json` configuration
2. Add new category in admin panel
3. Create custom prompt templates

## Extending the Platform

### Adding New Analysis Modules
1. Create new API route in `src/app/api/`
2. Add corresponding React component
3. Update system configuration for admin control
4. Add to template configuration files

### Custom Financial Analysis
1. Extend `src/lib/financePromptGenerator.ts` for new prompts
2. Add new financial data extraction patterns
3. Update OpenAI integration for specialized models

### Enhanced Configuration Management
1. Add new template files in `src/config/template_*.json`
2. Update `scripts/init-config.js` for new config types
3. Create admin UI components for configuration

### Additional AI Integrations
1. Extend the logger system for new integrations
2. Add new API clients following the AnythingLLM pattern
3. Update environment configuration templates

## Troubleshooting

### AnythingLLM Connection Issues
- Verify AnythingLLM is running on correct port
- Check API key validity
- Ensure network connectivity

## Troubleshooting

### AnythingLLM Connection Issues
- Verify AnythingLLM is running on correct port
- Check API key validity in `.env.local`
- Ensure network connectivity

### OpenAI Integration Issues
- Verify `OPENAI_API_KEY` is set correctly
- Check API quota and billing status
- Confirm model availability (`gpt-4o-mini` recommended)

### Configuration Issues
- Run `npm run init-config` to reinitialize config files
- Check file permissions on `src/config/` directory
- Verify template files exist in version control

### Finance Module Not Available
- Check admin system configuration (`/admin`)
- Verify `financeEnabled` is set to `true` in system config
- Restart server after config changes

### Logging Issues
- Check `NEXT_PUBLIC_LOG_LEVEL` in `.env.local`
- Verify logger import in components: `import { logger } from '@/lib/logger'`
- Use `debug` level for detailed troubleshooting

### Build Issues
- Run `npm install` to update dependencies
- Check Node.js version compatibility (18+)
- Verify TypeScript configuration
- Clear `.next` cache: `rm -rf .next`

## License

This project is proprietary software for document analysis purposes.
