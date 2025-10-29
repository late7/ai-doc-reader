import { logger } from './logger';

const ANYTHINGLLM_ENDPOINT = process.env.ANYTHINGLLM_ENDPOINT || 'http://localhost:3001';
const ANYTHINGLLM_KEY = process.env.ANYTHINGLLM_KEY || '2NN1DX8-HPBMTCK-NF05NYM-YRPTWGM';

// Check for mock data flag in environment variable or localStorage
let useMockData = process.env.USE_MOCK_DATA === 'true';

// For client-side, also check localStorage
if (typeof window !== 'undefined' && window.localStorage) {
  const mockDataSetting = localStorage.getItem('USE_MOCK_DATA');
  if (mockDataSetting === 'true') {
    useMockData = true;
  }
}

const USE_MOCK_DATA = useMockData;

// Mock data format updated to match the real API response
const MOCK_WORKSPACES = [
  { 
    id: 1, 
    name: 'FinTech Startup', 
    slug: 'fintech-startup',
    vectorTag: null,
    createdAt: '2025-08-20T12:00:00Z',
    openAiTemp: 0.2,
    openAiHistory: 20,
    lastUpdatedAt: '2025-08-20T12:00:00Z',
    openAiPrompt: null,
    similarityThreshold: 0.25,
    chatProvider: null,
    chatModel: null,
    topN: 4,
    chatMode: 'chat',
    pfpFilename: null,
    agentProvider: null,
    agentModel: null,
    queryRefusalResponse: null,
    vectorSearchMode: 'default',
    threads: []
  },
  { 
    id: 2, 
    name: 'AI Healthcare', 
    slug: 'ai-healthcare',
    vectorTag: null,
    createdAt: '2025-08-19T16:45:00Z',
    openAiTemp: 0.2,
    openAiHistory: 20,
    lastUpdatedAt: '2025-08-19T16:45:00Z',
    openAiPrompt: null,
    similarityThreshold: 0.25,
    chatProvider: null,
    chatModel: null,
    topN: 4,
    chatMode: 'chat',
    pfpFilename: null,
    agentProvider: null,
    agentModel: null,
    queryRefusalResponse: null,
    vectorSearchMode: 'default',
    threads: []
  },
  { 
    id: 3, 
    name: 'SaaS Platform', 
    slug: 'saas-platform',
    vectorTag: null,
    createdAt: '2025-08-21T11:20:00Z',
    openAiTemp: 0.2,
    openAiHistory: 20,
    lastUpdatedAt: '2025-08-21T11:20:00Z',
    openAiPrompt: null,
    similarityThreshold: 0.25,
    chatProvider: null,
    chatModel: null,
    topN: 4,
    chatMode: 'chat',
    pfpFilename: null,
    agentProvider: null,
    agentModel: null,
    queryRefusalResponse: null,
    vectorSearchMode: 'default',
    threads: []
  }
];

const MOCK_DOCUMENTS = {
  'fintech-startup': [
    { id: '1', name: 'Pitch Deck.pdf', size: '2.3 MB', uploadedAt: '2025-08-20T12:00:00Z' },
    { id: '2', name: 'Financial Projections.xlsx', size: '1.8 MB', uploadedAt: '2025-08-21T14:30:00Z' },
    { id: '3', name: 'Market Analysis.docx', size: '900 KB', uploadedAt: '2025-08-22T09:15:00Z' }
  ],
  'ai-healthcare': [
    { id: '4', name: 'Business Plan.pdf', size: '3.2 MB', uploadedAt: '2025-08-19T16:45:00Z' },
    { id: '5', name: 'Technology Overview.pdf', size: '1.5 MB', uploadedAt: '2025-08-20T10:30:00Z' }
  ],
  'saas-platform': [
    { id: '6', name: 'Product Roadmap.pdf', size: '1.2 MB', uploadedAt: '2025-08-21T11:20:00Z' },
    { id: '7', name: 'Competitor Analysis.pptx', size: '4.7 MB', uploadedAt: '2025-08-22T13:10:00Z' },
    { id: '8', name: 'Team Bios.pdf', size: '800 KB', uploadedAt: '2025-08-23T15:45:00Z' }
  ]
};

