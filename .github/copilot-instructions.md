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

---

## Web Testing with Chrome MCP

Use the **Chrome DevTools MCP** tools for all browser-based testing and verification of UI changes. The dev server runs at `http://localhost:3000`.

### When to Use Chrome MCP
- **After any UI/component change** — verify the rendered result visually
- **After API route changes** — test the endpoint via the browser UI or network panel
- **For debugging** — inspect console errors, network failures, and DOM state
- **For accessibility** — run Lighthouse audits on pages

### Testing Workflow

1. **Navigate** to the page under test:
   - Use `navigate_page` with `url: "http://localhost:3000/<route>"` to load a page
   - Use `new_page` to open a fresh tab if needed

2. **Inspect the page**:
   - Use `take_snapshot` (preferred) to get a text/a11y-tree representation of the page — this lists all elements with unique `uid` identifiers
   - Use `take_screenshot` for visual verification of layout, colors, and styling
   - Always use the **latest snapshot** — element `uid` values change between snapshots

3. **Interact with the UI**:
   - `click` — click buttons, links, tabs (use `uid` from snapshot)
   - `fill` — type into input fields or select from dropdowns
   - `fill_form` — fill multiple form fields at once
   - `press_key` — for keyboard shortcuts or Enter/Tab/Escape
   - `type_text` — type into a previously focused input
   - `upload_file` — test file upload inputs
   - `hover` — trigger hover states
   - `wait_for` — wait for specific text to appear after an action

4. **Check for errors**:
   - `list_console_messages` — check for JS errors, warnings, or log output
   - `get_console_message` — get details of a specific console message
   - `list_network_requests` — inspect API calls (filter by `fetch` or `xhr` resource type)
   - `get_network_request` — inspect request/response details of a specific call

5. **Run audits**:
   - `lighthouse_audit` — run accessibility, SEO, and best-practices audits
   - `performance_start_trace` / `performance_stop_trace` — profile page load performance

### Key Conventions
- **Prefer `take_snapshot` over `take_screenshot`** for understanding page structure and finding element UIDs
- **Use `take_screenshot`** when verifying visual styling (colors, layout, spacing)
- **Always re-snapshot after interactions** — UIDs are invalidated after page changes
- **Login first** if testing authenticated routes — navigate to `/login`, fill credentials, then proceed
- **Filter network requests** with `resourceTypes: ["fetch"]` to focus on API calls
- **Use `evaluate_script`** to run custom JS in the page for advanced inspection (e.g., reading localStorage, checking state)
