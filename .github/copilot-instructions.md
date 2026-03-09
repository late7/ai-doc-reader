# Copilot Instructions for ai-doc-reader

## UI / Styling Guidelines

### Text Color — Always Use Darker Greys
All text in the UI must be clearly readable. **Never use light grey text colors** such as `text-gray-400` or `text-gray-500` for any visible content.

**Required minimum text colors:**
- **Body text, descriptions, labels:** `text-gray-700` or darker
- **Headings, titles, strong text:** `text-gray-800` or `text-gray-900`
- **Secondary/meta info (timestamps, source labels):** `text-gray-600` minimum
- **Placeholder text:** `text-gray-500` minimum (via `placeholder:text-gray-500`)
- **Disabled button text:** `text-gray-500` minimum (never `text-gray-400`)
- **Tiny/footnote text (`text-[10px]`, `text-xs`):** `text-gray-600` minimum — small text needs stronger contrast

**Tailwind Typography (`prose`) blocks:**
- Always add `prose-headings:text-gray-900 prose-p:text-gray-800 prose-li:text-gray-800 prose-strong:text-gray-900`
- Use `prose-gray` variant for base color

**Do NOT use:**
- `text-gray-300` or `text-gray-400` for any readable text (only for decorative borders/dividers)
- Default `prose` without explicit dark color overrides

### General Component Patterns
- This project uses Next.js App Router with Tailwind CSS
- Components are in `src/components/`, pages in `src/app/`
- API routes follow `src/app/api/{feature}/{endpoint}/route.ts` pattern
- Storage is file-system based under `storage/{workspaceSlug}/processed/`
- OpenAI is used for document analysis; responses use JSON format
- Config/prompts are stored as JSON in `src/config/`
