# Cleanup Script for Old UUID Files in Storage

This script helps clean up the old UUID-formatted files that were saved before the fix.

## Manual Cleanup

Navigate to your storage folder and remove files that have the UUID pattern:

```powershell
# Navigate to storage folder
cd [repo_path]/storage

# List all files with UUID pattern
Get-ChildItem -Recurse -File | Where-Object { $_.Name -match '-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.json$' }

# Delete them (review the list above first!)
Get-ChildItem -Recurse -File | Where-Object { $_.Name -match '-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.json$' } | Remove-Item
```

## What Changed

**Before Fix:**
- Files were saved as: `filename-uuid.json` (AnythingLLM format)
- Example: `Business-plan-10_2025.docx.pdf-6d6395bc-9ee5-4a81-9505-2bc1a8667c7b.json`

**After Fix:**
- Files are saved with original name: `filename.ext`
- Example: `Business-plan-10_2025.docx.pdf`
- Download extracts original name from AnythingLLM's UUID format
- Delete finds and removes original file by stripping UUID

## Testing

1. Upload a new document - it should save with original filename
2. Check storage folder - verify no UUID in filename
3. Click document name to download - should download with original name
4. Delete document - should remove file from storage folder
