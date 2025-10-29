# VC Analysis Dashboard

A comprehensive Venture Capital analysis platform with AnythingLLM integration for AI-powered startup evaluation.

## Features

### Core Features
- **Workspace Management**: Connect to AnythingLLM workspaces for document analysis
- **Document Upload**: Upload pitch decks, business plans, and financial documents
- **AI-Powered Analysis**: Generate insights using customizable question templates
- **Company Summaries**: Automated investment opportunity summaries
- **Custom Questions**: Configurable analysis prompts for different evaluation criteria
- **PDF Export**: Generate comprehensive VC analysis reports

### Admin Features
- **Question Management**: Create, edit, and organize analysis questions
- **Prompt Configuration**: Customize AI prompts for different analysis types
- **Category Organization**: Group questions by analysis categories (Market, Financial, etc.)

## Architecture

- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **Backend**: Next.js API routes
- **AI Integration**: AnythingLLM REST API
- **Configuration**: JSON-based question and prompt management
- **Export**: Text-based report generation (extensible to PDF)

## Setup

### Prerequisites
- Node.js 18+ 
- AnythingLLM instance running on localhost:3001
- Valid AnythingLLM API key

### Environment Configuration

Create `.env.local` file with:
```
ANYTHINGLLM_KEY=your-api-key-here
ANYTHINGLLM_ENDPOINT=http://localhost:3001
```

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

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
2. **Select Workspace**: Choose an AnythingLLM workspace from the dropdown
3. **Upload Documents**: Drag and drop or select files for analysis
4. **Generate Summary**: Click "Generate Summary" for company overview
5. **Run Analysis**: Execute individual questions for detailed insights
6. **Add Notes**: Supplement AI analysis with additional observations
7. **Export Report**: Generate downloadable analysis report

### Admin Panel

1. **Access Admin**: Navigate to `/admin`
2. **Manage Questions**: Add, edit, or delete analysis questions
3. **Configure Prompts**: Customize global prompt templates
4. **Organize Categories**: Group questions by analysis type
5. **Save Changes**: Apply configuration updates

### Question Categories

- **Market**: TAM, competitive landscape, positioning
- **Business**: Revenue model, growth strategy, scalability
- **Team**: Founder experience, key personnel, expertise
- **Financial**: Projections, funding requirements, metrics
- **Risk**: Challenges, mitigation strategies, obstacles
- **Technology**: IP, tech stack, differentiation, barriers

## API Endpoints

- `GET /api/workspaces` - List AnythingLLM workspaces
- `POST /api/workspaces` - Create new workspace
- `POST /api/upload` - Upload documents to workspace
- `POST /api/analyze` - Run analysis questions
- `GET /api/questions` - Get question configuration
- `PUT /api/questions` - Update question configuration

## Configuration

Questions and prompts are stored in `src/config/questions.json`:

```json
{
  "questions": [
    {
      "id": "q1",
      "title": "Market Analysis",
      "prompt": "Analyze the market opportunity...",
      "category": "Market"
    }
  ],
  "prompts": {
    "companySummary": "Create summary of the investment opportunity...",
    "prefix": "Based on the documents provided, ",
    "suffix": " Please provide detailed analysis..."
  }
}
```

## Development

### Project Structure
```
src/
├── app/                 # Next.js App Router pages
│   ├── admin/          # Admin panel
│   ├── dashboard/      # Main dashboard
│   └── api/            # API routes
├── components/          # React components
├── config/             # Configuration files
└── lib/                # Utilities and integrations
```

### Key Components
- `WorkspaceSelector`: AnythingLLM workspace selection
- `DocumentUploader`: File upload interface
- `QuestionAnalyzer`: Analysis execution and results
- `AnythingLLMClient`: API integration client

## Security Considerations

- API keys stored in environment variables
- Server-side API calls to AnythingLLM
- No direct client-side API key exposure
- File upload validation and processing

## Extending the Platform

### Adding New Question Types
1. Update `questions.json` configuration
2. Add new category in admin panel
3. Create custom prompt templates

### Custom Analysis Workflows
1. Extend API routes for new endpoints
2. Add new components for UI interactions
3. Integrate additional AI processing

### Enhanced Reporting
1. Integrate PDF generation library (e.g., jsPDF)
2. Add custom report templates
3. Include charts and visualizations

## Troubleshooting

### AnythingLLM Connection Issues
- Verify AnythingLLM is running on correct port
- Check API key validity
- Ensure network connectivity

### Build Issues
- Run `npm install` to update dependencies
- Check Node.js version compatibility
- Verify TypeScript configuration

## License

This project is proprietary software for VC analysis purposes.
