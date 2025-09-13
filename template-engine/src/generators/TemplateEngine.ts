import Handlebars from 'handlebars';
import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';

export interface TemplateConfig {
  name: string;
  description: string;
  category: string;
  type: string;
  tags: string[];
  tech_stack: string[];
  features: string[];
  requirements: Record<string, string>;
  structure: Record<string, any>;
  files: Record<string, {
    template: string;
    variables?: string[];
  }>;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies?: Record<string, string>;
  deployment: {
    build_command: string;
    output_directory?: string;
    start_command?: string;
    node_version: string;
    environment_variables: Record<string, string>;
    providers: Record<string, any>;
  };
  customization?: Record<string, {
    type: string;
    options: string[];
    default: string;
  }>;
  post_generation: string[];
}

export interface GenerationContext {
  project_name: string;
  description: string;
  author: string;
  template: string;
  customizations: Record<string, any>;
  destination: string;
}

export class TemplateEngine {
  private templatesPath: string;
  private templates: Map<string, TemplateConfig> = new Map();
  
  constructor(templatesPath: string) {
    this.templatesPath = templatesPath;
    this.registerHelpers();
  }

  async initialize(): Promise<void> {
    await this.loadTemplates();
  }

  private async loadTemplates(): Promise<void> {
    const templateDirs = await glob('**/template.json', {
      cwd: this.templatesPath,
      absolute: false
    });

    for (const templateFile of templateDirs) {
      try {
        const configPath = path.join(this.templatesPath, templateFile);
        const configContent = await fs.readFile(configPath, 'utf-8');
        const config: TemplateConfig = JSON.parse(configContent);
        
        const templateKey = path.dirname(templateFile);
        this.templates.set(templateKey, config);
        
        console.log(`Loaded template: ${templateKey} - ${config.name}`);
      } catch (error) {
        console.error(`Failed to load template ${templateFile}:`, error);
      }
    }
  }

  private registerHelpers(): void {
    // Register Handlebars helpers
    Handlebars.registerHelper('toLowerCase', (str: string) => str.toLowerCase());
    Handlebars.registerHelper('toUpperCase', (str: string) => str.toUpperCase());
    Handlebars.registerHelper('toCamelCase', (str: string) => {
      return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
    });
    Handlebars.registerHelper('toPascalCase', (str: string) => {
      const camelCase = str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
      return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
    });
    Handlebars.registerHelper('toKebabCase', (str: string) => {
      return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    });
    Handlebars.registerHelper('toSnakeCase', (str: string) => {
      return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    });
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
    Handlebars.registerHelper('includes', (array: any[], item: any) => array.includes(item));
    Handlebars.registerHelper('json', (obj: any) => JSON.stringify(obj, null, 2));
    Handlebars.registerHelper('currentYear', () => new Date().getFullYear());
    Handlebars.registerHelper('currentDate', () => new Date().toISOString().split('T')[0]);
  }

  getTemplates(): Array<{ key: string; config: TemplateConfig }> {
    return Array.from(this.templates.entries()).map(([key, config]) => ({
      key,
      config
    }));
  }

  getTemplate(templateKey: string): TemplateConfig | undefined {
    return this.templates.get(templateKey);
  }

  getTemplatesByCategory(category: string): Array<{ key: string; config: TemplateConfig }> {
    return this.getTemplates().filter(({ config }) => config.category === category);
  }

  getTemplatesByTag(tag: string): Array<{ key: string; config: TemplateConfig }> {
    return this.getTemplates().filter(({ config }) => config.tags.includes(tag));
  }

  async generateProject(templateKey: string, context: GenerationContext): Promise<void> {
    const template = this.templates.get(templateKey);
    if (!template) {
      throw new Error(`Template not found: ${templateKey}`);
    }

    console.log(`Generating project from template: ${template.name}`);
    
    // Create project directory structure
    await this.createDirectoryStructure(template.structure, context.destination);
    
    // Generate files from templates
    await this.generateFiles(templateKey, template, context);
    
    // Apply customizations
    await this.applyCustomizations(template, context);
    
    // Run post-generation scripts
    await this.runPostGenerationScripts(template, context);
    
    console.log(`Project generated successfully at: ${context.destination}`);
  }

  private async createDirectoryStructure(
    structure: Record<string, any>, 
    basePath: string, 
    currentPath = ''
  ): Promise<void> {
    for (const [name, content] of Object.entries(structure)) {
      const fullPath = path.join(basePath, currentPath, name);
      
      if (typeof content === 'object' && content !== null) {
        // It's a directory
        await fs.mkdir(fullPath, { recursive: true });
        await this.createDirectoryStructure(content, basePath, path.join(currentPath, name));
      } else {
        // It's a file (empty content)
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
      }
    }
  }

  private async generateFiles(
    templateKey: string, 
    template: TemplateConfig, 
    context: GenerationContext
  ): Promise<void> {
    const templateDir = path.join(this.templatesPath, templateKey);
    
    for (const [filePath, fileConfig] of Object.entries(template.files)) {
      const templateFile = path.join(templateDir, fileConfig.template);
      const outputFile = path.join(context.destination, filePath);
      
      try {
        // Read template file
        const templateContent = await fs.readFile(templateFile, 'utf-8');
        
        // Compile template
        const compiledTemplate = Handlebars.compile(templateContent);
        
        // Prepare template variables
        const templateVars = {
          ...context,
          ...context.customizations,
          features: template.features,
          tech_stack: template.tech_stack,
          scripts: template.scripts,
          dependencies: template.dependencies,
          devDependencies: template.devDependencies || {}
        };
        
        // Generate content
        const generatedContent = compiledTemplate(templateVars);
        
        // Ensure output directory exists
        await fs.mkdir(path.dirname(outputFile), { recursive: true });
        
        // Write generated file
        await fs.writeFile(outputFile, generatedContent, 'utf-8');
        
        console.log(`Generated: ${filePath}`);
      } catch (error) {
        console.error(`Failed to generate file ${filePath}:`, error);
        throw error;
      }
    }
  }

