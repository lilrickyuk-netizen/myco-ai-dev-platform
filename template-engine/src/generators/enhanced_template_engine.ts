/**
 * Enhanced Template Engine - Advanced project scaffolding and code generation
 */

import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import Handlebars from 'handlebars';
import yaml from 'js-yaml';
import { glob } from 'glob';

export interface TemplateConfig {
  name: string;
  displayName: string;
  description: string;
  version: string;
  author: string;
  license: string;
  category: string;
  tags: string[];
  framework: string;
  language: string;
  features: string[];
  dependencies: {
    required: string[];
    optional: string[];
    development: string[];
  };
  variables: {
    [key: string]: {
      type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'file' | 'directory';
      description: string;
      default?: any;
      required?: boolean;
      options?: string[];
      validation?: {
        pattern?: string;
        min?: number;
        max?: number;
        message?: string;
      };
    };
  };
  hooks: {
    preGeneration?: string[];
    postGeneration?: string[];
    preFile?: string[];
    postFile?: string[];
  };
  ignorePatterns: string[];
  transformations: {
    [filePattern: string]: {
      engine: 'handlebars' | 'ejs' | 'mustache' | 'custom';
      options?: any;
    };
  };
}

export interface GenerationRequest {
  templateName: string;
  projectName: string;
  outputPath: string;
  variables: { [key: string]: any };
  options: {
    overwrite?: boolean;
    preserveGitHistory?: boolean;
    includeExamples?: boolean;
    minimalSetup?: boolean;
    customizations?: {
      [componentName: string]: any;
    };
  };
  userId?: string;
  projectId?: string;
}

export interface GenerationResult {
  success: boolean;
  projectPath: string;
  filesGenerated: {
    path: string;
    type: 'file' | 'directory';
    template?: string;
    size: number;
  }[];
  variables: { [key: string]: any };
  metadata: {
    templateUsed: string;
    generationTime: number;
    totalFiles: number;
    totalSize: number;
    checksum: string;
  };
  warnings: string[];
  errors: string[];
  nextSteps: string[];
}

export interface TemplateRegistry {
  [templateName: string]: {
    config: TemplateConfig;
    path: string;
    lastModified: Date;
    usage: {
      count: number;
      lastUsed: Date;
    };
  };
}

export class EnhancedTemplateEngine {
  private templatesPath: string;
  private registry: TemplateRegistry = {};
  private handlebars: typeof Handlebars;

  constructor(templatesPath: string = './templates') {
    this.templatesPath = templatesPath;
    this.handlebars = Handlebars.create();
    this.registerHelpers();
  }

  async initialize(): Promise<void> {
    await this.loadTemplates();
    await this.validateTemplates();
  }

