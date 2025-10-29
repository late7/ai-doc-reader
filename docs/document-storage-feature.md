# Document Storage and Download Feature

## Overview
Documents uploaded to AnythingLLM are now automatically saved to local storage and can be downloaded by users.

## Implementation Details

### File Storage
- **Location**: Files are stored in the `storage` folder at the project root
- **Organization**: Files are organized in subfolders by workspace name (slug)
- **Path Structure**: `storage/{workspace-slug}/{filename}`

### Upload Flow
1. User uploads a file through the DocumentUploader component
2. File is sent to AnythingLLM for processing
3. Simultaneously, file is saved to local storage in the appropriate workspace folder
4. If local storage fails, the upload continues (AnythingLLM upload takes priority)

### Download Flow
1. User clicks on a document filename in the document list (left panel)
2. Browser downloads the file from local storage
3. Original filename is preserved

### Delete Flow
1. User clicks the delete button on a document
2. Document is removed from AnythingLLM workspace
3. Corresponding file is also deleted from local storage
4. If local file deletion fails, the operation continues (AnythingLLM deletion takes priority)

## API Endpoints

### Upload Document
- **Endpoint**: `POST /api/upload`
- **Parameters**: 
  - `file`: File to upload
  - `workspaceSlug`: Workspace identifier
- **Actions**:
  - Uploads to AnythingLLM
  - Saves to `storage/{workspaceSlug}/{filename}`

### Download Document
- **Endpoint**: `GET /api/documents/download`
- **Parameters**:
  - `workspaceSlug`: Workspace identifier
  - `filename`: File to download (AnythingLLM format with UUID)
- **Processing**:
  1. Strips UUID suffix and .json extension from filename
  2. Searches storage directory for matching file
  3. Handles space-to-hyphen conversion (AnythingLLM replaces spaces with hyphens in filenames)
  4. Returns original file with original name
- **Security**: Path traversal protection using `path.basename()`
- **Returns**: File with appropriate content-type and download headers

### Delete Document
- **Endpoint**: `DELETE /api/documents/delete`
- **Parameters**:
  - `workspaceSlug`: Workspace identifier
  - `documentPath`: Document path in AnythingLLM
- **Actions**:
  - Removes from AnythingLLM
  - Searches for and deletes matching file from local storage
  - Handles space-to-hyphen conversion for filename matching

## Supported File Types
- PDF (`.pdf`)
- Word Documents (`.doc`, `.docx`)
- Text Files (`.txt`)
- Markdown (`.md`)
- Excel Files (`.xlsx`, `.xls`)

## UI Changes
- Document filenames in the left panel are now clickable links (blue color)
- Hover tooltip shows "Click to download: {filename}"
- Clicking a filename triggers immediate download

## Security Features
- Path traversal protection using `path.basename()` sanitization
- Only files from the specified workspace can be downloaded
- File existence verification before download

## Error Handling
- Local storage failures don't interrupt AnythingLLM operations
- Missing files return 404 with appropriate error message
- All errors are logged using the centralized logger

## Notes
- This feature only applies to documents uploaded to AnythingLLM
- OpenAI Assistant documents are handled separately and are not stored locally
- Storage folder must exist in project root (already created)

## Technical Details

### Filename Handling
AnythingLLM modifies filenames during upload:
- **Spaces → Hyphens**: Filenames with spaces get spaces replaced with hyphens
- **UUID Suffix**: Adds a UUID and `.json` extension (e.g., `-6d6395bc-9ee5-4a81-9505-2bc1a8667c7b.json`)

Our implementation handles this by:
1. **Upload**: Saves file with original name before AnythingLLM processing
2. **Download**: 
   - Strips UUID suffix and `.json` from AnythingLLM filename
   - Searches storage directory for file where spaces-to-hyphens matches
   - Returns file with original name preserved
3. **Delete**: Same matching logic to find and delete the correct local file

**Example:**
- Original file: `Company business plan 10_2025.docx.pdf`
- Saved locally as: `Company business plan 10_2025.docx.pdf`
- AnythingLLM name: `Company-business-plan-10_2025.docx.pdf-6d6395bc-9ee5-4a81-9505-2bc1a8667c7b.json`
- Downloaded as: `Company business plan 10_2025.docx.pdf`
