#!/usr/bin/env node

// Simple script to initialize config files from templates
const fs = require('fs');
const path = require('path');

const configDir = path.join(__dirname, '..', 'src', 'config');

console.log('Initializing config files...');

try {
  // Check if config directory exists
  if (!fs.existsSync(configDir)) {
    console.warn('Config directory does not exist:', configDir);
    process.exit(0);
  }

  // Read all files in the config directory
  const files = fs.readdirSync(configDir);

  // Find all template files
  const templateFiles = files.filter(file => file.startsWith('template_') && file.endsWith('.json'));

  console.log(`Found ${templateFiles.length} template configuration files`);

  // Process each template file
  for (const templateFile of templateFiles) {
    const templatePath = path.join(configDir, templateFile);

    // Extract the base name (remove 'template_' prefix)
    const baseName = templateFile.replace(/^template_/, '');
    const targetPath = path.join(configDir, baseName);

    // Check if the target config file already exists
    if (!fs.existsSync(targetPath)) {
      try {
        // Copy template to create the config file
        const templateContent = fs.readFileSync(templatePath, 'utf-8');
        fs.writeFileSync(targetPath, templateContent, 'utf-8');

        console.log(`✓ Created config file from template: ${baseName}`);
      } catch (error) {
        console.error(`✗ Failed to create config file ${baseName} from template:`, error.message);
      }
    } else {
      console.log(`- Config file ${baseName} already exists, skipping`);
    }
  }

  console.log('Configuration initialization completed');
} catch (error) {
  console.error('Error during configuration initialization:', error.message);
  process.exit(1);
}