  private async loadTemplates(): Promise<void> {
    try {
      const templateDirs = await fs.readdir(this.templatesPath, { withFileTypes: true });
      
      for (const dir of templateDirs) {
        if (dir.isDirectory()) {
          const templatePath = path.join(this.templatesPath, dir.name);
          const configPath = path.join(templatePath, 'template.json');
          
          try {
            const configContent = await fs.readFile(configPath, 'utf-8');
            const config: TemplateConfig = JSON.parse(configContent);
            
            this.registry[dir.name] = {
              config,
              path: templatePath,
              lastModified: new Date(),
              usage: {
                count: 0,
                lastUsed: new Date()
              }
            };
          } catch (error) {
            console.warn(`Failed to load template ${dir.name}:`, error);
          }
        }
      }
      
      console.log(`Loaded ${Object.keys(this.registry).length} templates`);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }

  private async validateTemplates(): Promise<void> {
    for (const [name, template] of Object.entries(this.registry)) {
      try {
        await this.validateTemplate(template);
      } catch (error) {
        console.warn(`Template ${name} validation failed:`, error);
        delete this.registry[name];
      }
    }
  }

  private async validateTemplate(template: any): Promise<void> {
    const requiredFiles = ['template.json'];
    const templatePath = template.path;
    
    for (const file of requiredFiles) {
      const filePath = path.join(templatePath, file);
      try {
        await fs.access(filePath);
      } catch (error) {
        throw new Error(`Required file ${file} not found in template`);
      }
    }
    
    // Validate config structure
    const config = template.config;
    if (!config.name || !config.displayName || !config.framework || !config.language) {
      throw new Error('Template config missing required fields');
    }
  }

  async generateProject(request: GenerationRequest): Promise<GenerationResult> {
    const startTime = Date.now();
    const result: GenerationResult = {
      success: false,
      projectPath: request.outputPath,
      filesGenerated: [],
      variables: request.variables,
      metadata: {
        templateUsed: request.templateName,
        generationTime: 0,
        totalFiles: 0,
        totalSize: 0,
        checksum: ''
      },
      warnings: [],
      errors: [],
      nextSteps: []
    };

    try {
      // Validate request
      await this.validateGenerationRequest(request);
      
      // Get template
      const template = this.registry[request.templateName];
      if (!template) {
        throw new Error(`Template ${request.templateName} not found`);
      }

      // Prepare variables
      const variables = await this.prepareVariables(template.config, request.variables);
      
      // Create output directory
      await fs.mkdir(request.outputPath, { recursive: true });
      
      // Run pre-generation hooks
      await this.runHooks(template.config.hooks.preGeneration || [], variables, request.outputPath);
      
      // Process template files
      await this.processTemplateFiles(template, variables, request);
      
      // Run post-generation hooks
      await this.runHooks(template.config.hooks.postGeneration || [], variables, request.outputPath);
      
      // Generate project metadata
      await this.generateProjectMetadata(request, template.config, variables);
      
      // Calculate checksums and final metadata
      result.metadata.generationTime = Date.now() - startTime;
      result.metadata.totalFiles = result.filesGenerated.length;
      result.metadata.totalSize = result.filesGenerated.reduce((sum, file) => sum + file.size, 0);
      result.metadata.checksum = await this.calculateProjectChecksum(request.outputPath);
      
      // Add next steps
      result.nextSteps = await this.generateNextSteps(template.config, variables);
      
      // Update usage statistics
      template.usage.count++;
      template.usage.lastUsed = new Date();
      
      result.success = true;
      
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      console.error('Project generation failed:', error);
    }

    return result;
  }

  private async validateGenerationRequest(request: GenerationRequest): Promise<void> {
    if (!request.templateName) {
      throw new Error('Template name is required');
    }
    
    if (!request.projectName) {
      throw new Error('Project name is required');
    }
    
    if (!request.outputPath) {
      throw new Error('Output path is required');
    }
    
    // Validate project name
    if (!/^[a-zA-Z0-9-_]+$/.test(request.projectName)) {
      throw new Error('Project name must contain only alphanumeric characters, hyphens, and underscores');
    }
    
    // Check if output path exists and handle overwrite
    try {
      await fs.access(request.outputPath);
      if (!request.options.overwrite) {
        throw new Error('Output path already exists. Use overwrite option to replace.');
      }
    } catch (error) {
      // Path doesn't exist, which is fine
    }
  }

  private async prepareVariables(config: TemplateConfig, userVariables: { [key: string]: any }): Promise<{ [key: string]: any }> {
    const variables: { [key: string]: any } = {};
    
    // Process template variables
    for (const [key, varConfig] of Object.entries(config.variables)) {
      let value = userVariables[key];
      
      // Use default if not provided
      if (value === undefined) {
        if (varConfig.required) {
          throw new Error(`Required variable ${key} not provided`);
        }
        value = varConfig.default;
      }
      
      // Validate variable
      await this.validateVariable(key, value, varConfig);
      
      variables[key] = value;
    }
    
    // Add built-in variables
    variables.projectName = userVariables.projectName;
    variables.timestamp = new Date().toISOString();
    variables.generationId = uuidv4();
    variables.templateName = config.name;
    variables.templateVersion = config.version;
    
    return variables;
  }

  private async validateVariable(name: string, value: any, config: any): Promise<void> {
    if (config.validation) {
      const validation = config.validation;
      
      if (validation.pattern && typeof value === 'string') {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          throw new Error(validation.message || `Variable ${name} does not match required pattern`);
        }
      }
      
      if (validation.min !== undefined && typeof value === 'number') {
        if (value < validation.min) {
          throw new Error(validation.message || `Variable ${name} must be at least ${validation.min}`);
        }
      }
      
      if (validation.max !== undefined && typeof value === 'number') {
        if (value > validation.max) {
          throw new Error(validation.message || `Variable ${name} must be at most ${validation.max}`);
        }
      }
    }
  }

