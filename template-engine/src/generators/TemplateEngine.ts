import { promises as fs } from 'fs';
import { join, resolve, dirname, basename } from 'path';
import { EventEmitter } from 'events';

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  default?: any;
  required?: boolean;
  validation?: (value: any) => boolean | string;
}

export interface TemplateFile {
  path: string;
  content: string;
  encoding?: 'utf8' | 'binary';
  executable?: boolean;
  template?: boolean;
}

export interface TemplateMetadata {
  name: string;
  displayName: string;
  description: string;
  version: string;
  author: string;
  tags: string[];
  category: string;
  language: string;
  framework?: string;
  variables: TemplateVariable[];
  dependencies: string[];
  scripts: Record<string, string>;
  features: string[];
  readme?: string;
}

export interface Template {
  metadata: TemplateMetadata;
  files: TemplateFile[];
  hooks?: {
    preGenerate?: string;
    postGenerate?: string;
    preInstall?: string;
    postInstall?: string;
  };
}

export interface GenerationContext {
  variables: Record<string, any>;
  projectName: string;
  projectPath: string;
  templatePath: string;
  helpers: Record<string, Function>;
}

export interface GenerationOptions {
  outputPath: string;
  variables: Record<string, any>;
  overwrite?: boolean;
  dryRun?: boolean;
  skipHooks?: boolean;
  skipInstall?: boolean;
}

export interface GenerationResult {
  success: boolean;
  filesCreated: string[];
  filesSkipped: string[];
  errors: string[];
  warnings: string[];
  duration: number;
  template: TemplateMetadata;
}

export class TemplateEngine extends EventEmitter {
  private templatesPath: string;
  private loadedTemplates: Map<string, Template> = new Map();
  private helpers: Record<string, Function> = {};

  constructor(templatesPath: string) {
    super();
    this.templatesPath = templatesPath;
    this.registerDefaultHelpers();
  }

  private registerDefaultHelpers(): void {
    this.helpers = {
      // String helpers
      capitalize: (str: string) => str.charAt(0).toUpperCase() + str.slice(1),
      lowercase: (str: string) => str.toLowerCase(),
      uppercase: (str: string) => str.toUpperCase(),
      camelCase: (str: string) => str.replace(/[-_\\s]+(.)/g, (_, char) => char.toUpperCase()),
      kebabCase: (str: string) => str.replace(/[A-Z]/g, '-$&').toLowerCase().replace(/^-/, ''),
      snakeCase: (str: string) => str.replace(/[A-Z]/g, '_$&').toLowerCase().replace(/^_/, ''),
      pascalCase: (str: string) => this.helpers.camelCase(str).charAt(0).toUpperCase() + this.helpers.camelCase(str).slice(1),

      // Date helpers
      currentYear: () => new Date().getFullYear(),
      currentDate: () => new Date().toISOString().split('T')[0],
      currentDateTime: () => new Date().toISOString(),

      // UUID helper
      uuid: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      }),

      // Array helpers
      join: (arr: any[], separator: string = ', ') => arr.join(separator),
      first: (arr: any[]) => arr[0],
      last: (arr: any[]) => arr[arr.length - 1],

      // Conditional helpers
      if: (condition: boolean, trueValue: any, falseValue: any = '') => condition ? trueValue : falseValue,
      unless: (condition: boolean, falseValue: any, trueValue: any = '') => !condition ? falseValue : trueValue,

      // JSON helper
      json: (obj: any, indent: number = 2) => JSON.stringify(obj, null, indent),

      // Path helpers
      filename: (path: string) => basename(path),
      dirname: (path: string) => dirname(path),
      extname: (path: string) => path.split('.').pop() || '',

      // String manipulation
      replace: (str: string, search: string, replace: string) => str.replace(new RegExp(search, 'g'), replace),
      trim: (str: string) => str.trim(),
      split: (str: string, separator: string) => str.split(separator),