export class AnythingLLMClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = ANYTHINGLLM_ENDPOINT;
    this.apiKey = ANYTHINGLLM_KEY;
    
    // Log configuration on startup for debugging
    if (typeof window !== 'undefined') {
      // console.log('AnythingLLM Client Configuration:', {
      //   baseUrl: this.baseUrl,
      //   apiKeyConfigured: !!this.apiKey,
      //   useMockData: USE_MOCK_DATA
      // });
      
      // Check server availability
      this.checkServerAvailability();
    }
  }
  
  // Helper method to check if the AnythingLLM server is available
  async checkServerAvailability() {
    if (USE_MOCK_DATA) return;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseUrl}/api/v1/healthz`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        logger.debug('AnythingLLM server is available!');
      } else {
        logger.warn('AnythingLLM server returned non-OK status:', response.status);
      }
    } catch (error) {
      logger.error('AnythingLLM server check failed:', error);
      logger.warn('Consider using mock data for development by setting USE_MOCK_DATA=true');
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    if (USE_MOCK_DATA) {
      return this.getMockResponse(endpoint, options);
    }
    
    const url = `${this.baseUrl}${endpoint}`;
    
    // Start with basic headers
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    // Only add Content-Type for non-FormData requests
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    // Add API key if available
    if (this.apiKey && this.apiKey !== '') {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    logger.debug('Making request to:', url);
    logger.debug('Headers:', headers);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('AnythingLLM API error:', { 
          status: response.status, 
          statusText: response.statusText, 
          error: errorText,
          url 
        });
        throw new Error(`AnythingLLM API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return response.json();
    } catch (error) {
      logger.error('Network error when connecting to AnythingLLM:', error);
      throw new Error(`Failed to connect to AnythingLLM at ${url}. Please ensure the server is running and accessible.`);
    }
  }

  private getMockResponse(endpoint: string, options: RequestInit = {}) {
    logger.debug('Using mock data for endpoint:', endpoint);
    
    // GET /api/v1/workspaces
    if (endpoint === '/api/v1/workspaces' && options.method === undefined) {
      return Promise.resolve({ workspaces: MOCK_WORKSPACES });
    }
    
    // POST /api/v1/workspaces (create workspace)
    if (endpoint === '/api/v1/workspaces' && options.method === 'POST') {
      const body = JSON.parse(options.body as string);
      const newWorkspace = { 
        id: Math.random().toString(36).substring(7), 
        name: body.name, 
        slug: body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') 
      };
      return Promise.resolve({ workspace: newWorkspace });
    }
    
    // POST /api/v1/document/upload
    if (endpoint === '/api/v1/document/upload' && options.method === 'POST') {
      const formData = options.body as FormData;
      const file = formData.get('file') as File;
      const mockDoc = {
        location: `custom-documents/${file.name}-${Math.random().toString(36).substring(7)}.json`,
        name: `${file.name}-${Math.random().toString(36).substring(7)}.json`,
        url: `file://mock/path/${file.name}`,
        title: file.name,
        docAuthor: "Unknown",
        description: "Unknown",
        docSource: "a file uploaded by the user.",
        chunkSource: file.name,
        published: new Date().toISOString(),
        wordCount: Math.floor(Math.random() * 1000) + 100,
        token_count_estimate: Math.floor(Math.random() * 1200) + 120
      };
      return Promise.resolve({ 
        success: true, 
        error: null, 
        documents: [mockDoc] 
      });
    }
    
    // POST /api/v1/document/create-folder
    if (endpoint === '/api/v1/document/create-folder' && options.method === 'POST') {
      return Promise.resolve({ success: true, message: null });
    }
    
    // POST /api/v1/document/move-files
    if (endpoint === '/api/v1/document/move-files' && options.method === 'POST') {
      return Promise.resolve({ success: true, message: null });
    }
    
    // POST /api/v1/workspace/{slug}/update-embeddings
    if (endpoint.match(/\/api\/v1\/workspace\/[^\/]+\/update-embeddings$/) && options.method === 'POST') {
      const slug = endpoint.split('/')[4];
      const mockWorkspace = MOCK_WORKSPACES.find(w => w.slug === slug) || MOCK_WORKSPACES[0];
      return Promise.resolve({
        workspace: mockWorkspace,
        message: null
      });
    }
    
    // GET /api/v1/workspace/{slug}
    if (endpoint.match(/\/api\/v1\/workspace\/[^\/]+$/) && options.method === undefined) {
      const slug = endpoint.split('/').pop();
      logger.debug('Using mock data for workspace:', slug);
      const mockWorkspace = MOCK_WORKSPACES.find(w => w.slug === slug) || {
        id: Math.random().toString(36).substring(7),
        name: slug?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        slug: slug,
        documents: []
      };
      
      // Attach mock documents to the workspace
      const mockDocuments = MOCK_DOCUMENTS[slug as keyof typeof MOCK_DOCUMENTS] || [];
      const mockWorkspaceWithDocuments = {
        ...mockWorkspace,
        documents: mockDocuments.map(doc => ({
          id: doc.id,
          filename: doc.name,
          docId: `mock-${doc.id}`,
          docpath: `${slug}/${doc.name}-${Math.random().toString(36).substring(7)}.json`,
          metadata: JSON.stringify({
            title: doc.name,
            wordCount: parseInt(doc.size),
            published: doc.uploadedAt
          }),
          createdAt: doc.uploadedAt
        }))
      };
      
      return Promise.resolve({ 
        workspace: [mockWorkspaceWithDocuments]
      });
    }
    
    // GET /api/v1/workspace/{slug}/documents
    if (endpoint.match(/\/api\/v1\/workspace\/[^\/]+\/documents$/) && options.method === undefined) {
      const slug = endpoint.split('/')[4];
      return Promise.resolve({ 
        documents: MOCK_DOCUMENTS[slug as keyof typeof MOCK_DOCUMENTS] || [] 
      });
    }
    
    // POST /api/v1/workspace/{slug}/chat (sendMessage)
    if (endpoint.match(/\/api\/v1\/workspace\/[^\/]+\/chat$/) && options.method === 'POST') {
      const body = JSON.parse(options.body as string);
      
      let response = "Based on the documents provided, this appears to be a promising investment opportunity. ";
      
      if (body.message.includes('market')) {
        response += "The market size is estimated at $4.5 billion with a projected CAGR of 22% over the next 5 years. The company is targeting a niche segment with limited competition and high barriers to entry.";
      } else if (body.message.includes('team')) {
        response += "The founding team has extensive experience in the industry, with the CEO previously leading a successful exit of a similar company. The CTO brings 15+ years of technical expertise, and they've assembled a strong advisory board with relevant connections.";
      } else if (body.message.includes('financial')) {
        response += "Financial projections show breakeven in 18 months with a potential 5x return within 3 years. Current burn rate is sustainable with the requested funding round extending runway by 24 months.";
      } else if (body.message.includes('risk')) {
        response += "Key risks include regulatory changes in European markets, potential competition from incumbents, and execution challenges with the go-to-market strategy. However, the team has outlined mitigation strategies for each.";
      } else {
        response += "The company has developed a proprietary technology that offers significant advantages over existing solutions, with a scalable business model and clear path to profitability. Their competitive positioning is strong with 3 issued patents and 2 pending.";
      }
      
      return Promise.resolve({ 
        response,
        textResponse: response,
        sources: [
          { document: "Pitch Deck.pdf", text: "Section on market analysis, page 12" },
          { document: "Financial Projections.xlsx", text: "Revenue forecast, tab 3" }
        ]
      });
    }

    // Default fallback
    return Promise.resolve({ message: "Mock data not implemented for this endpoint" });
  }

  async getWorkspaces() {
    logger.debug('AnythingLLM client: Fetching workspaces');
    const result = await this.makeRequest('/api/v1/workspaces');
    // console.log('AnythingLLM client: Workspaces result:', result);
    // Make sure we return in the format expected by our components
    return { workspaces: result.workspaces || result || [] };
  }

  async createWorkspace(name: string) {
    const workspaceData = {
      name,
      similarityThreshold: 0.2,
      openAiTemp: 0.2,
      openAiHistory: 1,
      openAiPrompt: "You are acting as a venture capital analyst evaluating a startup. Always base your answers only on the information provided in the workspace documents. If information is missing, state this clearly and list assumptions you must make. Do not invent facts.",
      queryRefusalResponse: "There is no relevant information in documents to answer your question.",
      chatMode: "query",
      topN: 4
    };
    
    return this.makeRequest('/api/v1/workspace/new', {
      method: 'POST',
      body: JSON.stringify(workspaceData),
    });
  }

  async uploadDocument(workspaceSlug: string, file: File) {
    try {
      // Check if file already exists in the workspace
      const existingDocuments = await this.getWorkspaceDetails(workspaceSlug);
      const fileExists = existingDocuments.workspace?.[0]?.documents?.some((doc: any) => 
        doc.filename === file.name || doc.title === file.name
      );
      
      if (fileExists) {
        throw new Error(`File with name "${file.name}" already exists in workspace`);
      }
      
      // Step 1: Upload document without adding to workspace
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadResult = await this.makeRequest('/api/v1/document/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadResult.success || !uploadResult.documents || uploadResult.documents.length === 0) {
        throw new Error('Document upload failed');
      }
      
      const uploadedDoc = uploadResult.documents[0];
      
      // Step 2: Extract the document path from location
      // Location format: "C:\\Users\\...\\custom-documents\\filename-uuid.json"
      // We need: "custom-documents/filename-uuid.json"
      const locationParts = uploadedDoc.location.split('custom-documents');
      if (locationParts.length < 2) {
        throw new Error('Unable to extract document path from location');
      }
      
      // Clean up the path (remove leading backslash/slash and convert backslashes to forward slashes)
      const documentPath = 'custom-documents' + '/' + locationParts[1].replace(/\\/g, '/').replace(/^\//, '');
      
      logger.debug('Document uploaded, path:', documentPath);
      
      // Step 3: Add document to workspace embeddings and capture resulting workspace document
      const updateResult = await this.updateWorkspaceEmbeddings(workspaceSlug, [documentPath], []);

      const workspaceDocuments: any[] = Array.isArray(updateResult?.workspace?.documents)
        ? updateResult.workspace.documents
        : [];

      const workspaceDoc = workspaceDocuments.find((doc: any) => {
        const docPathMatches = typeof doc?.docpath === 'string' && doc.docpath.replace(/\\/g, '/') === documentPath;
        const docIdMatches = doc?.docId && doc.docId === uploadedDoc?.docId;
        const metadataMatches = (() => {
          try {
            const docMetadata = typeof doc?.metadata === 'string' ? JSON.parse(doc.metadata) : doc?.metadata;
            const uploadedMetadata = typeof uploadedDoc?.metadata === 'string' ? JSON.parse(uploadedDoc.metadata) : uploadedDoc?.metadata;
            return docMetadata?.id && uploadedMetadata?.id && docMetadata.id === uploadedMetadata.id;
          } catch {
            return false;
          }
        })();
        return docPathMatches || docIdMatches || metadataMatches;
      }) || null;
      
      return {
        success: true,
        document: uploadedDoc,
        workspaceDoc,
        workspace: updateResult?.workspace ?? null,
        message: 'Document uploaded and added to workspace successfully'
      };
    } catch (error) {
      logger.error('Error in uploadDocument:', error);
      throw error;
    }
  }

  async removeDocument(workspaceSlug: string, documentPath: string) {
    try {
      logger.debug('AnythingLLM removeDocument called:', { workspaceSlug, documentPath });
      
      // Remove document from workspace embeddings
      const result = await this.updateWorkspaceEmbeddings(workspaceSlug, [], [documentPath]);
      
      logger.debug('AnythingLLM removeDocument result:', result);
      
      return {
        success: true,
        message: 'Document removed from workspace successfully'
      };
    } catch (error) {
      logger.error('Error in removeDocument:', error);
      throw error;
    }
  }

  // Helper method to create workspace folder
  async createWorkspaceFolder(workspaceSlug: string) {
    try {
      await this.makeRequest('/api/v1/document/create-folder', {
        method: 'POST',
        body: JSON.stringify({ name: workspaceSlug }),
      });
    } catch (error) {
      // Folder might already exist, which is fine
      logger.debug(`Workspace folder ${workspaceSlug} creation result:`, error);
    }
  }

  // Helper method to move document to workspace folder
  async moveDocumentToWorkspace(documentLocation: string, workspaceSlug: string) {
    const filename = documentLocation.split('/').pop();
    const destinationPath = `${workspaceSlug}/${filename}`;
    
    await this.makeRequest('/api/v1/document/move-files', {
      method: 'POST',
      body: JSON.stringify({
        files: [
          {
            from: documentLocation,
            to: destinationPath
          }
        ]
      }),
    });
    
    // Return the destination path for use in embeddings update
    return destinationPath;
  }

  // Helper method to update workspace embeddings
  async updateWorkspaceEmbeddings(workspaceSlug: string, adds: string[] = [], deletes: string[] = []) {
    logger.debug('updateWorkspaceEmbeddings called:', { workspaceSlug, adds, deletes });
    
    const endpoint = `/api/v1/workspace/${workspaceSlug}/update-embeddings`;
    const requestBody = { adds, deletes };
    
    logger.debug('Making update-embeddings request to:', `${this.baseUrl}${endpoint}`);
    logger.debug('Request body:', JSON.stringify(requestBody, null, 2));
    logger.debug('Using mock data:', USE_MOCK_DATA);
    
    try {
      const result = await this.makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      
      logger.info('updateWorkspaceEmbeddings success result:', result);
      logger.debug('updateWorkspaceEmbeddings success result docs:', JSON.stringify(result.workspace.documents, null, 2));
      return result;
    } catch (error) {
      logger.error('updateWorkspaceEmbeddings error:', error);
      throw error;
      }
  }

  async sendMessage(workspaceSlug: string, message: string) {
    logger.debug('AnythingLLM sendMessage called:', { workspaceSlug, message });
    const result = await this.makeRequest(`/api/v1/workspace/${workspaceSlug}/chat`, {
      method: 'POST',
      body: JSON.stringify({ 
        message,
        mode: 'query'
      }),
    });
    logger.debug('AnythingLLM sendMessage result:', result);
    return result;
  }

  async getWorkspaceDocuments(workspaceSlug: string) {
    return this.makeRequest(`/api/v1/workspace/${workspaceSlug}/documents`);
  }
  
  async getWorkspaceDetails(workspaceSlug: string) {
    logger.debug(`Fetching workspace details for: ${workspaceSlug}`);
    const result = await this.makeRequest(`/api/v1/workspace/${workspaceSlug}`);
    logger.debug('Workspace API response structure:', {
      hasWorkspaceArray: Array.isArray(result.workspace),
      workspaceArrayLength: Array.isArray(result.workspace) ? result.workspace.length : 0,
      hasDocuments: result.workspace?.[0]?.documents !== undefined,
      documentsArrayLength: Array.isArray(result.workspace?.[0]?.documents) ? result.workspace[0].documents.length : 0
    });
    return result;
  }
}

export const anythingLLM = new AnythingLLMClient();