  private async processTemplateFiles(template: any, variables: { [key: string]: any }, request: GenerationRequest): Promise<void> {
    const templatePath = template.path;
    const config = template.config;
    
    // Get all files in template
    const files = await glob('**/*', {
      cwd: templatePath,
      ignore: ['template.json', ...config.ignorePatterns],
      dot: true
    });
    
    for (const file of files) {
      const sourcePath = path.join(templatePath, file);
      const stats = await fs.stat(sourcePath);
      
      if (stats.isFile()) {
        await this.processTemplateFile(sourcePath, file, variables, request, config);
      } else if (stats.isDirectory()) {
        const outputPath = path.join(request.outputPath, this.processFileName(file, variables));
        await fs.mkdir(outputPath, { recursive: true });
        
        request.variables.filesGenerated = request.variables.filesGenerated || [];
        request.variables.filesGenerated.push({
          path: outputPath,
          type: 'directory',
          size: 0
        });
      }
    }
  }

  private async processTemplateFile(
    sourcePath: string,
    relativePath: string,
    variables: { [key: string]: any },
    request: GenerationRequest,
    config: TemplateConfig
  ): Promise<void> {
    // Process file name with variables
    const processedFileName = this.processFileName(relativePath, variables);
    const outputPath = path.join(request.outputPath, processedFileName);
    
    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    // Read source file
    const content = await fs.readFile(sourcePath, 'utf-8');
    
    // Determine transformation
    const transformation = this.getTransformation(relativePath, config);
    
    let processedContent: string;
    
    if (transformation) {
      // Apply transformation
      processedContent = await this.applyTransformation(content, transformation, variables);
    } else {
      // Copy as-is
      processedContent = content;
    }
    
    // Write output file
    await fs.writeFile(outputPath, processedContent, 'utf-8');
    
    const stats = await fs.stat(outputPath);
    
    request.variables.filesGenerated = request.variables.filesGenerated || [];
    request.variables.filesGenerated.push({
      path: outputPath,
      type: 'file',
      template: relativePath,
      size: stats.size
    });
  }

