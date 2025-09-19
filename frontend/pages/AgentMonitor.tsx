import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PlayCircle, Settings, RefreshCw } from 'lucide-react';
import AgentDashboard from '@/components/AgentDashboard';
import backend from '~backend/client';
import { useToast } from '@/components/ui/use-toast';

export default function AgentMonitorPage() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [projectId, setProjectId] = useState('proj-demo-' + Math.random().toString(36).substr(2, 9));
  const { toast } = useToast();

  const startSimulation = async () => {
    if (isSimulating) return;
    
    setIsSimulating(true);
    try {
      const result = await backend["agent-monitor"].startSimulation({
        projectId,
        speed: simulationSpeed
      });
      
      toast({
        title: "Simulation Started",
        description: `Started workflow simulation for project ${projectId}`,
      });
      
      console.log('Simulation result:', result);
    } catch (error) {
      console.error('Failed to start simulation:', error);
      toast({
        title: "Error",
        description: "Failed to start simulation. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const refreshDashboard = () => {
    // Force a re-render of the dashboard component
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Agent Monitoring Dashboard</h1>
            <p className="text-muted-foreground">
              Real-time visualization of multi-agent system execution
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              Live Updates
            </Badge>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refreshDashboard}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Control Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Simulation Controls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="text-sm font-medium mb-2 block">Project ID</label>
                <Input
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="project-id"
                  disabled={isSimulating}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Simulation Speed</label>
                <Input
                  type="number"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={simulationSpeed}
                  onChange={(e) => setSimulationSpeed(parseFloat(e.target.value))}
                  disabled={isSimulating}
                />
              </div>
              
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={startSimulation}
                  disabled={isSimulating || !projectId}
                  className="flex items-center gap-2"
                >
                  <PlayCircle className="h-4 w-4" />
                  {isSimulating ? 'Starting...' : 'Start Simulation'}
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                <div>Speed: {simulationSpeed}x normal</div>
                <div>Est. Duration: ~{Math.round(20 / simulationSpeed)} minutes</div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Demo Workflow:</strong> This simulation creates a realistic multi-agent workflow with 
                8 agents across 4 phases (Planning → Implementation → Validation → Deployment). 
                Each agent has realistic dependencies and progress patterns.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Main Dashboard */}
        <AgentDashboard />

        {/* Information Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Dashboard Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2">Real-time Features</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Live progress bars with WebSocket updates</li>
                  <li>• Real-time agent status changes</li>
                  <li>• Dynamic estimated completion times</li>
                  <li>• Activity feed with live updates</li>
                  <li>• System metrics and utilization</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Visualization</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Interactive dependency graphs</li>
                  <li>• Phase-based workflow progress</li>
                  <li>• Agent type distribution</li>
                  <li>• Error tracking and alerts</li>
                  <li>• Performance analytics</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}