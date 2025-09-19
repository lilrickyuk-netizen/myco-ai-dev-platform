module.exports = {
  // SLO validation processor for Artillery
  validateSLOs: function(context, ee, next) {
    const startTime = Date.now();
    
    // Add request timing
    context.vars.startTime = startTime;
    
    return next();
  },

  // Log response times for SLO analysis
  logTiming: function(context, response, next) {
    const endTime = Date.now();
    const responseTime = endTime - context.vars.startTime;
    
    if (responseTime > 2000) {
      console.warn(`⚠️  Slow response: ${responseTime}ms for ${response.request.uri.href}`);
    }
    
    return next();
  },

  // Set custom headers for monitoring
  setHeaders: function(context, ee, next) {
    context.vars.headers = {
      'X-Test-Type': 'SLO-Validation',
      'X-Test-Run': process.env.GITHUB_RUN_ID || 'local'
    };
    
    return next();
  }
};