  private processFileName(fileName: string, variables: { [key: string]: any }): string {
    // Replace variables in file names (e.g., {{projectName}}.config.js)
    let processed = fileName;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, String(value));
    }
    
    return processed;
  }

  private getTransformation(filePath: string, config: TemplateConfig): any {
    for (const [pattern, transformation] of Object.entries(config.transformations)) {
      const regex = new RegExp(pattern);
      if (regex.test(filePath)) {
        return transformation;
      }
    }
    
    // Default transformations based on file extension
    const ext = path.extname(filePath);
    const transformableExtensions = ['.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.scss', '.json', '.yaml', '.yml', '.md', '.txt'];
    
    if (transformableExtensions.includes(ext)) {
      return { engine: 'handlebars' };
    }
    
    return null;
  }

  private async applyTransformation(content: string, transformation: any, variables: { [key: string]: any }): Promise<string> {
    switch (transformation.engine) {
      case 'handlebars':
        const template = this.handlebars.compile(content);
        return template(variables);
        
      case 'ejs':
        // Would implement EJS transformation
        throw new Error('EJS transformation not implemented');
        
      case 'mustache':
        // Would implement Mustache transformation
        throw new Error('Mustache transformation not implemented');
        
      default:
        return content;
    }
  }

  private registerHelpers(): void {
    // String helpers
    this.handlebars.registerHelper('camelCase', (str: string) => {
      return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    });
    
    this.handlebars.registerHelper('pascalCase', (str: string) => {
      return str.replace(/(^\w|-\w)/g, (g) => g.replace('-', '').toUpperCase());
    });
    
    this.handlebars.registerHelper('kebabCase', (str: string) => {
      return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
    });
    
    this.handlebars.registerHelper('snakeCase', (str: string) => {
      return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1_$2').toLowerCase();
    });
    
    // Conditional helpers
    this.handlebars.registerHelper('if_eq', (a: any, b: any, options: any) => {
      return a === b ? options.fn(this) : options.inverse(this);
    });
    
    this.handlebars.registerHelper('if_ne', (a: any, b: any, options: any) => {
      return a !== b ? options.fn(this) : options.inverse(this);
    });
    
    // Array helpers
    this.handlebars.registerHelper('join', (array: any[], separator: string = ', ') => {
      return array.join(separator);
    });
    
    // Date helpers
    this.handlebars.registerHelper('currentYear', () => {
      return new Date().getFullYear();
    });
    
    this.handlebars.registerHelper('isoDate', () => {
      return new Date().toISOString();
    });
  }

  private async runHooks(hooks: string[], variables: { [key: string]: any }, outputPath: string): Promise<void> {
    for (const hook of hooks) {
      try {
        // Simple hook execution - in practice, this would be more sophisticated
        console.log(`Running hook: ${hook}`);
        // Would execute shell commands or custom functions
      } catch (error) {
        console.warn(`Hook failed: ${hook}`, error);
      }
    }
  }

  private async generateProjectMetadata(request: GenerationRequest, config: TemplateConfig, variables: { [key: string]: any }): Promise<void> {
    const metadata = {
      name: request.projectName,
      template: {
        name: config.name,
        version: config.version,
        framework: config.framework,
        language: config.language
      },
      generation: {
        timestamp: new Date().toISOString(),
        generatedBy: 'Myco Template Engine',
        variables
      },
      dependencies: config.dependencies
    };
    
    const metadataPath = path.join(request.outputPath, '.myco', 'project.json');
    await fs.mkdir(path.dirname(metadataPath), { recursive: true });
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  private async calculateProjectChecksum(projectPath: string): Promise<string> {
    const crypto = await import('crypto');
    const files = await glob('**/*', { cwd: projectPath, ignore: ['.myco/**'] });
    
    const hash = crypto.createHash('sha256');
    
    for (const file of files.sort()) {
      const filePath = path.join(projectPath, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        const content = await fs.readFile(filePath);
        hash.update(content);
      }
    }
    
    return hash.digest('hex');
  }

  private async generateNextSteps(config: TemplateConfig, variables: { [key: string]: any }): Promise<string[]> {
    const steps: string[] = [];
    
    steps.push(`cd ${variables.projectName}`);
    
    if (config.dependencies.required.length > 0) {
      if (config.language === 'javascript' || config.language === 'typescript') {
        steps.push('npm install');
      } else if (config.language === 'python') {
        steps.push('pip install -r requirements.txt');
      }
    }
    
    if (config.framework === 'react') {
      steps.push('npm run dev');
    } else if (config.framework === 'express') {
      steps.push('npm start');
    }
    
    steps.push('Open your code editor and start developing!');
    
    return steps;
  }

  // Public API methods
  async getTemplates(): Promise<{ [name: string]: TemplateConfig }> {
    const templates: { [name: string]: TemplateConfig } = {};
    
    for (const [name, template] of Object.entries(this.registry)) {
      templates[name] = template.config;
    }
    
    return templates;
  }

  async getTemplate(name: string): Promise<TemplateConfig | null> {
    const template = this.registry[name];
    return template ? template.config : null;
  }

  async addTemplate(templatePath: string): Promise<void> {
    const configPath = path.join(templatePath, 'template.json');
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config: TemplateConfig = JSON.parse(configContent);
    
    this.registry[config.name] = {
      config,
      path: templatePath,
      lastModified: new Date(),
      usage: {
        count: 0,
        lastUsed: new Date()
      }
    };
    
    await this.validateTemplate(this.registry[config.name]);
  }

  async removeTemplate(name: string): Promise<boolean> {
    if (this.registry[name]) {
      delete this.registry[name];
      return true;
    }
    return false;
  }

  getUsageStatistics(): { [templateName: string]: { count: number; lastUsed: Date } } {
    const stats: { [templateName: string]: { count: number; lastUsed: Date } } = {};
    
    for (const [name, template] of Object.entries(this.registry)) {
      stats[name] = template.usage;
    }
    
    return stats;
  }
}