  private async applyCustomizations(
    template: TemplateConfig, 
    context: GenerationContext
  ): Promise<void> {
    if (!template.customization) return;
    
    for (const [key, customization] of Object.entries(template.customization)) {
      const value = context.customizations[key];
      
      if (value && value !== customization.default) {
        await this.applyCustomization(key, value, context.destination);
      }
    }
  }

  private async applyCustomization(
    key: string, 
    value: any, 
    projectPath: string
  ): Promise<void> {
    // Apply specific customizations based on the key
    switch (key) {
      case 'ui_library':
        await this.addUILibrary(value, projectPath);
        break;
      case 'state_management':
        await this.addStateManagement(value, projectPath);
        break;
      case 'testing':
        await this.addTestingFramework(value, projectPath);
        break;
      case 'auth':
        await this.addAuthProvider(value, projectPath);
        break;
      case 'database':
        await this.configureDatabase(value, projectPath);
        break;
      case 'orm':
        await this.configureORM(value, projectPath);
        break;
      default:
        console.log(`Unknown customization: ${key}`);
    }
  }

  private async addUILibrary(library: string, projectPath: string): Promise<void> {
    // Add UI library specific configurations and dependencies
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    
    const uiDependencies: Record<string, Record<string, string>> = {
      'mui': {
        '@mui/material': '^5.12.0',
        '@emotion/react': '^11.10.8',
        '@emotion/styled': '^11.10.8'
      },
      'chakra': {
        '@chakra-ui/react': '^2.5.5',
        '@emotion/react': '^11.10.8',
        '@emotion/styled': '^11.10.8',
        'framer-motion': '^10.12.4'
      },
      'antd': {
        'antd': '^5.4.0'
      },
      'mantine': {
        '@mantine/core': '^6.0.8',
        '@mantine/hooks': '^6.0.8'
      }
    };
    
    if (uiDependencies[library]) {
      packageJson.dependencies = {
        ...packageJson.dependencies,
        ...uiDependencies[library]
      };
      
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
      console.log(`Added ${library} UI library`);
    }
  }

  private async addStateManagement(stateLib: string, projectPath: string): Promise<void> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    
    const stateDependencies: Record<string, Record<string, string>> = {
      'redux': {
        '@reduxjs/toolkit': '^1.9.3',
        'react-redux': '^8.0.5'
      },
      'zustand': {
        'zustand': '^4.3.7'
      },
      'jotai': {
        'jotai': '^2.0.3'
      },
      'recoil': {
        'recoil': '^0.7.7'
      }
    };
    
    if (stateDependencies[stateLib]) {
      packageJson.dependencies = {
        ...packageJson.dependencies,
        ...stateDependencies[stateLib]
      };
      
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
      console.log(`Added ${stateLib} state management`);
    }
  }

  private async addTestingFramework(testing: string[], projectPath: string): Promise<void> {
    // Add testing framework configurations
    console.log(`Configuring testing with: ${testing.join(', ')}`);
  }

  private async addAuthProvider(auth: string, projectPath: string): Promise<void> {
    // Add authentication provider configuration
    console.log(`Configuring authentication with: ${auth}`);
  }

  private async configureDatabase(database: string, projectPath: string): Promise<void> {
    // Configure database specific settings
    console.log(`Configuring database: ${database}`);
  }

  private async configureORM(orm: string, projectPath: string): Promise<void> {
    // Configure ORM specific settings
    console.log(`Configuring ORM: ${orm}`);
  }

  private async runPostGenerationScripts(
    template: TemplateConfig, 
    context: GenerationContext
  ): Promise<void> {
    const { spawn } = await import('child_process');
    
    for (const script of template.post_generation) {
      console.log(`Running: ${script}`);
      
      try {
        await new Promise<void>((resolve, reject) => {
          const child = spawn(script, [], {
            cwd: context.destination,
            shell: true,
            stdio: 'inherit'
          });
          
          child.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`Script failed with code ${code}: ${script}`));
            }
          });
          
          child.on('error', reject);
        });
      } catch (error) {
        console.error(`Failed to run post-generation script: ${script}`, error);
        // Continue with other scripts even if one fails
      }
    }
  }

  async validateTemplate(templateKey: string): Promise<{ valid: boolean; errors: string[] }> {
    const template = this.templates.get(templateKey);
    if (!template) {
      return { valid: false, errors: [`Template not found: ${templateKey}`] };
    }
    
    const errors: string[] = [];
    
    // Validate required fields
    if (!template.name) errors.push('Template name is required');
    if (!template.description) errors.push('Template description is required');
    if (!template.category) errors.push('Template category is required');
    if (!template.files || Object.keys(template.files).length === 0) {
      errors.push('Template must define at least one file');
    }
    
    // Validate file templates exist
    const templateDir = path.join(this.templatesPath, templateKey);
    for (const [filePath, fileConfig] of Object.entries(template.files)) {
      const templateFile = path.join(templateDir, fileConfig.template);
      try {
        await fs.access(templateFile);
      } catch {
        errors.push(`Template file not found: ${fileConfig.template}`);
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
}