'use client';

import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { logger } from '@/lib/logger';

interface Document {
  id: string | number;
  filename: string;
  docId?: string;
  docpath?: string;
  metadata?: string | Record<string, any>;
  pinned?: boolean;
  watched?: boolean;
  createdAt?: string;
  lastUpdatedAt?: string;
  workspaceId?: number;
}

interface DocumentUploaderProps {
  workspaceSlug: string;
  onUploadComplete: () => void;
}

export interface DocumentUploaderRef {
  refreshDocuments: () => Promise<void>;
}

const DocumentUploader = forwardRef<DocumentUploaderRef, DocumentUploaderProps>(
  ({ workspaceSlug, onUploadComplete }, ref) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Expose refresh function to parent component
  useImperativeHandle(ref, () => ({
    refreshDocuments: fetchDocuments
  }));

  useEffect(() => {
    if (workspaceSlug) {
      fetchDocuments();
    }
  }, [workspaceSlug]);

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      logger.debug(`Fetching documents for workspace: ${workspaceSlug}`);
      
      // Add cache-busting parameters and headers
      const timestamp = Date.now();
      const response = await fetch(`/api/workspace/${workspaceSlug}?_t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.error(`API Error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to fetch documents: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      logger.debug('Workspace API response:', JSON.stringify(data));
      
      // Handle different response structures
      let documentsList: Document[] = [];
      
      if (data.documents && Array.isArray(data.documents)) {
        documentsList = data.documents;
      } else if (data.workspace && Array.isArray(data.workspace) && data.workspace[0]?.documents) {
        documentsList = data.workspace[0].documents;
      } else {
        logger.warn('Unexpected document data format:', data);
        setError('Received data in an unexpected format');
      }
      
      logger.debug(`Found ${documentsList.length} documents`);
      setDocuments(documentsList);
    } catch (error) {
      logger.error('Error fetching documents:', error);
      setError(error instanceof Error ? error.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;

    setUploading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const uploadResults: any[] = [];
      
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('workspaceSlug', workspaceSlug);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to upload ${file.name}: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        uploadResults.push(result);
      }
      
      // Show success message
      if (uploadResults.length > 0) {
        logger.info('Upload successful:', uploadResults);
        setSuccessMessage(`Successfully uploaded ${uploadResults.length} file${uploadResults.length > 1 ? 's' : ''} and added to workspace`);
        // Auto-clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);
      }
      
      await fetchDocuments();
      onUploadComplete();
    } catch (error) {
      logger.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveDocument = async (document: Document) => {
    try {
      setError(null);
      setSuccessMessage(null);
      const info = getDocumentInfo(document);
      
      // Use the docpath from the document object, which contains the full path
      // like "workspace-slug/filename-uuid.json"
      const documentPath = document.docpath || `${workspaceSlug}/${document.filename}`;
      
      logger.debug('Removing document with path:', documentPath);

      const deleteParams = new URLSearchParams({
        workspaceSlug,
        documentPath,
      });
      if (document.docId) {
        deleteParams.set('docId', String(document.docId));
      }

      const response = await fetch(`/api/documents/delete?${deleteParams.toString()}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to remove document: ${response.status} ${response.statusText}`);
      }
      
      setSuccessMessage(`Successfully removed "${info.displayName}" from workspace`);
      // Auto-clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
      
      // Force a complete refresh of the document list
      // Small delay to ensure the deletion has propagated
      setTimeout(async () => {
        logger.debug('Force refreshing document list after deletion...');
        await fetchDocuments();
      }, 500);
      
      onUploadComplete();
    } catch (error) {
      logger.error('Error removing document:', error);
      setError(error instanceof Error ? error.message : 'Failed to remove document');
    }
  };

  const handleDownloadDocument = async (document: Document) => {
    try {
      const info = getDocumentInfo(document);
      const params = new URLSearchParams({
        workspaceSlug,
        filename: document.filename,
      });
      if (document.docId) {
        params.set('docId', String(document.docId));
      }
      const downloadUrl = `/api/documents/download?${params.toString()}`;
      
      // Create a temporary link and trigger download
      const link = window.document.createElement('a');
      link.href = downloadUrl;
      link.download = info.downloadName;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    } catch (error) {
      logger.error('Error downloading document:', error);
      setError(error instanceof Error ? error.message : 'Failed to download document');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  // Format date strings consistently
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown date';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (e) {
      return dateString;
    }
  };

  // Parse metadata to extract document information
  const getDocumentInfo = (doc: Document) => {
    let metadata: Record<string, any> | null = null;

    if (doc.metadata) {
      try {
        metadata = typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : doc.metadata;
      } catch (parseError) {
        logger.error('Failed to parse document metadata:', parseError);
      }
    }

    const uuidMatch = doc.filename?.match(/-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.json$/i);
    const documentUuid = (metadata?.id as string | undefined) || uuidMatch?.[1] || '';
    const filenameWithoutUuid = uuidMatch
      ? doc.filename.replace(new RegExp(`-${documentUuid}\\.json$`, 'i'), '')
      : doc.filename.replace(/\.json$/i, '');
    const displayName = (metadata?.title as string | undefined) || filenameWithoutUuid;
    const downloadName = displayName;

    return {
      filename: doc.filename,
      displayName,
      downloadName,
      title: displayName,
      size: metadata?.wordCount ? `${metadata.wordCount} words` : 'Unknown size',
      date: (metadata?.published as string | undefined) || doc.createdAt || '',
      wordCount: metadata?.wordCount || 0,
      metadata,
      uuid: documentUuid
    };
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
  <h2 className="text-xl font-semibold text-gray-800">Documents</h2>
        <div className="flex items-center space-x-3">
          {documents.length > 0 && (
            <span className="text-sm text-gray-500">{documents.length} files</span>
          )}
          <button
            onClick={fetchDocuments}
            disabled={loading}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
              loading 
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 hover:text-gray-800'
            }`}
            title="Refresh document list"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Refreshing...
              </span>
            ) : (
              <span className="flex items-center">
                🔄 Refresh
              </span>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
          <button 
            onClick={fetchDocuments}
            className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-600">{successMessage}</p>
        </div>
      )}

      {/* Document List Section - Moved to top */}
      {loading ? (
        <div className="space-y-4 mb-6">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-start p-5 bg-white border border-gray-200 rounded-lg">
              <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse mr-4"></div>
              <div className="flex-1">
                <div className="h-5 bg-gray-200 rounded animate-pulse mb-2 w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse mb-2 w-1/2"></div>
                <div className="flex gap-4">
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-20"></div>
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-24"></div>
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-16"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : documents.length > 0 ? (
        <div className="rounded-lg border border-gray-200 divide-y divide-gray-200 overflow-hidden mb-6 shadow-sm">
          {documents.map(doc => {
            const info = getDocumentInfo(doc);
            return (
              <div key={doc.id} className="p-4 bg-white hover:bg-gray-50 transition-colors">
                <div className="flex gap-3">
                  {/* Left Column: Icons */}
                  <div className="flex flex-col items-center gap-2 flex-shrink-0">
                    {/* Document Icon */}
                    <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                      <svg 
                        className="h-4 w-4 text-blue-600" 
                        fill="currentColor" 
                        viewBox="0 0 20 20"
                      >
                        <path 
                          fillRule="evenodd" 
                          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" 
                          clipRule="evenodd" 
                        />
                      </svg>
                    </div>
                    
                    {/* Delete Button */}
                    <button
                      onClick={() => handleRemoveDocument(doc)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Remove document"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Right Column: Document Info - Full Width */}
                  <div className="min-w-0 flex-1">
                    {/* Filename - Full width with tooltip - Clickable for download */}
                    <button
                      onClick={() => handleDownloadDocument(doc)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline truncate cursor-pointer text-left w-full mb-1" 
                      title={`Click to download: ${info.downloadName}`}
                    >
                      {info.displayName}
                    </button>
                    
                    {/* File details - Simple, clean layout */}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{info.size}</span>
                      {info.date && <span>{formatDate(info.date)}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200 mb-6">
          <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No documents uploaded yet</h3>
          <p className="text-sm text-gray-500">Upload files below to analyze and interact with your documents</p>
        </div>
      )}

      {/* Upload Box Section - Moved to bottom */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 bg-white'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {uploading ? (
          <div className="py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-600">Uploading documents...</p>
          </div>
        ) : (
          <>
            <svg 
              className="mx-auto h-12 w-12 text-gray-400 mb-3" 
              stroke="currentColor" 
              fill="none" 
              viewBox="0 0 48 48" 
              aria-hidden="true"
            >
              <path 
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            </svg>
            <p className="text-gray-600 mb-2">
              <span className="font-medium">Drag and drop files</span> or click to upload
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Support for PDF, DOC, DOCX, TXT, and MD files
            </p>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.md"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium cursor-pointer hover:bg-blue-600 transition-colors inline-block"
            >
              Select Files
            </label>
          </>
        )}
      </div>
    </div>
  );
});

DocumentUploader.displayName = 'DocumentUploader';

export default DocumentUploader;
