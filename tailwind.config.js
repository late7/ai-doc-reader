/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "var(--primary)",
        "primary-hover": "var(--primary-hover)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '100%',
            color: '#1f2937',
            'h1, h2, h3, h4, h5, h6': {
              color: '#111827',
            },
            strong: {
              color: '#111827',
            },
            'li::marker': {
              color: '#4b5563',
            },
            'ol > li, ul > li': {
              color: '#1f2937',
            },
            blockquote: {
              color: '#374151',
            },
            a: {
              color: 'var(--primary)',
              '&:hover': {
                color: 'var(--primary-hover)',
              },
            },
            p: {
              marginTop: '1em',
              marginBottom: '1em',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