      // Math helpers
      add: (a: number, b: number) => a + b,
      subtract: (a: number, b: number) => a - b,
      multiply: (a: number, b: number) => a * b,
      divide: (a: number, b: number) => a / b,
    };
  }

  async loadTemplate(templateName: string): Promise<Template> {
    if (this.loadedTemplates.has(templateName)) {
      return this.loadedTemplates.get(templateName)!;
    }

    const templatePath = join(this.templatesPath, templateName);
    
    try {
      // Check if template directory exists
      const stats = await fs.stat(templatePath);
      if (!stats.isDirectory()) {
        throw new Error(`Template ${templateName} is not a directory`);
      }

      // Load template.json
      const metadataPath = join(templatePath, 'template.json');
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata: TemplateMetadata = JSON.parse(metadataContent);

      // Load template files
      const files = await this.loadTemplateFiles(templatePath);

      // Load hooks if they exist
      const hooks = await this.loadTemplateHooks(templatePath);

      const template: Template = {
        metadata,
        files,
        hooks,
      };

      this.loadedTemplates.set(templateName, template);
      this.emit('templateLoaded', templateName, template);

      return template;

    } catch (error) {
      throw new Error(`Failed to load template ${templateName}: ${error}`);
    }
  }

  private async loadTemplateFiles(templatePath: string): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];
    const filesPath = join(templatePath, 'files');

    try {
      await this.scanDirectory(filesPath, '', files);
    } catch (error) {
      // Files directory is optional
      console.warn(`No files directory found in template: ${templatePath}`);
    }

    return files;
  }

  private async scanDirectory(dirPath: string, relativePath: string, files: TemplateFile[]): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      const relativeFilePath = join(relativePath, entry.name);

      if (entry.isDirectory()) {
        await this.scanDirectory(fullPath, relativeFilePath, files);
      } else if (entry.isFile()) {
        const content = await fs.readFile(fullPath, 'utf8');
        const stats = await fs.stat(fullPath);

        files.push({
          path: relativeFilePath,
          content,
          encoding: 'utf8',
          executable: (stats.mode & parseInt('111', 8)) !== 0,
          template: this.isTemplateFile(fullPath),
        });
      }
    }
  }

  private isTemplateFile(filePath: string): boolean {
    // Files with .template extension or containing template syntax
    return filePath.endsWith('.template') || this.containsTemplateSyntax(filePath);
  }

  private containsTemplateSyntax(filePath: string): boolean {
    // Simple check for common template syntax
    try {
      const content = require('fs').readFileSync(filePath, 'utf8');
      return /\\{\\{.*?\\}\\}/.test(content) || /<%= .*? %>/.test(content);
    } catch {
      return false;
    }
  }

  private async loadTemplateHooks(templatePath: string): Promise<any> {
    const hooksPath = join(templatePath, 'hooks');
    const hooks: any = {};

    try {
      const hookFiles = ['preGenerate.js', 'postGenerate.js', 'preInstall.js', 'postInstall.js'];
      
      for (const hookFile of hookFiles) {
        const hookPath = join(hooksPath, hookFile);
        try {
          await fs.access(hookPath);
          const hookName = hookFile.replace('.js', '');
          hooks[hookName] = hookPath;
        } catch {
          // Hook file doesn't exist, which is fine
        }
      }
    } catch {
      // Hooks directory doesn't exist, which is fine
    }

    return hooks;
  }

  async generateProject(
    templateName: string, 
    options: GenerationOptions
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    const result: GenerationResult = {
      success: false,
      filesCreated: [],
      filesSkipped: [],
      errors: [],
      warnings: [],
      duration: 0,
      template: {} as TemplateMetadata,
    };

    try {
      // Load template
      const template = await this.loadTemplate(templateName);
      result.template = template.metadata;

      this.emit('generationStarted', templateName, options);

      // Validate variables
      const validationErrors = this.validateVariables(template.metadata.variables, options.variables);
      if (validationErrors.length > 0) {
        result.errors.push(...validationErrors);
        return result;
      }

      // Create generation context
      const context: GenerationContext = {
        variables: { ...this.getDefaultVariables(template.metadata.variables), ...options.variables },
        projectName: options.variables.projectName || basename(options.outputPath),
        projectPath: options.outputPath,
        templatePath: join(this.templatesPath, templateName),
        helpers: this.helpers,
      };

      // Run pre-generate hook
      if (!options.skipHooks && template.hooks?.preGenerate) {
        await this.runHook(template.hooks.preGenerate, context);
      }

      // Create output directory
      if (!options.dryRun) {
        await fs.mkdir(options.outputPath, { recursive: true });
      }

      // Generate files
      for (const file of template.files) {
        try {
          const outputPath = this.resolveOutputPath(file.path, context);
          const fullOutputPath = join(options.outputPath, outputPath);

          // Check if file already exists
          if (!options.overwrite) {
            try {
              await fs.access(fullOutputPath);
              result.filesSkipped.push(outputPath);
              result.warnings.push(`File already exists: ${outputPath}`);
              continue;
            } catch {
              // File doesn't exist, which is good
            }
          }

          // Process file content
          let content = file.content;
          if (file.template) {
            content = this.processTemplate(content, context);
          }

          // Create directory if needed
          const fileDir = dirname(fullOutputPath);
          if (!options.dryRun) {
            await fs.mkdir(fileDir, { recursive: true });
          }

          // Write file
          if (!options.dryRun) {
            await fs.writeFile(fullOutputPath, content, file.encoding || 'utf8');
            
            // Set executable permission if needed
            if (file.executable) {
              await fs.chmod(fullOutputPath, 0o755);
            }
          }

          result.filesCreated.push(outputPath);
          this.emit('fileGenerated', outputPath, content.length);

        } catch (error) {
          const errorMsg = `Failed to generate file ${file.path}: ${error}`;
          result.errors.push(errorMsg);
          this.emit('fileError', file.path, error);
        }
      }

      // Run post-generate hook
      if (!options.skipHooks && template.hooks?.postGenerate) {
        await this.runHook(template.hooks.postGenerate, context);
      }

      // Install dependencies
      if (!options.skipInstall && template.metadata.dependencies.length > 0) {
        await this.installDependencies(template, options.outputPath);
      }

      result.success = result.errors.length === 0;

    } catch (error) {
      result.errors.push(`Generation failed: ${error}`);
      this.emit('generationError', templateName, error);
    }

    result.duration = Date.now() - startTime;
    this.emit('generationCompleted', result);

    return result;
  }

  private validateVariables(templateVars: TemplateVariable[], providedVars: Record<string, any>): string[] {
    const errors: string[] = [];

    for (const templateVar of templateVars) {
      const value = providedVars[templateVar.name];

      // Check required variables
      if (templateVar.required && (value === undefined || value === null || value === '')) {
        errors.push(`Required variable '${templateVar.name}' is missing`);
        continue;
      }

      // Skip validation if value is not provided and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (!this.validateVariableType(value, templateVar.type)) {
        errors.push(`Variable '${templateVar.name}' must be of type ${templateVar.type}`);
        continue;
      }

      // Custom validation
      if (templateVar.validation) {
        const validationResult = templateVar.validation(value);
        if (validationResult !== true) {
          const message = typeof validationResult === 'string' 
            ? validationResult 
            : `Variable '${templateVar.name}' failed validation`;
          errors.push(message);
        }
      }
    }

    return errors;
  }

  private validateVariableType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  private getDefaultVariables(templateVars: TemplateVariable[]): Record<string, any> {
    const defaults: Record<string, any> = {};
    
    for (const templateVar of templateVars) {
      if (templateVar.default !== undefined) {
        defaults[templateVar.name] = templateVar.default;
      }
    }

    return defaults;
  }

  private resolveOutputPath(filePath: string, context: GenerationContext): string {
    // Remove .template extension if present
    let outputPath = filePath.endsWith('.template') 
      ? filePath.slice(0, -9) 
      : filePath;

    // Process template variables in path
    outputPath = this.processTemplate(outputPath, context);

    return outputPath;
  }

  private processTemplate(content: string, context: GenerationContext): string {
    // Simple template processing using string replacement
    // In a production system, you might want to use a more robust template engine like Handlebars or Mustache
    
    let processed = content;

    // Replace {{variable}} syntax
    processed = processed.replace(/\\{\\{\\s*([^}]+)\\s*\\}\\}/g, (match, expression) => {
      try {
        return this.evaluateExpression(expression.trim(), context);
      } catch (error) {
        console.warn(`Template expression error: ${expression} - ${error}`);
        return match; // Return original if evaluation fails
      }
    });

    // Replace <%= expression %> syntax
    processed = processed.replace(/<%=\\s*([^%]+)\\s*%>/g, (match, expression) => {
      try {
        return this.evaluateExpression(expression.trim(), context);
      } catch (error) {
        console.warn(`Template expression error: ${expression} - ${error}`);
        return match; // Return original if evaluation fails
      }
    });

    return processed;
  }

  private evaluateExpression(expression: string, context: GenerationContext): string {
    // Create a safe evaluation context
    const safeContext = {
      ...context.variables,
      ...context.helpers,
      projectName: context.projectName,
      projectPath: context.projectPath,
    };

    // Simple expression evaluation (be careful with eval in production!)
    try {
      const func = new Function(...Object.keys(safeContext), `return ${expression}`);
      const result = func(...Object.values(safeContext));
      return String(result);
    } catch (error) {
      // Fallback to simple variable replacement
      if (safeContext.hasOwnProperty(expression)) {
        return String(safeContext[expression]);
      }
      throw error;
    }
  }

  private async runHook(hookPath: string, context: GenerationContext): Promise<void> {
    try {
      // In a production environment, you might want to use a more secure way to run hooks
      const hookModule = require(hookPath);
      if (typeof hookModule === 'function') {
        await hookModule(context);
      } else if (hookModule.default && typeof hookModule.default === 'function') {
        await hookModule.default(context);
      }
    } catch (error) {
      console.error(`Hook execution failed: ${hookPath} - ${error}`);
      throw error;
    }
  }

  private async installDependencies(template: Template, projectPath: string): Promise<void> {
    // This would integrate with npm, yarn, or other package managers
    // For now, just emit an event
    this.emit('dependenciesInstallStarted', template.metadata.dependencies);
    
    // Simulate installation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.emit('dependenciesInstallCompleted', template.metadata.dependencies);
  }

  async listTemplates(): Promise<TemplateMetadata[]> {
    try {
      const entries = await fs.readdir(this.templatesPath, { withFileTypes: true });
      const templates: TemplateMetadata[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          try {
            const template = await this.loadTemplate(entry.name);
            templates.push(template.metadata);
          } catch (error) {
            console.warn(`Failed to load template ${entry.name}: ${error}`);
          }
        }
      }

      return templates;
    } catch (error) {
      throw new Error(`Failed to list templates: ${error}`);
    }
  }

  addHelper(name: string, helper: Function): void {
    this.helpers[name] = helper;
  }

  removeHelper(name: string): void {
    delete this.helpers[name];
  }

  getHelpers(): Record<string, Function> {
    return { ...this.helpers };
  }
}

export default TemplateEngine;