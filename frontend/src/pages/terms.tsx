import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">
              Terms of Service
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none">
            <div className="text-center py-12 text-muted-foreground">
              <h2 className="text-xl font-semibold mb-4">Insert Terms of Service here</h2>
              <p>
                This is a placeholder for your Terms of Service content. 
                Please replace this text with your actual terms and conditions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}